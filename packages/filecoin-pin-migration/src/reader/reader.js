import pMap from 'p-map'
import { base58btc } from 'multiformats/bases/base58'
import { CID } from 'multiformats/cid'
import { Client as IndexingClient } from '@storacha/indexing-service-client'
import {
  DEFAULT_CHECKPOINT_EVERY_PAGES,
  DEFAULT_SHARD_LIST_CONCURRENCY,
  DEFAULT_STOP_ON_ERROR,
  DEFAULT_UPLOAD_PAGE_SIZE,
} from '../constants.js'
import { isAbortError, throwIfAborted } from '../errors.js'
import { resolveClaimsIndex } from './indexer.js'
import { normalizePositiveInteger } from '../utils.js'

import { getInventorySummaryMap } from '../state.js'

const EXPLICIT_ROOT_CURSOR_PREFIX = 'explicit-roots:'

/**
 * @import {
 *  BuildInventoriesInput,
 *  MigrationStore,
 *  SpaceDID,
 *  MigrationEvent,
 *  IndexingServiceReader,
 *  SourceURLResolver,
 *  ResolvedShard,
 *  StoreShard,
 *  ShardEntry,
 *  ClaimsEntry,
 *  UnknownLink,
 * } from '../api.js'
 */

/**
 * Build migration inventories for multiple spaces, checkpointing into state
 * every configured number of reader pages/chunks.
 *
 * ## Resume
 *
 * Pass a previously persisted MigrationState to resume an interrupted read:
 *   - Spaces already in state.spaceMigrationInventories with no cursor → skipped entirely
 *   - Spaces with a cursor in state.readerProgressCursors → resumed from that page
 *   - Spaces absent from state.spaceMigrationInventories → started fresh
 *
 * When uploadRootsBySpace is provided, the reader switches to explicit-root
 * mode for those spaces:
 *   - upload.list is not called
 *   - roots are chunked by uploadPageSize
 *   - readerProgressCursors store a synthetic "explicit-roots:{index}" cursor
 *     for the next chunk to process
 *
 * When spaceDIDs is omitted, all spaces on the client are processed.
 *
 * ## Events
 *
 *   reader:space:start       — before the first page of each space
 *   reader:shard:failed      — per shard that fails claim resolution
 *   reader:space:complete    — after the last page of each space
 *   state:checkpoint         — after each checkpoint interval and at reader end
 *   reader:complete          — after all spaces; state.phase set to 'planning'
 *
 * @param {BuildInventoriesInput} input
 * @returns {AsyncGenerator<MigrationEvent>}
 */
export async function* buildMigrationInventories({
  client,
  resolver,
  store,
  spaceDIDs,
  uploadRootsBySpace,
  signal,
  options,
}) {
  const stopOnError = options?.stopOnError ?? DEFAULT_STOP_ON_ERROR
  const uploadPageSize = normalizePositiveInteger(
    options?.uploadPageSize,
    DEFAULT_UPLOAD_PAGE_SIZE
  )
  const shardListConcurrency = normalizePositiveInteger(
    options?.shardListConcurrency,
    DEFAULT_SHARD_LIST_CONCURRENCY
  )
  const checkpointEveryPages = normalizePositiveInteger(
    options?.checkpointEveryPages,
    DEFAULT_CHECKPOINT_EVERY_PAGES
  )
  const queryClaimsBatchConcurrency = options?.queryClaimsBatchConcurrency
  const skipIPNIFallback = options?.skipIPNIFallback

  const fetcher = createSignalAwareFetch(
    options?.fetcher ?? globalThis.fetch,
    signal
  )
  const indexer =
    options?.indexer ??
    new IndexingClient({
      serviceURL: options?.serviceURL,
      fetch: fetcher,
    })
  if (spaceDIDs && uploadRootsBySpace) {
    throw new TypeError(
      'buildMigrationInventories: pass either "spaceDIDs" or "uploadRootsBySpace", not both'
    )
  }

  const state = store.getState()

  const dids = /** @type {SpaceDID[]} */ (
    uploadRootsBySpace
      ? Object.keys(uploadRootsBySpace)
      : spaceDIDs ?? client.spaces().map((s) => s.did())
  )

  for (const did of dids) {
    if (signal?.aborted) return
    const spaceDID = /** @type {SpaceDID} */ (did)
    // Space already fully read — skip
    if (
      getInventorySummaryMap(state)[spaceDID] &&
      !state.readerProgressCursors?.[spaceDID]
    ) {
      continue
    }

    const explicitRoots = uploadRootsBySpace?.[spaceDID]
    const persistedCursor = state.readerProgressCursors?.[spaceDID]
    if (!explicitRoots && isExplicitRootCursor(persistedCursor)) {
      throw new TypeError(
        `buildMigrationInventories: ${spaceDID} has an explicit-root reader cursor; resume with uploadRootsBySpace for that space`
      )
    }

    try {
      yield* buildSpaceInventory({
        client,
        indexer,
        resolver,
        spaceDID,
        store,
        state,
        explicitUploadRoots: explicitRoots,
        stopOnError,
        shardListConcurrency,
        uploadPageSize,
        checkpointEveryPages,
        queryClaimsBatchConcurrency,
        skipIPNIFallback,
        fetcher,
        signal,
      })
    } catch (error) {
      if (isAbortError(error, signal)) return
      throw error
    }
  }

  if (signal?.aborted) return
  store.transitionToPlanning()
  yield { type: 'reader:complete' }
  yield { type: 'state:checkpoint', state }
}

/**
 * Read one space, checkpointing into state after each configured interval.
 *
 * Resumes from state.readerProgressCursors[spaceDID] if present.
 *
 * Per page/chunk:
 *   1. List shards for all uploads in the page
 *   2. Query the indexing service and repair missing claims from cid.contact
 *   3. Extract per-shard results from the claims index (pure, no I/O)
 *   4. Checkpoint flat shards + upload roots + failed roots when due
 *
 * @param {object} args
 * @param {import('@storacha/client').Client} args.client
 * @param {IndexingServiceReader} args.indexer
 * @param {SourceURLResolver} args.resolver
 * @param {SpaceDID} args.spaceDID
 * @param {MigrationStore} args.store
 * @param {import('../api.js').MigrationState} args.state - Live ref from store.getState(), used for reads and event payload
 * @param {string[] | undefined} args.explicitUploadRoots
 * @param {boolean} args.stopOnError
 * @param {number} args.shardListConcurrency
 * @param {number} args.uploadPageSize
 * @param {number} args.checkpointEveryPages
 * @param {number | undefined} args.queryClaimsBatchConcurrency
 * @param {boolean | undefined} args.skipIPNIFallback
 * @param {typeof fetch | undefined} args.fetcher
 * @param {AbortSignal | undefined} args.signal
 * @returns {AsyncGenerator<MigrationEvent>}
 */
async function* buildSpaceInventory({
  client,
  indexer,
  resolver,
  spaceDID,
  store,
  state,
  explicitUploadRoots,
  stopOnError,
  shardListConcurrency,
  uploadPageSize,
  checkpointEveryPages,
  queryClaimsBatchConcurrency,
  skipIPNIFallback,
  fetcher,
  signal,
}) {
  yield { type: 'reader:space:start', spaceDID }

  throwIfAborted(signal)
  await client.setCurrentSpace(spaceDID)
  throwIfAborted(signal)
  const spaceName = client.currentSpace?.()?.name || undefined

  let cursor = state.readerProgressCursors?.[spaceDID]
  let explicitRootChunkIndex =
    explicitUploadRoots != null
      ? parseExplicitRootCursor(cursor, spaceDID)
      : undefined
  let pagesSinceLastCheckpoint = 0

  do {
    throwIfAborted(signal)
    const page =
      explicitUploadRoots != null
        ? listExplicitUploadPage({
            uploadRoots: explicitUploadRoots,
            chunkIndex: /** @type {number} */ (explicitRootChunkIndex),
            chunkSize: uploadPageSize,
            spaceDID,
          })
        : await client.capability.upload.list({
            cursor,
            size: uploadPageSize,
            signal,
          })
    throwIfAborted(signal)
    const uploadsInPage = /** @type {Array<{ root: UnknownLink }>} */ (
      page.results
    )

    // Phase 1: list all shards for all uploads in the page
    const uploadsWithShards = await pMap(
      uploadsInPage,
      async (upload) => {
        const root = upload.root.toString()
        const shards = await listShardsFromStore(client, upload.root, signal)
        return { root, shards }
      },
      { concurrency: shardListConcurrency, signal }
    )
    throwIfAborted(signal)

    // Phase 2: query the primary indexer, then repair missing claims from IPNI.
    const allShards = uploadsWithShards.flatMap((u) => u.shards)
    const claimsIndex = await resolveClaimsIndex({
      indexer,
      shards: allShards,
      queryClaimsBatchConcurrency,
      skipIPNIFallback,
      fetcher,
      signal,
    })
    throwIfAborted(signal)

    // Phase 3: extract per-shard results from the claims index (pure, no I/O)
    /** @type {ResolvedShard[]} */
    const pageShards = []
    /** @type {StoreShard[]} */
    const pageShardsToStore = []
    /** @type {string[]} */
    const pageUploadRoots = []
    /** @type {string[]} */
    const pageSkippedRoots = []
    let pageBytes = 0n
    let pageBytesToMigrate = 0n

    for (const { root, shards } of uploadsWithShards) {
      /** @type {ResolvedShard[]} */
      // Shards that stay on the existing source-pull fast path.
      const resolved = []
      /** @type {StoreShard[]} */
      // Shards that must be routed through the standalone store() flow.
      const toStore = []
      let uploadFailed = false

      for (const shard of shards) {
        const result = extractShard(claimsIndex, shard, root, resolver)
        if (result.ok) {
          resolved.push(result.ok)
        } else if (result.store) {
          toStore.push(result.store)
        } else {
          yield /** @type {MigrationEvent} */ ({
            type: 'reader:shard:failed',
            spaceDID,
            root,
            shard: shard.cidStr,
            reason: result.error,
          })
          uploadFailed = true
          if (stopOnError) break
        }
      }

      if (uploadFailed) {
        pageSkippedRoots.push(root)
      } else {
        pageUploadRoots.push(root)
        for (const s of resolved) {
          pageShards.push(s)
          pageBytes += s.sizeBytes
          pageBytesToMigrate += s.sizeBytes
        }
        for (const s of toStore) {
          pageShardsToStore.push(s)
          pageBytes += s.sizeBytes
          // TODO: Once CAR padding is implemented, use 128 bytes here when sizeBytes is less than or equal to 127.
          pageBytesToMigrate += s.sizeBytes
        }
      }
    }

    cursor = page.cursor
    if (explicitRootChunkIndex != null) {
      explicitRootChunkIndex += 1
    }

    store.checkpointInventoryPage({
      spaceDID,
      name: spaceName,
      shards: pageShards,
      shardsToStore: pageShardsToStore,
      uploads: pageUploadRoots,
      skippedUploads: pageSkippedRoots,
      totalBytes: pageBytes,
      totalSizeToMigrate: pageBytesToMigrate,
      cursor,
    })

    pagesSinceLastCheckpoint += 1
    if (pagesSinceLastCheckpoint >= checkpointEveryPages) {
      yield /** @type {MigrationEvent} */ ({ type: 'state:checkpoint', state })
      pagesSinceLastCheckpoint = 0
    }
  } while (cursor)

  if (pagesSinceLastCheckpoint > 0) {
    yield /** @type {MigrationEvent} */ ({ type: 'state:checkpoint', state })
  }

  yield /** @type {MigrationEvent} */ ({
    type: 'reader:space:complete',
    spaceDID,
  })
}

// ── Shard listing ─────────────────────────────────────────────────────────────

/**
 * Paginate shard CIDs from the upload table for a given upload root.
 *
 * @param {import('@storacha/client').Client} client
 * @param {UnknownLink} root
 * @param {AbortSignal | undefined} signal
 * @returns {Promise<ShardEntry[]>}
 */
async function listShardsFromStore(client, root, signal) {
  /** @type {ShardEntry[]} */
  const shards = []
  let cursor
  do {
    const page = await client.capability.upload.shard.list(root, {
      cursor,
      signal,
    })
    for (const link of page.results) {
      const b58 = base58btc.encode(link.multihash.bytes)
      shards.push({ cidStr: link.toString(), multihash: link.multihash, b58 })
    }
    cursor = page.cursor
  } while (cursor)
  return shards
}

// ── Per-shard extraction ──────────────────────────────────────────────────────

/**
 * Extract a shard entry from the pre-built claims index.
 * Pure function — no network calls.
 *
 * @param {Map<string, ClaimsEntry>} claimsIndex
 * @param {ShardEntry} shard
 * @param {string} root
 * @param {SourceURLResolver} resolver
 */
function extractShard(claimsIndex, shard, root, resolver) {
  const entry = claimsIndex.get(shard.b58)
  const sizeBytes =
    entry?.size && entry.size > 0n ? entry.size : entry?.piece?.size ?? 0n

  if (!entry?.locationURL) {
    return { error: `Missing location URL: shard ${shard.cidStr}` }
  }

  if (!entry?.piece) {
    /** @type {StoreShard} */
    const storeShard = {
      root,
      cid: shard.cidStr,
      sourceURL: entry.locationURL,
      sizeBytes,
    }
    // storeShard.sourceURL = resolver.resolve(storeShard) // the roundabout needs the pieceCID, for now, just use the location URL directly.
    return { store: storeShard }
  }

  if (sizeBytes < 127n) {
    // TODO: Route tiny shards through store() once deterministic CAR padding is implemented.
    return {
      error: `Shard ${shard.cidStr} is smaller than the minimum supported CAR size`,
    }
  }

  /** @type {ResolvedShard} */
  const resolved = {
    root,
    cid: shard.cidStr,
    pieceCID: entry.piece.link.toString(),
    sourceURL: entry.locationURL,
    sizeBytes,
  }
  resolved.sourceURL = resolver.resolve(resolved)

  return { ok: resolved }
}

/**
 * @param {typeof fetch | undefined} fetcher
 * @param {AbortSignal | undefined} signal
 * @returns {typeof fetch | undefined}
 */
function createSignalAwareFetch(fetcher, signal) {
  if (typeof fetcher !== 'function' || !signal) return fetcher

  return /** @type {typeof fetch} */ (
    (input, init = {}) =>
      fetcher(input, {
        ...init,
        signal: init.signal ?? signal,
      })
  )
}

/**
 * @param {string | undefined} cursor
 */
function isExplicitRootCursor(cursor) {
  return cursor?.startsWith(EXPLICIT_ROOT_CURSOR_PREFIX) ?? false
}

/**
 * @param {string | undefined} cursor
 * @param {SpaceDID} spaceDID
 */
function parseExplicitRootCursor(cursor, spaceDID) {
  if (cursor == null) return 0
  if (!isExplicitRootCursor(cursor)) {
    throw new TypeError(
      `buildMigrationInventories: invalid explicit-root cursor for ${spaceDID}: ${cursor}`
    )
  }

  const suffix = cursor.slice(EXPLICIT_ROOT_CURSOR_PREFIX.length)
  if (!/^\d+$/.test(suffix)) {
    throw new TypeError(
      `buildMigrationInventories: invalid explicit-root cursor for ${spaceDID}: ${cursor}`
    )
  }

  const chunkIndex = Number(suffix)
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    throw new TypeError(
      `buildMigrationInventories: invalid explicit-root cursor for ${spaceDID}: ${cursor}`
    )
  }

  return chunkIndex
}

/**
 * @param {number} chunkIndex
 */
function formatExplicitRootCursor(chunkIndex) {
  return `${EXPLICIT_ROOT_CURSOR_PREFIX}${chunkIndex}`
}

/**
 * Build a synthetic upload page from explicit roots for one space.
 *
 * @param {object} args
 * @param {string[]} args.uploadRoots
 * @param {number} args.chunkIndex
 * @param {number} args.chunkSize
 * @param {SpaceDID} args.spaceDID
 * @returns {{ results: Array<{ root: UnknownLink }>, cursor: string | undefined }}
 */
function listExplicitUploadPage({
  uploadRoots,
  chunkIndex,
  chunkSize,
  spaceDID,
}) {
  const totalChunks =
    uploadRoots.length === 0 ? 1 : Math.ceil(uploadRoots.length / chunkSize)
  if (chunkIndex >= totalChunks) {
    throw new RangeError(
      `buildMigrationInventories: explicit-root cursor for ${spaceDID} is beyond the available root chunks: ${chunkIndex}`
    )
  }

  const start = chunkIndex * chunkSize
  const chunk = uploadRoots.slice(start, start + chunkSize)

  return {
    results: chunk.map((root) => ({
      root: parseExplicitRoot(root, spaceDID),
    })),
    cursor:
      start + chunk.length < uploadRoots.length
        ? formatExplicitRootCursor(chunkIndex + 1)
        : undefined,
  }
}

/**
 * @param {string} root
 * @param {SpaceDID} spaceDID
 */
function parseExplicitRoot(root, spaceDID) {
  try {
    return CID.parse(root)
  } catch {
    throw new TypeError(
      `buildMigrationInventories: invalid explicit upload root for ${spaceDID}: ${root}`
    )
  }
}

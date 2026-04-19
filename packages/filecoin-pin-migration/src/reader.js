import pMap from 'p-map'
import { Piece } from '@web3-storage/data-segment'
import { base58btc } from 'multiformats/bases/base58'
import { Client as IndexingClient } from '@storacha/indexing-service-client'
import {
  DEFAULT_SHARD_LIST_CONCURRENCY,
  DEFAULT_STOP_ON_ERROR,
} from './constants.js'
import { checkpointInventoryPage } from './state.js'

/**
 * @import {
 *  BuildInventoriesInput,
 *  SpaceDID,
 *  MigrationEvent,
 *  MigrationState,
 *  IndexingServiceReader,
 *  SourceURLResolver,
 *  ResolvedShard,
 *  StoreShard,
 *  ShardEntry,
 *  ClaimsEntry,
 *  UnknownLink,
 *  PieceLink
 * } from './api.js'
 */

/**
 * Build migration inventories for multiple spaces, checkpointing into state
 * after each upload.list page.
 *
 * ## Resume
 *
 * Pass a previously persisted MigrationState to resume an interrupted read:
 *   - Spaces already in state.spacesInventories with no cursor → skipped entirely
 *   - Spaces with a cursor in state.readerProgressCursors → resumed from that page
 *   - Spaces absent from state.spacesInventories → started fresh
 *
 * When spaceDIDs is omitted, all spaces on the client are processed.
 *
 * ## Events
 *
 *   reader:space:start       — before the first page of each space
 *   reader:shard:failed      — per shard that fails claim resolution
 *   reader:space:complete    — after the last page of each space
 *   state:checkpoint         — after every upload.list page (persist on this event)
 *   reader:complete          — after all spaces; state.phase set to 'planning'
 *
 * @param {BuildInventoriesInput} input
 * @returns {AsyncGenerator<MigrationEvent>}
 */
export async function* buildMigrationInventories({
  client,
  resolver,
  state,
  spaceDIDs,
  uploadRootsBySpace,
  options,
}) {
  const indexer =
    options?.indexer ?? new IndexingClient({ serviceURL: options?.serviceURL })
  const stopOnError = options?.stopOnError ?? DEFAULT_STOP_ON_ERROR
  const shardListConcurrency = DEFAULT_SHARD_LIST_CONCURRENCY
  if (spaceDIDs && uploadRootsBySpace) {
    throw new TypeError(
      'buildMigrationInventories: pass either "spaceDIDs" or "uploadRootsBySpace", not both'
    )
  }

  const dids = /** @type {SpaceDID[]} */ (
    uploadRootsBySpace
      ? Object.keys(uploadRootsBySpace)
      : spaceDIDs ?? client.spaces().map((s) => s.did())
  )

  for (const did of dids) {
    const spaceDID = /** @type {SpaceDID} */ (did)
    // Space already fully read — skip
    if (
      state.spacesInventories[spaceDID] &&
      !state.readerProgressCursors?.[spaceDID]
    ) {
      continue
    }

    yield* buildSpaceInventory({
      client,
      indexer,
      resolver,
      spaceDID,
      state,
      selectedUploadRoots: uploadRootsBySpace?.[spaceDID],
      stopOnError,
      shardListConcurrency,
    })
  }

  state.phase = 'planning'
  yield { type: 'reader:complete' }
  yield { type: 'state:checkpoint', state }
}

/**
 * Paginate all uploads for one space, checkpointing into state after each page.
 *
 * Resumes from state.readerProgressCursors[spaceDID] if present.
 *
 * Per page:
 *   1. List shards for all uploads in the page
 *   2. Batch-query claims for all shards in one HTTP call
 *   3. Extract per-shard results from the claims index (pure, no I/O)
 *   4. Checkpoint flat shards + upload roots + failed roots
 *
 * @param {object} args
 * @param {import('@storacha/client').Client} args.client
 * @param {IndexingServiceReader} args.indexer
 * @param {SourceURLResolver} args.resolver
 * @param {SpaceDID} args.spaceDID
 * @param {MigrationState} args.state - Mutated in place
 * @param {string[] | undefined} args.selectedUploadRoots
 * @param {boolean} args.stopOnError
 * @param {number} args.shardListConcurrency
 * @returns {AsyncGenerator<MigrationEvent>}
 */
async function* buildSpaceInventory({
  client,
  indexer,
  resolver,
  spaceDID,
  state,
  selectedUploadRoots,
  stopOnError,
  shardListConcurrency,
}) {
  yield { type: 'reader:space:start', spaceDID }

  await client.setCurrentSpace(spaceDID)
  const spaceName = client.currentSpace?.()?.name || undefined

  let cursor = state.readerProgressCursors?.[spaceDID]
  const selectedRoots =
    selectedUploadRoots != null ? new Set(selectedUploadRoots) : undefined

  do {
    const page = await client.capability.upload.list({
      cursor,
      size: 100,
    })
    const uploadsInPage = selectedRoots
      ? page.results.filter((upload) =>
          selectedRoots.has(upload.root.toString())
        )
      : page.results

    // Phase 1: list all shards for all uploads in the page
    const uploadsWithShards = await pMap(
      uploadsInPage,
      async (upload) => {
        const root = upload.root.toString()
        const shards = await listShardsFromStore(client, upload.root)
        return { root, shards }
      },
      { concurrency: shardListConcurrency }
    )

    // Phase 2: batch-query claims for the entire page — one HTTP call
    const allShards = uploadsWithShards.flatMap((u) => u.shards)
    const claimsIndex = await batchResolveClaims(indexer, allShards)

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

    checkpointInventoryPage(state, {
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

    yield /** @type {MigrationEvent} */ ({ type: 'state:checkpoint', state })
  } while (cursor)

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
 * @returns {Promise<ShardEntry[]>}
 */
async function listShardsFromStore(client, root) {
  /** @type {ShardEntry[]} */
  const shards = []
  let cursor
  do {
    const page = await client.capability.upload.shard.list(root, { cursor })
    for (const link of page.results) {
      const b58 = base58btc.encode(link.multihash.bytes)
      shards.push({ cidStr: link.toString(), multihash: link.multihash, b58 })
    }
    cursor = page.cursor
  } while (cursor)
  return shards
}

// ── Batch claim resolution ────────────────────────────────────────────────────

/**
 * Query claims for all shards in one HTTP call and build a lookup index.
 *
 * Returns a Map keyed by b58 multihash → { locationURL, piece, size }.
 *
 * @param {IndexingServiceReader} indexer
 * @param {ShardEntry[]} shards
 * @returns {Promise<Map<string, ClaimsEntry>>}
 */
async function batchResolveClaims(indexer, shards) {
  /** @type {Map<string, ClaimsEntry>} */
  const index = new Map()

  if (shards.length === 0) return index

  const requestedShardB58s = new Set(shards.map((shard) => shard.b58))

  const claimsResult = await indexer.queryClaims({
    hashes: shards.map((s) => s.multihash),
    kind: 'standard',
  })

  if (!claimsResult.ok) return index

  for (const claim of claimsResult.ok.claims.values()) {
    if (claim.type === 'assert/location') {
      const bytes =
        'digest' in claim.content
          ? claim.content.digest
          : claim.content.multihash.bytes
      const b58 = base58btc.encode(bytes)
      // Ignore location claims for hashes outside the requested shard set,
      // such as index-blob claims returned alongside shard claims.
      if (!requestedShardB58s.has(b58)) continue

      const locationURL = claim.location[0]?.toString()
      if (!locationURL) continue

      const entry = getOrCreateClaimsEntry(index, b58)
      if (entry.locationURL !== null) continue

      entry.locationURL = locationURL
      entry.size = claim.range ? BigInt(claim.range.length ?? 0) : 0n
      index.set(b58, entry)
    } else if (claim.type === 'assert/equals') {
      const bytes =
        'digest' in claim.content
          ? claim.content.digest
          : claim.content.multihash.bytes
      const b58 = base58btc.encode(bytes)
      if (!requestedShardB58s.has(b58)) continue

      let piece
      try {
        piece = Piece.fromLink(/** @type {PieceLink} */ (claim.equals))
      } catch {
        // not a piece CID — skip
        continue
      }

      const entry = getOrCreateClaimsEntry(index, b58)
      if (entry.piece !== null) continue

      entry.piece = piece
      index.set(b58, entry)
    }
  }

  return index
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
    storeShard.sourceURL = resolver.resolve(storeShard)
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
 * @param {Map<string, ClaimsEntry>} index
 * @param {string} b58
 * @returns {ClaimsEntry}
 */
function getOrCreateClaimsEntry(index, b58) {
  const existing = index.get(b58)
  if (existing) return existing

  const created = { locationURL: null, piece: null, size: 0n }
  index.set(b58, created)
  return created
}

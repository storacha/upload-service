import { Piece } from '@web3-storage/data-segment'
import { base58btc } from 'multiformats/bases/base58'
import { Client as IndexingClient } from '@storacha/indexing-service-client'
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
 *  ShardEntry,
 *  ClaimsEntry,
 *  PieceView,
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
  options,
}) {
  const indexer =
    options?.indexer ?? new IndexingClient({ serviceURL: options?.serviceURL })
  const stopOnError = options?.stopOnError ?? true
  const dids = spaceDIDs ?? client.spaces().map((s) => s.did())

  for (const did of dids) {
    // Space already fully read — skip
    if (state.spacesInventories[did] && !state.readerProgressCursors?.[did]) {
      continue
    }

    yield* buildSpaceInventory({
      client,
      indexer,
      resolver,
      spaceDID: did,
      state,
      stopOnError,
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
 * @param {boolean} args.stopOnError
 * @returns {AsyncGenerator<MigrationEvent>}
 */
async function* buildSpaceInventory({
  client,
  indexer,
  resolver,
  spaceDID,
  state,
  stopOnError,
}) {
  yield { type: 'reader:space:start', spaceDID }

  await client.setCurrentSpace(spaceDID)

  let cursor = state.readerProgressCursors?.[spaceDID]

  do {
    const page = await client.capability.upload.list({
      cursor,
      size: 100,
    })

    // Phase 1: list all shards for all uploads in the page
    /** @type {Array<{ root: string; shards: ShardEntry[] }>} */
    const uploadsWithShards = []
    for (const upload of page.results) {
      const root = upload.root.toString()
      const shards = await listShardsFromStore(client, upload.root)
      uploadsWithShards.push({ root, shards })
    }

    // Phase 2: batch-query claims for the entire page — one HTTP call
    const allShards = uploadsWithShards.flatMap((u) => u.shards)
    const claimsIndex = await batchResolveClaims(indexer, allShards)

    // Phase 3: extract per-shard results from the claims index (pure, no I/O)
    /** @type {ResolvedShard[]} */
    const pageShards = []
    /** @type {string[]} */
    const pageUploadRoots = []
    /** @type {string[]} */
    const pageFailedRoots = []
    let pageBytes = 0n

    for (const { root, shards } of uploadsWithShards) {
      /** @type {ResolvedShard[]} */
      const resolved = []
      let uploadFailed = false

      for (const shard of shards) {
        const result = extractShard(claimsIndex, shard, root, resolver)
        if (result.ok) {
          resolved.push(result.ok)
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
        pageFailedRoots.push(root)
      } else {
        pageUploadRoots.push(root)
        for (const s of resolved) {
          pageShards.push(s)
          pageBytes += s.sizeBytes
        }
      }
    }

    cursor = page.cursor

    checkpointInventoryPage(state, {
      spaceDID,
      shards: pageShards,
      uploads: pageUploadRoots,
      failedUploads: pageFailedRoots,
      totalBytes: pageBytes,
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
 * Returns a Map keyed by b58 multihash → { locationURL, piece }.
 *
 * @param {IndexingServiceReader} indexer
 * @param {ShardEntry[]} shards
 * @returns {Promise<Map<string, ClaimsEntry>>}
 */
async function batchResolveClaims(indexer, shards) {
  /** @type {Map<string, ClaimsEntry>} */
  const index = new Map()

  if (shards.length === 0) return index

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
      const entry = index.get(b58) ?? { locationURL: null, piece: null }
      if (entry.locationURL === null) {
        // Match by shard multihash — filters out index-blob location claims
        for (const shard of shards) {
          if (shard.b58 === b58) {
            entry.locationURL = claim.location[0]?.toString() ?? null
            index.set(b58, entry)
            break
          }
        }
      }
    }
    if (claim.type === 'assert/equals') {
      const bytes =
        'digest' in claim.content
          ? claim.content.digest
          : claim.content.multihash.bytes
      const b58 = base58btc.encode(bytes)
      const entry = index.get(b58) ?? { locationURL: null, piece: null }
      if (entry.piece === null) {
        try {
          entry.piece = Piece.fromLink(/** @type {PieceLink} */ (claim.equals))
          index.set(b58, entry)
        } catch {
          // not a piece CID — skip
        }
      }
    }
  }

  return index
}

// ── Per-shard extraction ──────────────────────────────────────────────────────

/**
 * Extract a ResolvedShard from the pre-built claims index.
 * Pure function — no network calls.
 *
 * @param {Map<string, ClaimsEntry>} claimsIndex
 * @param {ShardEntry} shard
 * @param {string} root
 * @param {SourceURLResolver} resolver
 */
function extractShard(claimsIndex, shard, root, resolver) {
  const entry = claimsIndex.get(shard.b58)

  if (!entry?.piece) {
    return { error: `Missing piece CID: shard ${shard.cidStr}` }
  }
  if (!entry.locationURL) {
    return { error: `Missing location URL: shard ${shard.cidStr}` }
  }

  /** @type {ResolvedShard} */
  const resolved = {
    root,
    cid: shard.cidStr,
    pieceCID: entry.piece.link.toString(),
    sourceURL: entry.locationURL,
    sizeBytes: entry.piece.size,
  }
  resolved.sourceURL = resolver.resolve(resolved)

  return { ok: resolved }
}

import { Piece } from '@web3-storage/data-segment'
import { base58btc } from 'multiformats/bases/base58'
import { Client as IndexingClient } from '@storacha/indexing-service-client'
import { MissingPieceCIDFailure, MissingLocationURLFailure } from './errors.js'
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
 *   reader:space:start    — before the first page of each space
 *   reader:space:complete — after the last page of each space
 *   state:checkpoint      — after every upload.list page (persist on this event)
 *   reader:complete       — after all spaces; state.phase set to 'planning'
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
 * Builds pageUploads as a Record during the natural shard-resolution pass,
 * appending shards to an existing root entry if encountered more than once.
 * Aggregates (totalShards, totalBytes) are accumulated in the same loop —
 * no extra iteration needed in checkpointInventoryPage.
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

    /** @type {Record<string, { shards: ResolvedShard[] }>} */
    const pageUploads = {}
    /** @type {Record<string, Array<{ cid: string; reason: string }>>} */
    const pageFailedUploads = {}
    let pageShards = 0
    let pageBytes = 0n

    for (const upload of page.results) {
      const shards = await listShardsFromStore(client, upload.root)
      const root = upload.root.toString()

      /** @type {ResolvedShard[]} */
      const resolvedShards = []
      /** @type {Array<{ cid: string; reason: string }>} */
      const uploadSkipped = []

      for (const shard of shards) {
        const result = await resolveShard(indexer, shard, resolver)
        if (result.ok) {
          resolvedShards.push(result.ok)
        } else {
          uploadSkipped.push({ cid: shard.cidStr, reason: result.error.describe() })
          // stopOnError: no need to resolve remaining shards — upload is already corrupted
          if (stopOnError) break
        }
      }

      if (uploadSkipped.length > 0) {
        pageFailedUploads[root] = uploadSkipped
      } else {
        pageUploads[root] = { shards: resolvedShards }
        pageShards += resolvedShards.length
        for (const s of resolvedShards) pageBytes += s.sizeBytes
      }
    }

    cursor = page.cursor

    checkpointInventoryPage(state, {
      spaceDID,
      uploads: pageUploads,
      failedUploads: pageFailedUploads,
      totalShards: pageShards,
      totalBytes: pageBytes,
      cursor,
    })

    yield { type: 'state:checkpoint', state }
  } while (cursor)

  yield { type: 'reader:space:complete', spaceDID }
}

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

/**
 * Resolve a shard's pieceCID, sizeBytes, and sourceURL from indexing service claims.
 * The resolver is applied to produce the final sourceURL.
 *
 * @param {IndexingServiceReader} indexer
 * @param {ShardEntry} shard
 * @param {SourceURLResolver} resolver
 */
async function resolveShard(indexer, shard, resolver) {
  /** @type {string | null} */
  let locationURL = null
  /** @type {PieceView | null} */
  let piece = null

  const claimsResult = await indexer.queryClaims({
    hashes: [shard.multihash],
    kind: 'standard',
  })
  if (claimsResult.ok) {
    for (const claim of claimsResult.ok.claims.values()) {
      if (claim.type === 'assert/location' && locationURL === null) {
        const bytes =
          'digest' in claim.content
            ? claim.content.digest
            : claim.content.multihash.bytes
        const claimMhB58 = base58btc.encode(bytes)
        if (claimMhB58 === shard.b58) {
          locationURL = claim.location[0]?.toString() ?? null
        }
      }
      if (claim.type === 'assert/equals' && piece === null) {
        try {
          piece = Piece.fromLink(/** @type {PieceLink} */ (claim.equals))
        } catch {
          // not a piece CID
        }
      }
    }
  }

  if (!piece) {
    return { error: new MissingPieceCIDFailure(`shard ${shard.cidStr}`) }
  }
  if (!locationURL) {
    return { error: new MissingLocationURLFailure(`shard ${shard.cidStr}`) }
  }

  const resolved = {
    cid: shard.cidStr,
    pieceCID: piece.link.toString(),
    sourceURL: locationURL,
    sizeBytes: piece.size,
  }
  resolved.sourceURL = resolver.resolve(resolved)

  return { ok: resolved }
}

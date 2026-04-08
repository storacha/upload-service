import { Piece } from '@web3-storage/data-segment'
import { base58btc } from 'multiformats/bases/base58'
import { MissingPieceCIDFailure, MissingLocationURLFailure } from './errors.js'

/**
 * @import * as API from './api.js'
 */

/**
 * Build migration inventories for multiple spaces.
 *
 * When `spaceDIDs` is omitted, iterates all spaces the client has access to
 * via `client.spaces()`. Pass an explicit list to migrate a subset only.
 *
 * Spaces are processed sequentially — keeps memory bounded and makes
 * per-space progress straightforward for the caller.
 *
 * @param {import('@storacha/client').Client} client - Authenticated @storacha/client instance
 * @param {API.IndexingServiceReader} indexer - Indexing service claim reader
 * @param {API.SourceURLResolver} resolver - Resolves the final sourceURL for each shard
 * @param {API.SpaceDID[]} [spaceDIDs] - Defaults to all spaces on the client
 * @returns {Promise<API.SpaceInventory[]>}
 */
export async function buildMigrationInventories(
  client,
  indexer,
  resolver,
  spaceDIDs
) {
  const dids = spaceDIDs ?? client.spaces().map((s) => s.did())
  const inventories = []
  for (const did of dids) {
    inventories.push(
      await buildMigrationInventory(client, indexer, resolver, did)
    )
  }
  return inventories
}

/**
 * Build a complete migration inventory for a single Storacha space.
 *
 * Paginates uploads and processes each page immediately — no buffering.
 * Shards are resolved via indexing service claims as each upload is encountered.
 * The resolver is applied inline so sourceURLs are final on the returned inventory.
 *
 * @param {import('@storacha/client').Client} client - Authenticated @storacha/client instance
 * @param {API.IndexingServiceReader} indexer - Indexing service claim reader
 * @param {API.SourceURLResolver} resolver - Resolves the final sourceURL for each shard
 * @param {API.SpaceDID} spaceDID - Space to inventory
 * @returns {Promise<API.SpaceInventory>}
 */
export async function buildMigrationInventory(
  client,
  indexer,
  resolver,
  spaceDID
) {
  await client.setCurrentSpace(spaceDID)

  /** @type {API.SpaceInventory['uploads']} */
  const uploads = []
  /** @type {API.SpaceInventory['skippedShards']} */
  const skippedShards = []
  let totalShards = 0
  let totalBytes = 0n

  let uploadCursor
  do {
    const page = await client.capability.upload.list({
      cursor: uploadCursor,
      size: 100,
    })

    for (const upload of page.results) {
      const shards = await listShardsFromStore(client, upload.root)

      /** @type {API.ResolvedShard[]} */
      const resolvedShards = []
      for (const shard of shards) {
        const result = await resolveShard(indexer, shard, resolver)
        if (result.ok) {
          resolvedShards.push(result.ok)
          totalBytes += result.ok.sizeBytes
        } else {
          skippedShards.push({ cid: shard.cidStr, reason: result.error.reason })
        }
      }

      totalShards += resolvedShards.length
      uploads.push({ root: upload.root.toString(), shards: resolvedShards })
    }

    uploadCursor = page.cursor
  } while (uploadCursor)

  return {
    did: spaceDID,
    uploads,
    skippedShards,
    totalUploads: uploads.length,
    totalShards,
    totalBytes,
  }
}

/**
 * Paginate shard CIDs from the upload table for a given upload root.
 *
 * @param {import('@storacha/client').Client} client
 * @param {API.UnknownLink} root
 * @returns {Promise<API.ShardEntry[]>}
 */
async function listShardsFromStore(client, root) {
  /** @type {API.ShardEntry[]} */
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
 * @param {API.IndexingServiceReader} indexer
 * @param {API.ShardEntry} shard
 * @param {API.SourceURLResolver} resolver
 */
async function resolveShard(indexer, shard, resolver) {
  /** @type {string | null} */
  let locationURL = null
  /** @type {API.PieceView | null} */
  let piece = null

  const claimsResult = await indexer.queryClaims({
    hashes: [shard.multihash],
    kind: 'standard',
  })
  if (claimsResult.ok) {
    for (const claim of claimsResult.ok.claims.values()) {
      if (claim.type === 'assert/location' && locationURL === null) {
        // Filter out index-blob location claims by comparing content multihash
        const claimMhB58 = base58btc.encode(claim.content.multihash.bytes)
        if (claimMhB58 === shard.b58) {
          locationURL = claim.location[0]?.toString() ?? null
        }
      }
      if (claim.type === 'assert/equals' && piece === null) {
        try {
          piece = Piece.fromLink(/** @type {API.PieceLink} */ (claim.equals))
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

  const partial = {
    cid: shard.cidStr,
    pieceCID: piece.link.toString(),
    sourceURL: locationURL,
    sizeBytes: piece.size,
  }

  return { ok: { ...partial, sourceURL: resolver.resolve(partial) } }
}

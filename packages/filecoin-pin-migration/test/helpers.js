import * as Link from 'multiformats/link'
import * as raw from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'
import { base58btc } from 'multiformats/bases/base58'
import { Piece, MIN_PAYLOAD_SIZE } from '@web3-storage/data-segment'

/**
 * @import * as API from '../src/api.js'
 */

/**
 * Create a deterministic CID from a label string.
 *
 * @param {string} label
 */
export async function createTestCID(label) {
  const digest = await sha256.digest(new TextEncoder().encode(label))
  return Link.create(raw.code, digest)
}

/**
 * Create a valid PieceCIDv2 that Piece.fromLink() accepts.
 */
export function createPieceCID() {
  const bytes = new Uint8Array(MIN_PAYLOAD_SIZE)
  return Piece.fromPayload(bytes).link
}

/**
 * Create a mock @storacha/client instance for reader tests.
 *
 * @param {Array<{ results: Array<{ root: API.UnknownLink }>, cursor?: string }>} uploadPages
 * @param {Map<string, API.UnknownLink[]>} [shardsByRoot]
 * @param {API.SpaceDID[]} [spaces]
 */
export function createMockClient(
  uploadPages,
  shardsByRoot = new Map(),
  spaces = []
) {
  return /** @type {import('@storacha/client').Client} */ ({
    spaces() {
      return spaces.map((did) => ({ did: () => did }))
    },
    async setCurrentSpace(_did) {},
    capability: {
      upload: {
        async list(options) {
          const idx = options?.cursor ? parseInt(options.cursor) : 0
          return uploadPages[idx] ?? { results: [] }
        },
        shard: {
          async list(root, _options) {
            return { results: shardsByRoot.get(root.toString()) ?? [] }
          },
        },
      },
    },
  })
}

/**
 * Build a claims map keyed by base58btc multihash for a shard.
 *
 * @param {API.UnknownLink} shardCid
 * @param {{ locationURLs?: string[], pieceCid?: API.UnknownLink }} opts
 */
export function buildShardClaims(shardCid, opts = {}) {
  const claims = new Map()

  if (opts.locationURLs) {
    claims.set('location-claim', {
      type: 'assert/location',
      content: { multihash: shardCid.multihash },
      location: opts.locationURLs.map((u) => new URL(u)),
    })
  }

  if (opts.pieceCid) {
    claims.set('equals-claim', {
      type: 'assert/equals',
      content: { multihash: shardCid.multihash },
      equals: opts.pieceCid,
    })
  }

  return claims
}

/**
 * Create a mock IndexingServiceReader for tests.
 *
 * Supports batch hashes — builds a merged claims map from all matching hashes.
 *
 * @param {Map<string, { claims: Map<string, unknown>, indexes?: Map<string, unknown> }>} responses - keyed by base58btc multihash
 * @returns {API.IndexingServiceReader}
 */
export function createMockIndexer(responses) {
  return /** @type {API.IndexingServiceReader} */ ({
    async queryClaims({ hashes }) {
      // Merge claims from all queried hashes into one response
      const mergedClaims = new Map()
      const mergedIndexes = new Map()
      for (const hash of hashes) {
        const key = base58btc.encode(hash.bytes)
        const res = responses.get(key)
        if (res) {
          for (const [k, v] of res.claims) {
            mergedClaims.set(`${key}:${k}`, v)
          }
          if (res.indexes) {
            for (const [k, v] of res.indexes) {
              mergedIndexes.set(k, v)
            }
          }
        }
      }
      return {
        ok: /** @type {import('@storacha/indexing-service-client/api').QueryOk} */ ({
          claims: mergedClaims,
          indexes: mergedIndexes,
        }),
      }
    },
  })
}

/**
 * Create a mock SpaceInventory for planner tests.
 *
 * @param {{
 *   did?: API.SpaceDID
 *   name?: string
 *   shards?: API.ResolvedShard[]
 *   shardsToStore?: API.StoreShard[]
 *   uploads?: string[]
 *   skippedUploads?: string[]
 *   totalBytes?: bigint
 *   totalSizeToMigrate?: bigint
 * }} [opts]
 * @returns {API.SpaceInventory}
 */
export function createMockInventory(opts = {}) {
  const pieceCID = createPieceCID()
  const defaultShards = [
    {
      root: 'bafyroot1',
      cid: 'bafyshard1',
      pieceCID: pieceCID.toString(),
      sourceURL: 'https://r2.example/shard1',
      sizeBytes: 1024n,
    },
    {
      root: 'bafyroot1',
      cid: 'bafyshard2',
      pieceCID: pieceCID.toString(),
      sourceURL: 'https://r2.example/shard2',
      sizeBytes: 2048n,
    },
  ]
  const shards = opts.shards ?? defaultShards
  const shardsToStore = opts.shardsToStore ?? []
  const uploads = opts.uploads ?? ['bafyroot1']
  return {
    did: opts.did ?? /** @type {API.SpaceDID} */ ('did:key:z6MkTestSpace1'),
    ...(opts.name !== undefined ? { name: opts.name } : {}),
    shards,
    shardsToStore,
    uploads,
    skippedUploads: opts.skippedUploads ?? [],
    totalBytes:
      opts.totalBytes ??
      [...shards, ...shardsToStore].reduce((n, s) => n + s.sizeBytes, 0n),
    totalSizeToMigrate:
      opts.totalSizeToMigrate ??
      [...shards, ...shardsToStore].reduce((n, s) => n + s.sizeBytes, 0n),
  }
}

/**
 * Create a fresh MigrationState for tests (equivalent to createInitialState).
 *
 * @returns {API.MigrationState}
 */
export function createMockInitialState() {
  return /** @type {API.MigrationState} */ ({
    phase: 'reading',
    spaces: {},
    spacesInventories: {},
    readerProgressCursors: undefined,
  })
}

/**
 * Create an array of mock SpaceInventory for multi-space planner tests.
 *
 * @param {number} [count]
 * @param {{ skippedUploads?: string[] }} [opts]
 * @returns {API.SpaceInventory[]}
 */
export function createMockInventories(count = 1, opts = {}) {
  return Array.from({ length: count }, (_, i) =>
    createMockInventory({
      did: /** @type {API.SpaceDID} */ (`did:key:z6MkTestSpace${i + 1}`),
      ...opts,
    })
  )
}

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
 * The mock satisfies the structural queryClaims contract but returns a plain
 * object instead of the full QueryOk class (which requires IPLD internals).
 * Casting to API.IndexingServiceReader is safe — the reader only accesses
 * .ok.claims and iterates claim fields; it never calls .archive() or .root.
 *
 * @param {Map<string, { claims: Map<string, unknown>, indexes?: Map<string, unknown> }>} responses - keyed by base58btc multihash
 * @returns {API.IndexingServiceReader}
 */
export function createMockIndexer(responses) {
  return /** @type {API.IndexingServiceReader} */ ({
    async queryClaims({ hashes }) {
      const key = base58btc.encode(hashes[0].bytes)
      const res = responses.get(key)
      if (res) {
        return {
          ok: /** @type {import('@storacha/indexing-service-client/api').QueryOk} */ ({
            claims: res.claims,
            indexes: res.indexes ?? new Map(),
          }),
        }
      }
      return {
        ok: /** @type {import('@storacha/indexing-service-client/api').QueryOk} */ ({
          claims: new Map(),
          indexes: new Map(),
        }),
      }
    },
  })
}

/**
 * Create a mock SpaceInventory for planner tests.
 *
 * @param {{ did?: API.SpaceDID, uploads?: API.SpaceInventory['uploads'], failedUploads?: API.SpaceInventory['failedUploads'] }} [opts]
 * @returns {API.SpaceInventory}
 */
export function createMockInventory(opts = {}) {
  const pieceCID = createPieceCID()
  const uploads = opts.uploads ?? {
    bafyroot1: {
      shards: [
        {
          cid: 'bafyshard1',
          pieceCID: pieceCID.toString(),
          sourceURL: 'https://r2.example/shard1',
          sizeBytes: 1024n,
        },
        {
          cid: 'bafyshard2',
          pieceCID: pieceCID.toString(),
          sourceURL: 'https://r2.example/shard2',
          sizeBytes: 2048n,
        },
      ],
    },
  }
  const uploadEntries = Object.values(uploads)
  return {
    did: opts.did ?? /** @type {API.SpaceDID} */ ('did:key:z6MkTestSpace1'),
    uploads,
    failedUploads: opts.failedUploads ?? {},
    totalUploads: uploadEntries.length,
    totalShards: uploadEntries.reduce((n, u) => n + u.shards.length, 0),
    totalBytes: uploadEntries.reduce(
      (n, u) => u.shards.reduce((m, s) => m + s.sizeBytes, n),
      0n
    ),
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
 * @param {{ failedUploads?: API.SpaceInventory['failedUploads'] }} [opts]
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

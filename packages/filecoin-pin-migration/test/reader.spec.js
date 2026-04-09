import { describe, it, expect } from 'vitest'
import { Piece } from '@web3-storage/data-segment'
import { base58btc } from 'multiformats/bases/base58'

import {
  buildMigrationInventory,
  buildMigrationInventories,
} from '../src/reader.js'
import { ClaimsResolver, RoundaboutResolver } from '../src/source-url.js'
import {
  createTestCID,
  createPieceCID,
  createMockClient,
  createMockIndexer,
  buildShardClaims,
} from './helpers.js'

/**
 * @import * as API from '../src/api.js'
 */

const SPACE_DID = /** @type {API.SpaceDID} */ (
  'did:key:z6MkabnQz8Kcz5nsC65oyXWFXhbbAZQavjg6LYuHgv4YTest'
)

/** Default pass-through resolver — sourceURL is the raw claim URL. */
const claimsResolver = new ClaimsResolver()

describe('buildMigrationInventory', () => {
  it('uses upload table shards as default', async () => {
    const rootCid = await createTestCID('root-a')
    const shardCid = await createTestCID('shard-a')
    const pieceCid = createPieceCID()
    const shardB58 = base58btc.encode(shardCid.multihash.bytes)

    const client = createMockClient(
      [{ results: [{ root: rootCid }] }],
      new Map([[rootCid.toString(), [shardCid]]])
    )

    const indexer = createMockIndexer(
      new Map([
        [
          shardB58,
          {
            claims: buildShardClaims(shardCid, {
              locationURLs: ['https://r2.example/shard-a'],
              pieceCid,
            }),
          },
        ],
      ])
    )

    const inventory = await buildMigrationInventory(
      client,
      indexer,
      claimsResolver,
      SPACE_DID
    )

    expect(inventory.uploads).toHaveLength(1)
    expect(inventory.uploads[0].shards).toHaveLength(1)
    expect(inventory.uploads[0].shards[0].sourceURL).toBe(
      'https://r2.example/shard-a'
    )
    expect(inventory.uploads[0].shards[0].pieceCID).toBe(pieceCid.toString())
  })

  it('filters out index-blob location claims', async () => {
    const rootCid = await createTestCID('root-c')
    const shardCid = await createTestCID('shard-c')
    const indexBlobCid = await createTestCID('index-blob-c')
    const pieceCid = createPieceCID()
    const shardB58 = base58btc.encode(shardCid.multihash.bytes)

    const client = createMockClient(
      [{ results: [{ root: rootCid }] }],
      new Map([[rootCid.toString(), [shardCid]]])
    )

    /** @type {Map<string, API.ReaderClaim>} */
    const claims = new Map([
      // Matching location claim (shard multihash matches)
      [
        'location-shard',
        {
          type: /** @type {const} */ ('assert/location'),
          content: { multihash: shardCid.multihash },
          location: [new URL('https://r2.example/shard')],
        },
      ],
      // Index-blob location claim (different multihash — should be filtered)
      [
        'location-index-blob',
        {
          type: /** @type {const} */ ('assert/location'),
          content: { multihash: indexBlobCid.multihash },
          location: [new URL('https://r2.example/index-blob')],
        },
      ],
      [
        'equals-claim',
        {
          type: /** @type {const} */ ('assert/equals'),
          content: { multihash: shardCid.multihash },
          equals: pieceCid,
        },
      ],
    ])

    const indexer = createMockIndexer(new Map([[shardB58, { claims }]]))
    const inventory = await buildMigrationInventory(
      client,
      indexer,
      claimsResolver,
      SPACE_DID
    )

    expect(inventory.uploads[0].shards).toHaveLength(1)
    expect(inventory.uploads[0].shards[0].sourceURL).toBe(
      'https://r2.example/shard'
    )
  })

  it('extracts pieceCID from assert/equals via Piece.fromLink', async () => {
    const rootCid = await createTestCID('root-d')
    const shardCid = await createTestCID('shard-d')
    const pieceCid = createPieceCID()
    const shardB58 = base58btc.encode(shardCid.multihash.bytes)

    const client = createMockClient(
      [{ results: [{ root: rootCid }] }],
      new Map([[rootCid.toString(), [shardCid]]])
    )

    const indexer = createMockIndexer(
      new Map([
        [
          shardB58,
          {
            claims: buildShardClaims(shardCid, {
              locationURLs: ['https://r2.example/shard-d'],
              pieceCid,
            }),
          },
        ],
      ])
    )

    const inventory = await buildMigrationInventory(
      client,
      indexer,
      claimsResolver,
      SPACE_DID
    )

    expect(inventory.uploads[0].shards[0].pieceCID).toBe(pieceCid.toString())
  })

  it('populates sizeBytes from Piece.fromLink().size', async () => {
    const rootCid = await createTestCID('root-e')
    const shardCid = await createTestCID('shard-e')
    const pieceCid = createPieceCID()
    const shardB58 = base58btc.encode(shardCid.multihash.bytes)

    const client = createMockClient(
      [{ results: [{ root: rootCid }] }],
      new Map([[rootCid.toString(), [shardCid]]])
    )

    const indexer = createMockIndexer(
      new Map([
        [
          shardB58,
          {
            claims: buildShardClaims(shardCid, {
              locationURLs: ['https://r2.example/shard-e'],
              pieceCid,
            }),
          },
        ],
      ])
    )

    const inventory = await buildMigrationInventory(
      client,
      indexer,
      claimsResolver,
      SPACE_DID
    )

    const expectedSize = Piece.fromLink(pieceCid).size
    expect(inventory.uploads[0].shards[0].sizeBytes).toBe(expectedSize)
  })

  it('skips shard missing pieceCID', async () => {
    const rootCid = await createTestCID('root-f')
    const shardCid = await createTestCID('shard-f')
    const shardB58 = base58btc.encode(shardCid.multihash.bytes)

    const client = createMockClient(
      [{ results: [{ root: rootCid }] }],
      new Map([[rootCid.toString(), [shardCid]]])
    )

    // Location claim present, but NO equals claim — no pieceCID
    const indexer = createMockIndexer(
      new Map([
        [
          shardB58,
          {
            claims: buildShardClaims(shardCid, {
              locationURLs: ['https://r2.example/shard-f'],
            }),
          },
        ],
      ])
    )

    const inventory = await buildMigrationInventory(
      client,
      indexer,
      claimsResolver,
      SPACE_DID
    )

    expect(inventory.uploads[0].shards).toHaveLength(0)
    expect(inventory.skippedShards).toHaveLength(1)
    expect(inventory.skippedShards[0].reason).toContain(shardCid.toString())
  })

  it('skips shard missing location URL', async () => {
    const rootCid = await createTestCID('root-g')
    const shardCid = await createTestCID('shard-g')
    const pieceCid = createPieceCID()
    const shardB58 = base58btc.encode(shardCid.multihash.bytes)

    const client = createMockClient(
      [{ results: [{ root: rootCid }] }],
      new Map([[rootCid.toString(), [shardCid]]])
    )

    // Equals claim present, but NO location claim
    const indexer = createMockIndexer(
      new Map([
        [
          shardB58,
          {
            claims: buildShardClaims(shardCid, { pieceCid }),
          },
        ],
      ])
    )

    const inventory = await buildMigrationInventory(
      client,
      indexer,
      claimsResolver,
      SPACE_DID
    )

    expect(inventory.uploads[0].shards).toHaveLength(0)
    expect(inventory.skippedShards).toHaveLength(1)
    expect(inventory.skippedShards[0].reason).toContain(shardCid.toString())
  })

  it('paginates through multiple upload pages', async () => {
    const rootA = await createTestCID('root-page-a')
    const rootB = await createTestCID('root-page-b')
    const shardA = await createTestCID('shard-page-a')
    const shardB = await createTestCID('shard-page-b')
    const pieceCid = createPieceCID()
    const shardAB58 = base58btc.encode(shardA.multihash.bytes)
    const shardBB58 = base58btc.encode(shardB.multihash.bytes)

    const client = createMockClient(
      [
        {
          results: [{ root: rootA }],
          cursor: '1',
        },
        { results: [{ root: rootB }] },
      ],
      new Map([
        [rootA.toString(), [shardA]],
        [rootB.toString(), [shardB]],
      ])
    )

    const indexer = createMockIndexer(
      new Map([
        [
          shardAB58,
          {
            claims: buildShardClaims(shardA, {
              locationURLs: ['https://r2.example/shard-a'],
              pieceCid,
            }),
          },
        ],
        [
          shardBB58,
          {
            claims: buildShardClaims(shardB, {
              locationURLs: ['https://r2.example/shard-b'],
              pieceCid,
            }),
          },
        ],
      ])
    )

    const inventory = await buildMigrationInventory(
      client,
      indexer,
      claimsResolver,
      SPACE_DID
    )

    expect(inventory.uploads).toHaveLength(2)
    expect(inventory.uploads[0].shards).toHaveLength(1)
    expect(inventory.uploads[1].shards).toHaveLength(1)
  })

  it('applies ClaimsResolver — sourceURL is the raw claim URL', async () => {
    const rootCid = await createTestCID('root-resolver-claims')
    const shardCid = await createTestCID('shard-resolver-claims')
    const pieceCid = createPieceCID()
    const shardB58 = base58btc.encode(shardCid.multihash.bytes)

    const client = createMockClient(
      [{ results: [{ root: rootCid }] }],
      new Map([[rootCid.toString(), [shardCid]]])
    )
    const indexer = createMockIndexer(
      new Map([
        [
          shardB58,
          {
            claims: buildShardClaims(shardCid, {
              locationURLs: ['https://r2.example/shard-claims'],
              pieceCid,
            }),
          },
        ],
      ])
    )

    const inventory = await buildMigrationInventory(
      client,
      indexer,
      new ClaimsResolver(),
      SPACE_DID
    )

    expect(inventory.uploads[0].shards[0].sourceURL).toBe(
      'https://r2.example/shard-claims'
    )
  })

  it('applies RoundaboutResolver — sourceURL is built from pieceCID', async () => {
    const rootCid = await createTestCID('root-resolver-roundabout')
    const shardCid = await createTestCID('shard-resolver-roundabout')
    const pieceCid = createPieceCID()
    const shardB58 = base58btc.encode(shardCid.multihash.bytes)

    const client = createMockClient(
      [{ results: [{ root: rootCid }] }],
      new Map([[rootCid.toString(), [shardCid]]])
    )
    const indexer = createMockIndexer(
      new Map([
        [
          shardB58,
          {
            claims: buildShardClaims(shardCid, {
              locationURLs: ['https://r2.example/shard-roundabout'],
              pieceCid,
            }),
          },
        ],
      ])
    )

    const inventory = await buildMigrationInventory(
      client,
      indexer,
      new RoundaboutResolver(),
      SPACE_DID
    )

    const shard = inventory.uploads[0].shards[0]
    expect(shard.sourceURL).toMatch(
      /^https:\/\/roundabout\.web3\.storage\/piece\//
    )
    expect(shard.sourceURL).toContain(pieceCid.toString())
    expect(shard.sourceURL).not.toBe('https://r2.example/shard-roundabout')
  })
})

describe('buildMigrationInventories', () => {
  it('builds inventories for all client spaces when no DID list is passed', async () => {
    const rootA = await createTestCID('root-spaces-a')
    const rootB = await createTestCID('root-spaces-b')
    const shardA = await createTestCID('shard-spaces-a')
    const shardB = await createTestCID('shard-spaces-b')
    const pieceCid = createPieceCID()
    const shardAB58 = base58btc.encode(shardA.multihash.bytes)
    const shardBB58 = base58btc.encode(shardB.multihash.bytes)

    const spaceA = /** @type {API.SpaceDID} */ ('did:key:z6MkSpaceA')
    const spaceB = /** @type {API.SpaceDID} */ ('did:key:z6MkSpaceB')

    // Custom mock: tracks current space so each space gets its own upload page
    /** @type {API.SpaceDID } */
    let currentSpace
    const uploadsBySpace = new Map([
      [spaceA, [rootA]],
      [spaceB, [rootB]],
    ])
    /** @type {Map<string, API.UnknownLink[]>} */
    const shardsByRoot = new Map([
      [rootA.toString(), [shardA]],
      [rootB.toString(), [shardB]],
    ])
    const client = /** @type {import('@storacha/client').Client} */ ({
      spaces() {
        return [{ did: () => spaceA }, { did: () => spaceB }]
      },
      async setCurrentSpace(did) {
        currentSpace = /** @type {API.SpaceDID} */ (did)
      },
      capability: {
        upload: {
          async list(_options) {
            const roots = uploadsBySpace.get(currentSpace) ?? []
            return { results: roots.map((root) => ({ root })) }
          },
          shard: {
            async list(root, _options) {
              return { results: shardsByRoot.get(root.toString()) ?? [] }
            },
          },
        },
      },
    })

    const indexer = createMockIndexer(
      new Map([
        [
          shardAB58,
          {
            claims: buildShardClaims(shardA, {
              locationURLs: ['https://r2.example/shard-a'],
              pieceCid,
            }),
          },
        ],
        [
          shardBB58,
          {
            claims: buildShardClaims(shardB, {
              locationURLs: ['https://r2.example/shard-b'],
              pieceCid,
            }),
          },
        ],
      ])
    )

    const inventories = await buildMigrationInventories(
      client,
      indexer,
      claimsResolver
    )

    expect(inventories).toHaveLength(2)
    expect(inventories[0].did).toBe(spaceA)
    expect(inventories[1].did).toBe(spaceB)
    expect(inventories[0].uploads).toHaveLength(1)
    expect(inventories[1].uploads).toHaveLength(1)
  })

  it('builds inventories only for the specified space DIDs', async () => {
    const rootA = await createTestCID('root-filter-a')
    const shardA = await createTestCID('shard-filter-a')
    const pieceCid = createPieceCID()
    const shardAB58 = base58btc.encode(shardA.multihash.bytes)

    const spaceA = /** @type {API.SpaceDID} */ ('did:key:z6MkFilterA')
    const spaceB = /** @type {API.SpaceDID} */ ('did:key:z6MkFilterB')

    // spaceB is registered on the client but excluded from the explicit DID list
    const client = createMockClient(
      [{ results: [{ root: rootA }] }],
      new Map([[rootA.toString(), [shardA]]]),
      [spaceA, spaceB]
    )

    const indexer = createMockIndexer(
      new Map([
        [
          shardAB58,
          {
            claims: buildShardClaims(shardA, {
              locationURLs: ['https://r2.example/shard-a'],
              pieceCid,
            }),
          },
        ],
      ])
    )

    // Pass only spaceA — spaceB should be skipped entirely
    const inventories = await buildMigrationInventories(
      client,
      indexer,
      claimsResolver,
      [spaceA]
    )

    expect(inventories).toHaveLength(1)
    expect(inventories[0].did).toBe(spaceA)
  })
})

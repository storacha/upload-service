import { describe, it, expect, afterEach } from 'vitest'
import { Piece } from '@web3-storage/data-segment'
import { base58btc } from 'multiformats/bases/base58'

import { buildMigrationInventories } from '../src/reader/reader.js'
import { deserializeState, serializeState } from '../src/state.js'
import { ClaimsResolver, RoundaboutResolver } from '../src/reader/source-url.js'
import {
  createTestCID,
  createPieceCID,
  createMockClient,
  createMockIndexer,
  createMockFetch,
  createMockFallbackFetch,
  buildShardClaims,
  createTestStore,
} from './helpers.js'

/**
 * @import * as API from '../src/api.js'
 */

const SPACE_DID = /** @type {API.SpaceDID} */ (
  'did:key:z6MkabnQz8Kcz5nsC65oyXWFXhbbAZQavjg6LYuHgv4YTest'
)

/** Default pass-through resolver — sourceURL is the raw claim URL. */
const claimsResolver = new ClaimsResolver()

/**
 * Collect all events from the reader generator and return the final inventory
 * for the given spaceDID from state.
 *
 * @param {AsyncGenerator<API.MigrationEvent>} gen
 * @param {API.MigrationState} state
 * @param {API.SpaceDID} spaceDID
 */
async function collectInventory(gen, state, spaceDID) {
  for await (const _ of gen) {
    /* drain */
  }
  return state.spacesInventories[spaceDID]
}

function createAbortError() {
  return new DOMException('The operation was aborted.', 'AbortError')
}

describe('buildMigrationInventories', () => {
  /** @type {import('@storacha/filecoin-pin-migration/types').MigrationStore[]} */
  let openStores = []

  afterEach(async () => {
    const stores = openStores
    openStores = []
    for (const s of stores) {
      await s.close()
    }
  })

  /**
   * Open a test store and register it for afterEach cleanup.
   *
   * @param {Parameters<typeof createTestStore>[0]} [opts]
   */
  async function openStore(opts) {
    const store = await createTestStore(opts)
    openStores.push(store)
    return store
  }

  describe('single space — basic inventory', () => {
    it('resolves shards and builds flat inventory with root on each shard', async () => {
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

      const store = await openStore()
      const state = store.getState()
      const inventory = await collectInventory(
        buildMigrationInventories({
          client,
          resolver: claimsResolver,
          store,
          spaceDIDs: [SPACE_DID],
          options: { indexer },
        }),
        state,
        SPACE_DID
      )

      expect(inventory.uploads).toHaveLength(1)
      expect(inventory.uploads[0]).toBe(rootCid.toString())
      expect(inventory.shards).toHaveLength(1)
      expect(inventory.shards[0].root).toBe(rootCid.toString())
      expect(inventory.shards[0].sourceURL).toBe('https://r2.example/shard-a')
      expect(inventory.shards[0].pieceCID).toBe(pieceCid.toString())
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
      const claims = new Map([
        [
          'location-shard',
          {
            type: /** @type {const} */ ('assert/location'),
            content: { multihash: shardCid.multihash },
            location: [new URL('https://r2.example/shard')],
          },
        ],
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

      const store = await openStore()
      const state = store.getState()
      const inventory = await collectInventory(
        buildMigrationInventories({
          client,
          resolver: claimsResolver,
          store,
          spaceDIDs: [SPACE_DID],
          options: { indexer },
        }),
        state,
        SPACE_DID
      )

      expect(inventory.shards).toHaveLength(1)
      expect(inventory.shards[0].sourceURL).toBe('https://r2.example/shard')
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

      const store = await openStore()
      const state = store.getState()
      const inventory = await collectInventory(
        buildMigrationInventories({
          client,
          resolver: claimsResolver,
          store,
          spaceDIDs: [SPACE_DID],
          options: { indexer },
        }),
        state,
        SPACE_DID
      )

      expect(inventory.shards[0].pieceCID).toBe(pieceCid.toString())
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

      const store = await openStore()
      const state = store.getState()
      const inventory = await collectInventory(
        buildMigrationInventories({
          client,
          resolver: claimsResolver,
          store,
          spaceDIDs: [SPACE_DID],
          options: { indexer },
        }),
        state,
        SPACE_DID
      )

      const expectedSize = Piece.fromLink(pieceCid).size
      expect(inventory.shards[0].sizeBytes).toBe(expectedSize)
    })

    it('excludes upload with missing pieceCID and emits reader:shard:failed', async () => {
      const rootCid = await createTestCID('root-f')
      const shardCid = await createTestCID('shard-f')
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
                locationURLs: ['https://r2.example/shard-f'],
              }),
            },
          ],
        ])
      )

      const store = await openStore()
      const state = store.getState()
      /** @type {API.MigrationEvent[]} */
      const events = []
      for await (const event of buildMigrationInventories({
        client,
        resolver: claimsResolver,
        store,
        spaceDIDs: [SPACE_DID],
        options: { indexer },
      })) {
        events.push(event)
      }
      const inventory = state.spacesInventories[SPACE_DID]

      const rootStr = rootCid.toString()
      expect(inventory.shards).toHaveLength(0)
      expect(inventory.shardsToStore).toHaveLength(1)
      expect(inventory.shardsToStore[0].root).toBe(rootStr)
      expect(inventory.skippedUploads).toHaveLength(0)
      expect(
        events.find((e) => e.type === 'reader:shard:failed')
      ).toBeUndefined()
    })

    it('excludes upload with missing location URL and emits reader:shard:failed', async () => {
      const rootCid = await createTestCID('root-g')
      const shardCid = await createTestCID('shard-g')
      const pieceCid = createPieceCID()
      const shardB58 = base58btc.encode(shardCid.multihash.bytes)

      const client = createMockClient(
        [{ results: [{ root: rootCid }] }],
        new Map([[rootCid.toString(), [shardCid]]])
      )
      const indexer = createMockIndexer(
        new Map([
          [shardB58, { claims: buildShardClaims(shardCid, { pieceCid }) }],
        ])
      )
      const fetcher = createMockFetch(new Map())

      const store = await openStore()
      const state = store.getState()
      /** @type {API.MigrationEvent[]} */
      const events = []
      for await (const event of buildMigrationInventories({
        client,
        resolver: claimsResolver,
        store,
        spaceDIDs: [SPACE_DID],
        options: { indexer, fetcher },
      })) {
        events.push(event)
      }
      const inventory = state.spacesInventories[SPACE_DID]

      const rootStr = rootCid.toString()
      expect(inventory.shards).toHaveLength(0)
      expect(inventory.skippedUploads).toContain(rootStr)

      const shardFailed = events.find((e) => e.type === 'reader:shard:failed')
      if (!shardFailed) {
        throw new Error('expected reader:shard:failed event')
      }
      expect(shardFailed.reason).toContain(shardCid.toString())
    })

    it('repairs missing location URL from carpark and routes missing-piece shards to store', async () => {
      const rootCid = await createTestCID('root-carpark-store')
      const shardCid = await createTestCID('shard-carpark-store')
      const shardB58 = base58btc.encode(shardCid.multihash.bytes)
      const blobUrl = `https://carpark-prod-0.r2.w3s.link/${shardB58}/${shardB58}.blob`

      const client = createMockClient(
        [{ results: [{ root: rootCid }] }],
        new Map([[rootCid.toString(), [shardCid]]])
      )
      const indexer = createMockIndexer(
        new Map([[shardB58, { claims: new Map() }]])
      )
      const fetcher = createMockFallbackFetch({
        headResponses: new Map([[blobUrl, { contentLength: 4096 }]]),
      })

      const store = await openStore()
      const state = store.getState()
      /** @type {API.MigrationEvent[]} */
      const events = []
      for await (const event of buildMigrationInventories({
        client,
        resolver: claimsResolver,
        store,
        spaceDIDs: [SPACE_DID],
        options: { indexer, fetcher },
      })) {
        events.push(event)
      }
      const inventory = state.spacesInventories[SPACE_DID]

      expect(inventory.shards).toHaveLength(0)
      expect(inventory.shardsToStore).toHaveLength(1)
      expect(inventory.shardsToStore[0]).toEqual(
        expect.objectContaining({
          root: rootCid.toString(),
          cid: shardCid.toString(),
          sourceURL: blobUrl,
          sizeBytes: 4096n,
        })
      )
      expect(inventory.skippedUploads).toHaveLength(0)
      expect(
        events.find((e) => e.type === 'reader:shard:failed')
      ).toBeUndefined()
    })

    it('repairs missing location URL from carpark and keeps shards with a piece on the source-pull path', async () => {
      const rootCid = await createTestCID('root-carpark-pull')
      const shardCid = await createTestCID('shard-carpark-pull')
      const pieceCid = createPieceCID()
      const shardB58 = base58btc.encode(shardCid.multihash.bytes)
      const carUrl = `https://carpark-prod-0.r2.w3s.link/${shardCid.toString()}/${shardCid.toString()}.car`

      const client = createMockClient(
        [{ results: [{ root: rootCid }] }],
        new Map([[rootCid.toString(), [shardCid]]])
      )
      const indexer = createMockIndexer(
        new Map([
          [
            shardB58,
            {
              claims: new Map([
                [
                  'equals-claim',
                  {
                    type: /** @type {const} */ ('assert/equals'),
                    content: { multihash: shardCid.multihash },
                    equals: pieceCid,
                  },
                ],
              ]),
            },
          ],
        ])
      )
      const fetcher = createMockFallbackFetch({
        headResponses: new Map([[carUrl, { contentLength: 4096 }]]),
      })

      const store = await openStore()
      const state = store.getState()
      const inventory = await collectInventory(
        buildMigrationInventories({
          client,
          resolver: claimsResolver,
          store,
          spaceDIDs: [SPACE_DID],
          options: { indexer, fetcher },
        }),
        state,
        SPACE_DID
      )

      expect(inventory.shards).toHaveLength(1)
      expect(inventory.shards[0]).toEqual(
        expect.objectContaining({
          root: rootCid.toString(),
          cid: shardCid.toString(),
          pieceCID: pieceCid.toString(),
          sourceURL: carUrl,
          sizeBytes: 4096n,
        })
      )
      expect(inventory.shardsToStore).toHaveLength(0)
      expect(inventory.skippedUploads).toHaveLength(0)
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

      const store = await openStore()
      const state = store.getState()
      const inventory = await collectInventory(
        buildMigrationInventories({
          client,
          resolver: new ClaimsResolver(),
          store,
          spaceDIDs: [SPACE_DID],
          options: { indexer },
        }),
        state,
        SPACE_DID
      )

      expect(inventory.shards[0].sourceURL).toBe(
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

      const store = await openStore()
      const state = store.getState()
      const inventory = await collectInventory(
        buildMigrationInventories({
          client,
          resolver: new RoundaboutResolver(),
          store,
          spaceDIDs: [SPACE_DID],
          options: { indexer },
        }),
        state,
        SPACE_DID
      )

      expect(inventory.shards[0].sourceURL).toMatch(
        /^https:\/\/roundabout\.web3\.storage\/piece\//
      )
      expect(inventory.shards[0].sourceURL).toContain(pieceCid.toString())
      expect(inventory.shards[0].sourceURL).not.toBe(
        'https://r2.example/shard-roundabout'
      )
    })
  })

  describe('pagination', () => {
    it('paginates through multiple upload pages and merges into inventory', async () => {
      const rootA = await createTestCID('root-page-a')
      const rootB = await createTestCID('root-page-b')
      const shardA = await createTestCID('shard-page-a')
      const shardB = await createTestCID('shard-page-b')
      const pieceCid = createPieceCID()
      const shardAB58 = base58btc.encode(shardA.multihash.bytes)
      const shardBB58 = base58btc.encode(shardB.multihash.bytes)

      const client = createMockClient(
        [
          { results: [{ root: rootA }], cursor: '1' },
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

      const store = await openStore()
      const state = store.getState()
      const inventory = await collectInventory(
        buildMigrationInventories({
          client,
          resolver: claimsResolver,
          store,
          spaceDIDs: [SPACE_DID],
          options: { indexer },
        }),
        state,
        SPACE_DID
      )

      expect(inventory.uploads).toHaveLength(2)
      expect(inventory.shards).toHaveLength(2)
      expect(inventory.shards.map((s) => s.root)).toEqual(
        expect.arrayContaining([rootA.toString(), rootB.toString()])
      )
    })

    it('emits state:checkpoint after each page', async () => {
      const rootA = await createTestCID('root-ckpt-a')
      const rootB = await createTestCID('root-ckpt-b')
      const shardA = await createTestCID('shard-ckpt-a')
      const shardB = await createTestCID('shard-ckpt-b')
      const pieceCid = createPieceCID()
      const shardAB58 = base58btc.encode(shardA.multihash.bytes)
      const shardBB58 = base58btc.encode(shardB.multihash.bytes)

      const client = createMockClient(
        [
          { results: [{ root: rootA }], cursor: '1' },
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
                locationURLs: ['https://r2.example/a'],
                pieceCid,
              }),
            },
          ],
          [
            shardBB58,
            {
              claims: buildShardClaims(shardB, {
                locationURLs: ['https://r2.example/b'],
                pieceCid,
              }),
            },
          ],
        ])
      )

      const store = await openStore()
      const state = store.getState()
      const checkpoints = []
      for await (const event of buildMigrationInventories({
        client,
        resolver: claimsResolver,
        store,
        spaceDIDs: [SPACE_DID],
        options: { indexer },
      })) {
        if (event.type === 'state:checkpoint') checkpoints.push(event)
      }

      // one checkpoint per page (2) + one final checkpoint after reader:complete
      expect(checkpoints.length).toBe(3)
    })

    it('can checkpoint less often than every page while still checkpointing before space completion', async () => {
      const rootA = await createTestCID('root-ckpt-throttle-a')
      const rootB = await createTestCID('root-ckpt-throttle-b')
      const shardA = await createTestCID('shard-ckpt-throttle-a')
      const shardB = await createTestCID('shard-ckpt-throttle-b')
      const pieceCid = createPieceCID()
      const shardAB58 = base58btc.encode(shardA.multihash.bytes)
      const shardBB58 = base58btc.encode(shardB.multihash.bytes)

      const client = createMockClient(
        [
          { results: [{ root: rootA }], cursor: '1' },
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
                locationURLs: ['https://r2.example/throttle-a'],
                pieceCid,
              }),
            },
          ],
          [
            shardBB58,
            {
              claims: buildShardClaims(shardB, {
                locationURLs: ['https://r2.example/throttle-b'],
                pieceCid,
              }),
            },
          ],
        ])
      )

      const store = await openStore()
      const state = store.getState()
      const events = []
      for await (const event of buildMigrationInventories({
        client,
        resolver: claimsResolver,
        store,
        spaceDIDs: [SPACE_DID],
        options: {
          indexer,
          checkpointEveryPages: 5,
        },
      })) {
        events.push(event.type)
      }

      expect(events).toEqual([
        'reader:space:start',
        'state:checkpoint',
        'reader:space:complete',
        'reader:complete',
        'state:checkpoint',
      ])
      expect(state.spacesInventories[SPACE_DID]?.uploads).toHaveLength(2)
      expect(state.spacesInventories[SPACE_DID]?.shards).toHaveLength(2)
    })
  })

  describe('multiple spaces', () => {
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

      /** @type {API.SpaceDID} */
      let currentSpace
      const uploadsBySpace = new Map([
        [spaceA, [rootA]],
        [spaceB, [rootB]],
      ])
      const spaceNames = new Map([
        [spaceA, 'Space A'],
        [spaceB, 'Space B'],
      ])
      const shardsByRoot = new Map([
        [rootA.toString(), [shardA]],
        [rootB.toString(), [shardB]],
      ])

      const client = /** @type {import('@storacha/client').Client} */ ({
        spaces() {
          return [{ did: () => spaceA }, { did: () => spaceB }]
        },
        currentSpace() {
          if (!currentSpace) return undefined
          return {
            did: () => currentSpace,
            name: spaceNames.get(currentSpace) ?? '',
          }
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
              /**
               * @param {API.UnknownLink} root
               * @param {unknown} _options
               */
              async list(root, _options) {
                return { results: shardsByRoot.get(`${root}`) ?? [] }
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

      const store = await openStore()
      const state = store.getState()
      for await (const _ of buildMigrationInventories({
        client,
        resolver: claimsResolver,
        store,
        options: { indexer },
      })) {
        /* drain */
      }

      expect(state.spacesInventories[spaceA]).toBeDefined()
      expect(state.spacesInventories[spaceB]).toBeDefined()
      expect(state.spacesInventories[spaceA]).toEqual(
        expect.objectContaining({ name: 'Space A' })
      )
      expect(state.spacesInventories[spaceB]).toEqual(
        expect.objectContaining({ name: 'Space B' })
      )
      expect(state.spacesInventories[spaceA].shards).toHaveLength(1)
      expect(state.spacesInventories[spaceB].shards).toHaveLength(1)
    })

    it('builds inventories only for the specified space DIDs', async () => {
      const rootA = await createTestCID('root-filter-a')
      const shardA = await createTestCID('shard-filter-a')
      const pieceCid = createPieceCID()
      const shardAB58 = base58btc.encode(shardA.multihash.bytes)

      const spaceA = /** @type {API.SpaceDID} */ ('did:key:z6MkFilterA')
      const spaceB = /** @type {API.SpaceDID} */ ('did:key:z6MkFilterB')

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

      const store = await openStore()
      const state = store.getState()
      for await (const _ of buildMigrationInventories({
        client,
        resolver: claimsResolver,
        store,
        spaceDIDs: [spaceA],
        options: { indexer },
      })) {
        /* drain */
      }

      expect(state.spacesInventories[spaceA]).toBeDefined()
      expect(state.spacesInventories[spaceB]).toBeUndefined()
    })
  })

  describe('phase transitions', () => {
    it('sets state.phase to planning after all spaces are read', async () => {
      const rootCid = await createTestCID('root-phase')
      const shardCid = await createTestCID('shard-phase')
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
                locationURLs: ['https://r2.example/shard'],
                pieceCid,
              }),
            },
          ],
        ])
      )

      const store = await openStore()
      const state = store.getState()
      for await (const _ of buildMigrationInventories({
        client,
        resolver: claimsResolver,
        store,
        spaceDIDs: [SPACE_DID],
        options: { indexer },
      })) {
        /* drain */
      }

      expect(state.phase).toBe('planning')
    })

    it('emits reader:complete as last named event', async () => {
      const client = createMockClient([{ results: [] }])
      const indexer = createMockIndexer(new Map())

      const store = await openStore()
      const state = store.getState()
      const events = []
      for await (const event of buildMigrationInventories({
        client,
        resolver: claimsResolver,
        store,
        spaceDIDs: [SPACE_DID],
        options: { indexer },
      })) {
        events.push(event.type)
      }

      expect(events).toContain('reader:complete')
      // reader:complete comes before the final state:checkpoint
      const completeIdx = events.lastIndexOf('reader:complete')
      const lastCheckpointIdx = events.lastIndexOf('state:checkpoint')
      expect(completeIdx).toBeLessThan(lastCheckpointIdx)
    })
  })

  describe('resume', () => {
    it('skips a space already in spacesInventories with no cursor', async () => {
      const spaceA = /** @type {API.SpaceDID} */ ('did:key:z6MkResumeSkip')
      let setCurrentSpaceCalled = false

      const client = /** @type {import('@storacha/client').Client} */ (
        /** @type {unknown} */ ({
          spaces() {
            return []
          },
          async setCurrentSpace() {
            setCurrentSpaceCalled = true
          },
          capability: {
            upload: {
              list: async () => ({ results: [] }),
              shard: { list: async () => ({ results: [] }) },
            },
          },
        })
      )
      const indexer = createMockIndexer(new Map())

      const store = await openStore()
      const state = store.getState()
      // Pre-populate as complete (no cursor)
      state.spacesInventories[spaceA] = {
        did: spaceA,
        uploads: ['bafyroot'],
        shards: [],
        shardsToStore: [],
        skippedUploads: [],
        totalBytes: 0n,
        totalSizeToMigrate: 0n,
      }

      for await (const _ of buildMigrationInventories({
        client,
        resolver: claimsResolver,
        store,
        spaceDIDs: [spaceA],
        options: { indexer },
      })) {
        /* drain */
      }

      expect(setCurrentSpaceCalled).toBe(false)
    })

    it('resumes a space from a saved cursor, preserving already-accumulated shards', async () => {
      const rootA = await createTestCID('root-resume-a')
      const rootB = await createTestCID('root-resume-b')
      const shardA = await createTestCID('shard-resume-a')
      const shardB = await createTestCID('shard-resume-b')
      const pieceCid = createPieceCID()
      const shardAB58 = base58btc.encode(shardA.multihash.bytes)
      const shardBB58 = base58btc.encode(shardB.multihash.bytes)

      // Mock returns page 0 at cursor undefined, page 1 at cursor '1'
      const client = createMockClient(
        [
          { results: [{ root: rootA }], cursor: '1' },
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
                locationURLs: ['https://r2.example/a'],
                pieceCid,
              }),
            },
          ],
          [
            shardBB58,
            {
              claims: buildShardClaims(shardB, {
                locationURLs: ['https://r2.example/b'],
                pieceCid,
              }),
            },
          ],
        ])
      )

      const store = await openStore()
      const state = store.getState()
      // Simulate a prior partial run: page 0 was processed, cursor '1' was saved
      state.spacesInventories[SPACE_DID] = {
        did: SPACE_DID,
        uploads: [rootA.toString()],
        shards: [
          {
            root: rootA.toString(),
            cid: shardA.toString(),
            pieceCID: pieceCid.toString(),
            sourceURL: 'https://r2.example/a',
            sizeBytes: Piece.fromLink(pieceCid).size,
          },
        ],
        shardsToStore: [],
        skippedUploads: [],
        totalBytes: Piece.fromLink(pieceCid).size,
        totalSizeToMigrate: Piece.fromLink(pieceCid).size,
      }
      state.readerProgressCursors = { [SPACE_DID]: '1' }

      const inventory = await collectInventory(
        buildMigrationInventories({
          client,
          resolver: claimsResolver,
          store,
          spaceDIDs: [SPACE_DID],
          options: { indexer },
        }),
        state,
        SPACE_DID
      )

      // shardA from the pre-populated state + shardB from the resumed page
      expect(inventory.uploads).toHaveLength(2)
      expect(inventory.shards).toHaveLength(2)
      expect(inventory.uploads).toEqual(
        expect.arrayContaining([rootA.toString(), rootB.toString()])
      )
      // Cursor should be cleared after completion
      expect(state.readerProgressCursors).toBeUndefined()
    })

    it('resumes from the last persisted cursor when a crash happens between throttled checkpoints', async () => {
      const rootA = await createTestCID('root-throttle-resume-a')
      const rootB = await createTestCID('root-throttle-resume-b')
      const rootC = await createTestCID('root-throttle-resume-c')
      const rootD = await createTestCID('root-throttle-resume-d')
      const shardA = await createTestCID('shard-throttle-resume-a')
      const shardB = await createTestCID('shard-throttle-resume-b')
      const shardC = await createTestCID('shard-throttle-resume-c')
      const shardD = await createTestCID('shard-throttle-resume-d')
      const pieceCid = createPieceCID()
      const shardAB58 = base58btc.encode(shardA.multihash.bytes)
      const shardBB58 = base58btc.encode(shardB.multihash.bytes)
      const shardCB58 = base58btc.encode(shardC.multihash.bytes)
      const shardDB58 = base58btc.encode(shardD.multihash.bytes)

      const pages = [
        { results: [{ root: rootA }], cursor: '1' },
        { results: [{ root: rootB }], cursor: '2' },
        { results: [{ root: rootC }], cursor: '3' },
        { results: [{ root: rootD }] },
      ]
      const shardsByRoot = new Map([
        [rootA.toString(), [shardA]],
        [rootB.toString(), [shardB]],
        [rootC.toString(), [shardC]],
        [rootD.toString(), [shardD]],
      ])

      const failingClient = /** @type {import('@storacha/client').Client} */ (
        /** @type {unknown} */ ({
          spaces() {
            return [{ did: () => SPACE_DID }]
          },
          currentSpace() {
            return { did: () => SPACE_DID, name: 'Throttle Resume' }
          },
          async setCurrentSpace(/** @type {API.SpaceDID} */ _did) {},
          capability: {
            upload: {
              async list(
                /** @type {{ cursor?: string } | undefined} */ options
              ) {
                if (options?.cursor === '3') {
                  throw new Error(
                    'simulated crash after an uncheckpointed page'
                  )
                }

                if (!options?.cursor) return pages[0]
                return pages[Number(options.cursor)]
              },
              shard: {
                async list(
                  /** @type {API.UnknownLink} */ root,
                  /** @type {unknown} */ _options
                ) {
                  const rootStr = `${root}`
                  return { results: shardsByRoot.get(rootStr) ?? [] }
                },
              },
            },
          },
        })
      )

      const healthyClient = createMockClient(pages, shardsByRoot)
      const indexer = createMockIndexer(
        new Map([
          [
            shardAB58,
            {
              claims: buildShardClaims(shardA, {
                locationURLs: ['https://r2.example/throttle-resume-a'],
                pieceCid,
              }),
            },
          ],
          [
            shardBB58,
            {
              claims: buildShardClaims(shardB, {
                locationURLs: ['https://r2.example/throttle-resume-b'],
                pieceCid,
              }),
            },
          ],
          [
            shardCB58,
            {
              claims: buildShardClaims(shardC, {
                locationURLs: ['https://r2.example/throttle-resume-c'],
                pieceCid,
              }),
            },
          ],
          [
            shardDB58,
            {
              claims: buildShardClaims(shardD, {
                locationURLs: ['https://r2.example/throttle-resume-d'],
                pieceCid,
              }),
            },
          ],
        ])
      )

      const firstRunStore = await openStore()
      /** @type {import('../src/api.js').MigrationState | undefined} */
      let persistedState

      await expect(
        (async () => {
          for await (const event of buildMigrationInventories({
            client: failingClient,
            resolver: claimsResolver,
            store: firstRunStore,
            spaceDIDs: [SPACE_DID],
            options: {
              indexer,
              checkpointEveryPages: 2,
            },
          })) {
            if (event.type === 'state:checkpoint') {
              persistedState = deserializeState(
                JSON.parse(JSON.stringify(serializeState(event.state)))
              )
            }
          }
        })()
      ).rejects.toThrow('simulated crash after an uncheckpointed page')

      await firstRunStore.close()

      expect(persistedState).toBeDefined()
      if (!persistedState) {
        throw new Error('expected a checkpointed state before the crash')
      }

      expect(persistedState.spacesInventories[SPACE_DID]?.uploads).toEqual([
        rootA.toString(),
        rootB.toString(),
      ])
      expect(persistedState.readerProgressCursors).toEqual({ [SPACE_DID]: '2' })

      const resumeStore = await openStore({ state: persistedState })
      const resumeState = resumeStore.getState()
      const resumedInventory = await collectInventory(
        buildMigrationInventories({
          client: healthyClient,
          resolver: claimsResolver,
          store: resumeStore,
          spaceDIDs: [SPACE_DID],
          options: {
            indexer,
            checkpointEveryPages: 2,
          },
        }),
        resumeState,
        SPACE_DID
      )

      await resumeStore.close()

      expect(resumedInventory.uploads).toEqual([
        rootA.toString(),
        rootB.toString(),
        rootC.toString(),
        rootD.toString(),
      ])
      expect(resumedInventory.shards).toHaveLength(4)
      expect(resumeState.readerProgressCursors).toBeUndefined()
    })

    it('reads trusted explicit roots without calling upload.list', async () => {
      const rootA = await createTestCID('root-explicit-a')
      const rootB = await createTestCID('root-explicit-b')
      const shardA = await createTestCID('shard-explicit-a')
      const shardB = await createTestCID('shard-explicit-b')
      const pieceCid = createPieceCID()
      const shardAB58 = base58btc.encode(shardA.multihash.bytes)
      const shardBB58 = base58btc.encode(shardB.multihash.bytes)
      const shardsByRoot = new Map([
        [rootA.toString(), [shardA]],
        [rootB.toString(), [shardB]],
      ])

      let uploadListCalls = 0
      const client = /** @type {import('@storacha/client').Client} */ (
        /** @type {unknown} */ ({
          currentSpace() {
            return { did: () => SPACE_DID, name: 'Explicit Root Space' }
          },
          async setCurrentSpace(/** @type {API.SpaceDID} */ _did) {},
          capability: {
            upload: {
              async list() {
                uploadListCalls += 1
                throw new Error('upload.list should not be called')
              },
              shard: {
                async list(
                  /** @type {API.UnknownLink} */ root,
                  /** @type {unknown} */ _options
                ) {
                  return { results: shardsByRoot.get(`${root}`) ?? [] }
                },
              },
            },
          },
        })
      )
      const indexer = createMockIndexer(
        new Map([
          [
            shardAB58,
            {
              claims: buildShardClaims(shardA, {
                locationURLs: ['https://r2.example/explicit-a'],
                pieceCid,
              }),
            },
          ],
          [
            shardBB58,
            {
              claims: buildShardClaims(shardB, {
                locationURLs: ['https://r2.example/explicit-b'],
                pieceCid,
              }),
            },
          ],
        ])
      )

      const store = await openStore()
      const state = store.getState()
      const inventory = await collectInventory(
        buildMigrationInventories({
          client,
          resolver: claimsResolver,
          store,
          uploadRootsBySpace: {
            [SPACE_DID]: [rootA.toString(), rootB.toString()],
          },
          options: { indexer },
        }),
        state,
        SPACE_DID
      )

      expect(uploadListCalls).toBe(0)
      expect(inventory).toEqual(
        expect.objectContaining({
          did: SPACE_DID,
          name: 'Explicit Root Space',
          uploads: [rootA.toString(), rootB.toString()],
          skippedUploads: [],
        })
      )
      expect(inventory.shards).toHaveLength(2)
    })

    it('uses uploadPageSize as explicit-root chunk size for synthetic cursor checkpoints', async () => {
      const rootA = await createTestCID('root-explicit-chunk-a')
      const rootB = await createTestCID('root-explicit-chunk-b')
      const rootC = await createTestCID('root-explicit-chunk-c')
      const shardA = await createTestCID('shard-explicit-chunk-a')
      const shardB = await createTestCID('shard-explicit-chunk-b')
      const shardC = await createTestCID('shard-explicit-chunk-c')
      const pieceCid = createPieceCID()
      const shardsByRoot = new Map([
        [rootA.toString(), [shardA]],
        [rootB.toString(), [shardB]],
        [rootC.toString(), [shardC]],
      ])
      const indexer = createMockIndexer(
        new Map(
          [shardA, shardB, shardC].map((shard, index) => [
            base58btc.encode(shard.multihash.bytes),
            {
              claims: buildShardClaims(shard, {
                locationURLs: [`https://r2.example/explicit-chunk-${index}`],
                pieceCid,
              }),
            },
          ])
        )
      )
      const store = await openStore()
      const state = store.getState()
      const ac = new AbortController()

      for await (const event of buildMigrationInventories({
        client: createMockClient([], shardsByRoot),
        resolver: claimsResolver,
        store,
        uploadRootsBySpace: {
          [SPACE_DID]: [rootA.toString(), rootB.toString(), rootC.toString()],
        },
        signal: ac.signal,
        options: {
          indexer,
          uploadPageSize: 2,
        },
      })) {
        if (event.type === 'state:checkpoint') {
          ac.abort()
        }
      }

      expect(state.spacesInventories[SPACE_DID]?.uploads).toEqual([
        rootA.toString(),
        rootB.toString(),
      ])
      expect(state.readerProgressCursors).toEqual({
        [SPACE_DID]: 'explicit-roots:1',
      })
    })

    it('resumes explicit-root reads from the persisted synthetic chunk cursor', async () => {
      const rootA = await createTestCID('root-explicit-resume-a')
      const rootB = await createTestCID('root-explicit-resume-b')
      const rootC = await createTestCID('root-explicit-resume-c')
      const rootD = await createTestCID('root-explicit-resume-d')
      const shardA = await createTestCID('shard-explicit-resume-a')
      const shardB = await createTestCID('shard-explicit-resume-b')
      const shardC = await createTestCID('shard-explicit-resume-c')
      const shardD = await createTestCID('shard-explicit-resume-d')
      const pieceCid = createPieceCID()
      const explicitRoots = [
        rootA.toString(),
        rootB.toString(),
        rootC.toString(),
        rootD.toString(),
      ]
      const shardsByRoot = new Map([
        [rootA.toString(), [shardA]],
        [rootB.toString(), [shardB]],
        [rootC.toString(), [shardC]],
        [rootD.toString(), [shardD]],
      ])
      const indexer = createMockIndexer(
        new Map(
          [shardA, shardB, shardC, shardD].map((shard, index) => [
            base58btc.encode(shard.multihash.bytes),
            {
              claims: buildShardClaims(shard, {
                locationURLs: [`https://r2.example/explicit-resume-${index}`],
                pieceCid,
              }),
            },
          ])
        )
      )

      const failingClient = /** @type {import('@storacha/client').Client} */ (
        /** @type {unknown} */ ({
          async setCurrentSpace(/** @type {API.SpaceDID} */ _did) {},
          capability: {
            upload: {
              async list() {
                throw new Error('upload.list should not be called')
              },
              shard: {
                async list(
                  /** @type {API.UnknownLink} */ root,
                  /** @type {unknown} */ _options
                ) {
                  const rootString = `${root}`
                  if (rootString === `${rootC}`) {
                    throw new Error('simulated explicit-root crash')
                  }
                  return { results: shardsByRoot.get(rootString) ?? [] }
                },
              },
            },
          },
        })
      )

      const firstRunStore = await openStore()
      /** @type {import('../src/api.js').MigrationState | undefined} */
      let persistedState

      await expect(
        (async () => {
          for await (const event of buildMigrationInventories({
            client: failingClient,
            resolver: claimsResolver,
            store: firstRunStore,
            uploadRootsBySpace: { [SPACE_DID]: explicitRoots },
            options: {
              indexer,
              uploadPageSize: 1,
              checkpointEveryPages: 2,
            },
          })) {
            if (event.type === 'state:checkpoint') {
              persistedState = deserializeState(
                JSON.parse(JSON.stringify(serializeState(event.state)))
              )
            }
          }
        })()
      ).rejects.toThrow('simulated explicit-root crash')

      await firstRunStore.close()

      expect(persistedState).toBeDefined()
      if (!persistedState) {
        throw new Error('expected a checkpointed state before the crash')
      }

      expect(persistedState.spacesInventories[SPACE_DID]?.uploads).toEqual([
        rootA.toString(),
        rootB.toString(),
      ])
      expect(persistedState.readerProgressCursors).toEqual({
        [SPACE_DID]: 'explicit-roots:2',
      })

      const resumeStore = await openStore({ state: persistedState })
      const resumeState = resumeStore.getState()
      const resumedInventory = await collectInventory(
        buildMigrationInventories({
          client: createMockClient([], shardsByRoot),
          resolver: claimsResolver,
          store: resumeStore,
          uploadRootsBySpace: { [SPACE_DID]: explicitRoots },
          options: {
            indexer,
            uploadPageSize: 1,
            checkpointEveryPages: 2,
          },
        }),
        resumeState,
        SPACE_DID
      )

      await resumeStore.close()

      expect(resumedInventory.uploads).toEqual(explicitRoots)
      expect(resumedInventory.shards).toHaveLength(4)
      expect(resumeState.readerProgressCursors).toBeUndefined()
    })

    it('rejects malformed explicit-root cursors on resume', async () => {
      const rootA = await createTestCID('root-explicit-malformed-a')
      const store = await openStore()
      const state = store.getState()
      state.readerProgressCursors = {
        [SPACE_DID]: 'explicit-roots:2junk',
      }

      await expect(
        collectInventory(
          buildMigrationInventories({
            client: createMockClient([], new Map([[rootA.toString(), []]])),
            resolver: claimsResolver,
            store,
            uploadRootsBySpace: {
              [SPACE_DID]: [rootA.toString()],
            },
            options: {
              indexer: createMockIndexer(new Map()),
            },
          }),
          state,
          SPACE_DID
        )
      ).rejects.toThrow(
        `buildMigrationInventories: invalid explicit-root cursor for ${SPACE_DID}: explicit-roots:2junk`
      )
    })

    it('throws clearly for invalid explicit upload roots', async () => {
      const store = await openStore()
      const state = store.getState()

      await expect(
        collectInventory(
          buildMigrationInventories({
            client: createMockClient([], new Map()),
            resolver: claimsResolver,
            store,
            uploadRootsBySpace: {
              [SPACE_DID]: ['not-a-cid'],
            },
            options: {
              indexer: createMockIndexer(new Map()),
            },
          }),
          state,
          SPACE_DID
        )
      ).rejects.toThrow(
        `buildMigrationInventories: invalid explicit upload root for ${SPACE_DID}: not-a-cid`
      )
    })
  })

  describe('abort support', () => {
    it('stops after the last checkpointed page and leaves state resumable', async () => {
      const rootA = await createTestCID('root-abort-page-a')
      const rootB = await createTestCID('root-abort-page-b')
      const shardA = await createTestCID('shard-abort-page-a')
      const shardB = await createTestCID('shard-abort-page-b')
      const pieceCid = createPieceCID()
      const shardAB58 = base58btc.encode(shardA.multihash.bytes)
      const shardBB58 = base58btc.encode(shardB.multihash.bytes)

      const client = createMockClient(
        [
          { results: [{ root: rootA }], cursor: '1' },
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
                locationURLs: ['https://r2.example/abort-a'],
                pieceCid,
              }),
            },
          ],
          [
            shardBB58,
            {
              claims: buildShardClaims(shardB, {
                locationURLs: ['https://r2.example/abort-b'],
                pieceCid,
              }),
            },
          ],
        ])
      )

      const ac = new AbortController()
      const store = await openStore()
      const state = store.getState()
      /** @type {API.MigrationEvent[]} */
      const events = []

      for await (const event of buildMigrationInventories({
        client,
        resolver: claimsResolver,
        store,
        spaceDIDs: [SPACE_DID],
        signal: ac.signal,
        options: { indexer },
      })) {
        events.push(event)
        if (event.type === 'state:checkpoint') {
          ac.abort()
        }
      }

      expect(events.map((event) => event.type)).toEqual([
        'reader:space:start',
        'state:checkpoint',
      ])
      expect(state.phase).toBe('reading')
      expect(state.readerProgressCursors).toEqual({ [SPACE_DID]: '1' })
      expect(state.spacesInventories[SPACE_DID]?.uploads).toEqual([
        rootA.toString(),
      ])
      expect(state.spacesInventories[SPACE_DID]?.shards).toHaveLength(1)
    })

    it('returns cleanly when a reader request is aborted in flight', async () => {
      const client = /** @type {import('@storacha/client').Client} */ (
        /** @type {unknown} */ ({
          spaces() {
            return []
          },
          async setCurrentSpace(/** @type {API.SpaceDID} */ _did) {},
          capability: {
            upload: {
              async list(
                /** @type {{ signal?: AbortSignal } | undefined} */ options
              ) {
                return await new Promise((_resolve, reject) => {
                  if (options?.signal?.aborted) {
                    reject(createAbortError())
                    return
                  }
                  options?.signal?.addEventListener(
                    'abort',
                    () => reject(createAbortError()),
                    { once: true }
                  )
                })
              },
              shard: {
                async list(
                  /** @type {API.UnknownLink} */ _root,
                  /** @type {unknown} */ _options
                ) {
                  return { results: [] }
                },
              },
            },
          },
        })
      )

      const ac = new AbortController()
      const store = await openStore()
      const state = store.getState()
      /** @type {API.MigrationEvent[]} */
      const events = []

      const run = (async () => {
        for await (const event of buildMigrationInventories({
          client,
          resolver: claimsResolver,
          store,
          spaceDIDs: [SPACE_DID],
          signal: ac.signal,
          options: { indexer: createMockIndexer(new Map()) },
        })) {
          events.push(event)
        }
      })()

      ac.abort()
      await run

      expect(events.map((event) => event.type)).toEqual(['reader:space:start'])
      expect(state.phase).toBe('reading')
      expect(state.spacesInventories[SPACE_DID]).toBeUndefined()
      expect(state.readerProgressCursors).toBeUndefined()
    })
  })
})

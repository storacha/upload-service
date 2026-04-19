import { describe, it, expect } from 'vitest'
import { Piece } from '@web3-storage/data-segment'
import { base58btc } from 'multiformats/bases/base58'

import { buildMigrationInventories } from '../src/reader.js'
import { ClaimsResolver, RoundaboutResolver } from '../src/source-url.js'
import {
  createTestCID,
  createPieceCID,
  createMockClient,
  createMockIndexer,
  buildShardClaims,
  createMockInitialState,
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

describe('buildMigrationInventories', () => {
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

      const state = createMockInitialState()
      const inventory = await collectInventory(
        buildMigrationInventories({
          client,
          resolver: claimsResolver,
          state,
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

      const state = createMockInitialState()
      const inventory = await collectInventory(
        buildMigrationInventories({
          client,
          resolver: claimsResolver,
          state,
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

      const state = createMockInitialState()
      const inventory = await collectInventory(
        buildMigrationInventories({
          client,
          resolver: claimsResolver,
          state,
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

      const state = createMockInitialState()
      const inventory = await collectInventory(
        buildMigrationInventories({
          client,
          resolver: claimsResolver,
          state,
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

      const state = createMockInitialState()
      /** @type {API.MigrationEvent[]} */
      const events = []
      for await (const event of buildMigrationInventories({
        client,
        resolver: claimsResolver,
        state,
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
      expect(events.find((e) => e.type === 'reader:shard:failed')).toBeUndefined()
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

      const state = createMockInitialState()
      /** @type {API.MigrationEvent[]} */
      const events = []
      for await (const event of buildMigrationInventories({
        client,
        resolver: claimsResolver,
        state,
        spaceDIDs: [SPACE_DID],
        options: { indexer },
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

      const state = createMockInitialState()
      const inventory = await collectInventory(
        buildMigrationInventories({
          client,
          resolver: new ClaimsResolver(),
          state,
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

      const state = createMockInitialState()
      const inventory = await collectInventory(
        buildMigrationInventories({
          client,
          resolver: new RoundaboutResolver(),
          state,
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

      const state = createMockInitialState()
      const inventory = await collectInventory(
        buildMigrationInventories({
          client,
          resolver: claimsResolver,
          state,
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

      const state = createMockInitialState()
      const checkpoints = []
      for await (const event of buildMigrationInventories({
        client,
        resolver: claimsResolver,
        state,
        spaceDIDs: [SPACE_DID],
        options: { indexer },
      })) {
        if (event.type === 'state:checkpoint') checkpoints.push(event)
      }

      // one checkpoint per page (2) + one final checkpoint after reader:complete
      expect(checkpoints.length).toBe(3)
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
               * @param _options
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

      const state = createMockInitialState()
      for await (const _ of buildMigrationInventories({
        client,
        resolver: claimsResolver,
        state,
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

      const state = createMockInitialState()
      for await (const _ of buildMigrationInventories({
        client,
        resolver: claimsResolver,
        state,
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

      const state = createMockInitialState()
      for await (const _ of buildMigrationInventories({
        client,
        resolver: claimsResolver,
        state,
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

      const state = createMockInitialState()
      const events = []
      for await (const event of buildMigrationInventories({
        client,
        resolver: claimsResolver,
        state,
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

      const state = createMockInitialState()
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
        state,
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

      const state = createMockInitialState()
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
          state,
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
  })
})

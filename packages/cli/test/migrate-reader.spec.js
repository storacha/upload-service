import { createInitialState } from '@storacha/filecoin-pin-migration'
import { readInventories } from '../migrate/phases/reader.js'
import {
  buildShardClaims,
  createMockIndexer,
  createPieceCID,
  createTestCID,
} from '../../filecoin-pin-migration/test/helpers.js'
import { base58btc } from 'multiformats/bases/base58'

const SPACE_DID = 'did:key:z6MkuK94Gm6w7t8dX6d5Lz4k9Y3r1s2q8p7n6m5v4u3t2r1'

/** @type {import('entail').Suite} */
export const testMigrateReader = {
  'readInventories routes selected roots into explicit-root reader mode':
    async (assert) => {
      const rootA = await createTestCID('cli-explicit-root-a')
      const rootB = await createTestCID('cli-explicit-root-b')
      const shardA = await createTestCID('cli-explicit-shard-a')
      const shardB = await createTestCID('cli-explicit-shard-b')
      const pieceCid = createPieceCID()
      const shardsByRoot = new Map([
        [rootA.toString(), [shardA]],
        [rootB.toString(), [shardB]],
      ])
      const indexer = createMockIndexer(
        new Map(
          [shardA, shardB].map((shard, index) => [
            base58btc.encode(shard.multihash.bytes),
            {
              claims: buildShardClaims(shard, {
                locationURLs: [`https://r2.example/cli-explicit-${index}`],
                pieceCid,
              }),
            },
          ])
        )
      )

      let uploadListCalls = 0
      /** @type {string | undefined} */
      let currentSpaceDID
      const client = /** @type {import('@storacha/client').Client} */ ({
        async setCurrentSpace(did) {
          currentSpaceDID = did
        },
        currentSpace() {
          return currentSpaceDID
            ? { did: () => currentSpaceDID, name: 'CLI Explicit Root Space' }
            : undefined
        },
        capability: {
          upload: {
            async list() {
              uploadListCalls += 1
              throw new Error('upload.list should not be called')
            },
            shard: {
              async list(root) {
                return { results: shardsByRoot.get(root.toString()) ?? [] }
              },
            },
          },
        },
      })

      const state = createInitialState()
      const result = await readInventories({
        client,
        resolver: {
          resolve(shard) {
            return shard.sourceURL
          },
        },
        state,
        uploadRootsBySpace: {
          [SPACE_DID]: [rootA.toString(), rootB.toString()],
        },
        readerOptions: { indexer },
        persistCheckpoint: async () => {},
        signal: new AbortController().signal,
      })

      assert.equal(uploadListCalls, 0)
      assert.equal(result.interrupted, false)
      assert.deepEqual(state.spacesInventories[SPACE_DID]?.uploads, [
        rootA.toString(),
        rootB.toString(),
      ])
    },
}

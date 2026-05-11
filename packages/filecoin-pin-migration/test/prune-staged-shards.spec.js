import { describe, expect, it } from 'vitest'
import { pruneStagedShards } from '../src/helper/prune-staged-shards.js'
import { commitKey, STATE_VERSION } from '../src/state.js'

/**
 * @import * as API from '../src/api.js'
 */

const SPACE_DID = /** @type {API.SpaceDID} */ (
  'did:key:z6MkPruneStagedShardsSpace1'
)

describe('pruneStagedShards', () => {
  it('skips copies with no staged shards', async () => {
    const state = createState({
      phase: 'complete',
      copy0Committed: [commitKey('bafy-shard-1', 'bafy-root-1')],
    })

    const result = await pruneStagedShards({
      state,
      spaceDIDs: [SPACE_DID],
    })

    expect(result).toEqual({
      stateCorrected: false,
      spaces: [],
    })
  })

  it('removes only not_found staged shards and keeps transient failures as unverified', async () => {
    const state = createState({
      phase: 'migrating',
      copy0Pulled: ['bafy-shard-1', 'bafy-shard-2'],
      copy0StoredShards: {
        'bafy-shard-3': 'bafkz-piece-3',
      },
      copy0ProviderURL: 'https://sp.example',
    })

    const result = await pruneStagedShards({
      state,
      spaceDIDs: [SPACE_DID],
      fetcher: createStatusFetcher({
        'bafkz-piece-1': { status: 404 },
        'bafkz-piece-2': { status: 200, body: { status: 'pending' } },
        'bafkz-piece-3': { status: 500, body: {} },
      }),
    })

    expect(result.stateCorrected).toBe(true)
    expect(result.spaces).toEqual([
      {
        spaceDID: SPACE_DID,
        copies: [
          {
            copyIndex: 0,
            providerId: 1n,
            dataSetId: null,
            stagedShardCount: 3,
            removedStagedShardCount: 1,
            removedStagedShardCIDs: ['bafy-shard-1'],
            unverifiedStagedShardCount: 1,
            unverifiedStagedShardCIDs: ['bafy-shard-3'],
            statusBreakdown: {
              not_found: 1,
              pending: 1,
              http_error: 1,
            },
          },
        ],
      },
    ])
    expect(state.spaces[SPACE_DID].copies[0].pulled.has('bafy-shard-1')).toBe(
      false
    )
    expect(state.spaces[SPACE_DID].copies[0].pulled.has('bafy-shard-2')).toBe(
      true
    )
    expect(state.spaces[SPACE_DID].copies[0].storedShards).toEqual({
      'bafy-shard-3': 'bafkz-piece-3',
    })
    expect(state.spaces[SPACE_DID].phase).toBe('migrating')
  })

  it('resets the space phase to pending when cleanup removes all staged progress', async () => {
    const state = createState({
      phase: 'incomplete',
      copy0Pulled: ['bafy-shard-1'],
      copy0ProviderURL: 'https://sp.example',
    })

    const result = await pruneStagedShards({
      state,
      spaceDIDs: [SPACE_DID],
      fetcher: createStatusFetcher({
        'bafkz-piece-1': { status: 404 },
      }),
    })

    expect(result.stateCorrected).toBe(true)
    expect(state.spaces[SPACE_DID].phase).toBe('pending')
    expect(state.spaces[SPACE_DID].copies[0].pulled.size).toBe(0)
  })
})

/**
 * @param {object} [input]
 * @param {API.SpacePhase} [input.phase]
 * @param {string[]} [input.copy0Committed]
 * @param {string[]} [input.copy0Pulled]
 * @param {Record<string, string>} [input.copy0StoredShards]
 * @param {string | null} [input.copy0ProviderURL]
 * @returns {API.MigrationState}
 */
function createState(input = {}) {
  return /** @type {API.MigrationState} */ ({
    version: STATE_VERSION,
    phase: 'migrating',
    spaces: {
      [SPACE_DID]: {
        did: SPACE_DID,
        phase: input.phase ?? 'pending',
        copies: [
          createCopyState({
            copyIndex: 0,
            committed: input.copy0Committed,
            pulled: input.copy0Pulled,
            storedShards: input.copy0StoredShards,
            providerURL: input.copy0ProviderURL,
          }),
          createCopyState({
            copyIndex: 1,
          }),
        ],
      },
    },
    spacesInventories: {
      [SPACE_DID]: {
        did: SPACE_DID,
        uploads: ['bafy-root-1'],
        shards: [
          {
            root: 'bafy-root-1',
            cid: 'bafy-shard-1',
            pieceCID: 'bafkz-piece-1',
            sourceURL: 'https://source.example/shard-1',
            sizeBytes: 1n,
          },
          {
            root: 'bafy-root-1',
            cid: 'bafy-shard-2',
            pieceCID: 'bafkz-piece-2',
            sourceURL: 'https://source.example/shard-2',
            sizeBytes: 1n,
          },
        ],
        shardsToStore: [
          {
            root: 'bafy-root-2',
            cid: 'bafy-shard-3',
            sourceURL: 'https://source.example/shard-3',
            sizeBytes: 1n,
          },
        ],
        skippedUploads: [],
        totalBytes: 3n,
        totalSizeToMigrate: 3n,
      },
    },
    readerProgressCursors: undefined,
  })
}

/**
 * @param {object} input
 * @param {number} input.copyIndex
 * @param {string[]} [input.committed]
 * @param {string[]} [input.pulled]
 * @param {Record<string, string>} [input.storedShards]
 * @param {string | null} [input.providerURL]
 * @returns {API.SpaceCopyState}
 */
function createCopyState({
  copyIndex,
  committed,
  pulled,
  storedShards,
  providerURL,
}) {
  return {
    copyIndex,
    providerId: BigInt(copyIndex + 1),
    serviceProvider: /** @type {`0x${string}`} */ (
      `0x${String(copyIndex + 1).padStart(40, '0')}`
    ),
    providerURL: providerURL ?? null,
    dataSetId: null,
    pulled: new Set(pulled ?? []),
    committed: new Set(committed ?? []),
    failedUploads: new Set(),
    storedShards: storedShards ?? {},
  }
}

/**
 * @param {Record<string, { status: number, body?: { status?: string } }>} responses
 * @returns {typeof fetch}
 */
function createStatusFetcher(responses) {
  return /** @type {typeof fetch} */ (
    async (input) => {
      const url = typeof input === 'string' ? input : input.toString()
      const pieceCID = url.split('/').at(-2)
      const response = pieceCID ? responses[pieceCID] : undefined

      if (!response) {
        return createResponse({ status: 404 })
      }

      return createResponse(response)
    }
  )
}

/**
 * @param {{ status: number, body?: { status?: string } }} response
 */
function createResponse(response) {
  return /** @type {Response} */ ({
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    json: async () => response.body ?? {},
  })
}

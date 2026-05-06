import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchDataSetPieces } from '../src/helper/fetch-dataset-pieces.js'
import { reconcileMigrationState } from '../src/helper/reconcile-migration-state.js'

/**
 * @import * as API from '../src/api.js'
 */

vi.mock('../src/helper/fetch-dataset-pieces.js', () => ({
  fetchDataSetPieces: vi.fn(),
}))

const SPACE_DID = /** @type {API.SpaceDID} */ (
  'did:key:z6MkReconcileMigrationStateSpace1'
)

describe('reconcileMigrationState', () => {
  beforeEach(() => {
    vi.mocked(fetchDataSetPieces).mockReset()
  })

  it('does not clear persisted committed shards when dataSetId is missing', async () => {
    const state = createState()

    const result = await reconcileMigrationState({
      state,
      client: /** @type {any} */ ({}),
      spaceDIDs: [SPACE_DID],
    })

    expect(result.stateCorrected).toBe(false)
    expect(result.hasDiscrepancies).toBe(true)
    expect(result.spaces).toEqual([
      {
        spaceDID: SPACE_DID,
        inventoryShardsMissingPieceCID: [],
        copies: [
          {
            copyIndex: 0,
            providerId: 1n,
            dataSetId: null,
            skippedReason: 'missing-data-set-id',
            changes: {
              committedAdded: [],
              committedRemoved: [],
              pulledRemovedBecauseCommitted: [],
              removedStagedShardCIDs: [],
            },
            warnings: {
              committedPiecesNotFoundInInventory: [],
              unverifiedStagedShardCIDs: [],
            },
          },
        ],
      },
    ])
    expect([...state.spaces[SPACE_DID].copies[0].committed]).toEqual([
      'bafy-shard-1',
    ])
  })

  it('demotes a stale complete phase when committed shards are removed', async () => {
    vi.mocked(fetchDataSetPieces).mockResolvedValue({
      dataSetId: 123n,
      providerURL: null,
      pieces: [
        {
          pieceCID: 'bafkz-piece-1',
        },
      ],
    })

    const state = createState({
      phase: 'complete',
      shards: [
        createShard('bafy-root-1', 'bafy-shard-1', 'bafkz-piece-1'),
        createShard('bafy-root-1', 'bafy-shard-2', 'bafkz-piece-2'),
      ],
      copy0DataSetId: 123n,
      copy0Committed: ['bafy-shard-1', 'bafy-shard-2'],
    })

    const result = await reconcileMigrationState({
      state,
      client: /** @type {any} */ ({}),
      spaceDIDs: [SPACE_DID],
    })

    expect(result.stateCorrected).toBe(true)
    expect(state.spaces[SPACE_DID].phase).toBe('incomplete')
    expect([...state.spaces[SPACE_DID].copies[0].committed]).toEqual([
      'bafy-shard-1',
    ])
  })
})

/**
 * @param {object} [input]
 * @param {API.SpacePhase} [input.phase]
 * @param {ReturnType<typeof createShard>[]} [input.shards]
 * @param {bigint | null} [input.copy0DataSetId]
 * @param {string[]} [input.copy0Committed]
 * @returns {API.MigrationState}
 */
function createState(input = {}) {
  return /** @type {API.MigrationState} */ ({
    phase: 'migrating',
    spaces: {
      [SPACE_DID]: {
        did: SPACE_DID,
        phase: input.phase ?? 'complete',
        copies: [
          createCopyState({
            copyIndex: 0,
            dataSetId: input.copy0DataSetId,
            committed: input.copy0Committed ?? ['bafy-shard-1'],
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
        shards: input.shards ?? [
          createShard('bafy-root-1', 'bafy-shard-1', 'bafkz-piece-1'),
        ],
        shardsToStore: [],
        skippedUploads: [],
        totalBytes: BigInt((input.shards ?? [1]).length),
        totalSizeToMigrate: BigInt((input.shards ?? [1]).length),
      },
    },
    readerProgressCursors: undefined,
  })
}

/**
 * @param {object} input
 * @param {number} input.copyIndex
 * @param {bigint | null} [input.dataSetId]
 * @param {string[]} [input.committed]
 * @returns {API.SpaceCopyState}
 */
function createCopyState({ copyIndex, dataSetId, committed }) {
  return {
    copyIndex,
    providerId: BigInt(copyIndex + 1),
    serviceProvider: /** @type {`0x${string}`} */ (
      `0x${String(copyIndex + 1).padStart(40, '0')}`
    ),
    providerURL: null,
    dataSetId: dataSetId ?? null,
    pulled: new Set(),
    committed: new Set(committed ?? []),
    failedUploads: new Set(),
    storedShards: {},
  }
}

/**
 * @param {string} root
 * @param {string} cid
 * @param {string} pieceCID
 */
function createShard(root, cid, pieceCID) {
  return {
    root,
    cid,
    pieceCID,
    sourceURL: `https://source.example/${cid}`,
    sizeBytes: 1n,
  }
}

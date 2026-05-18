import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchDataSetPieces } from '../src/helper/fetch-dataset-pieces.js'
import { reconcileMigrationState } from '../src/helper/reconcile-migration-state.js'
import { commitKey, STATE_VERSION } from '../src/state.js'

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
              committedPieceRootsNotFoundInInventory: [],
              unverifiedCommittedPieces: [],
              unverifiedStagedShardCIDs: [],
            },
          },
        ],
      },
    ])
    expect([...state.spaces[SPACE_DID].copies[0].committed]).toEqual([
      commitKey('bafy-shard-1', 'bafy-root-1'),
    ])
  })

  it('demotes a stale complete phase when committed shards are removed', async () => {
    vi.mocked(fetchDataSetPieces).mockResolvedValue({
      dataSetId: 123n,
      providerURL: null,
      pieces: [
        {
          pieceCID: 'bafkz-piece-1',
          ipfsRootCID: 'bafy-root-1',
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
      copy0Committed: [
        commitKey('bafy-shard-1', 'bafy-root-1'),
        commitKey('bafy-shard-2', 'bafy-root-1'),
      ],
    })

    const result = await reconcileMigrationState({
      state,
      client: /** @type {any} */ ({}),
      spaceDIDs: [SPACE_DID],
    })

    expect(result.stateCorrected).toBe(true)
    expect(state.spaces[SPACE_DID].phase).toBe('incomplete')
    expect([...state.spaces[SPACE_DID].copies[0].committed]).toEqual([
      commitKey('bafy-shard-1', 'bafy-root-1'),
    ])
    expect(result.committedDeleted).toEqual([
      {
        spaceDID: SPACE_DID,
        copyIndex: 0,
        shardCid: 'bafy-shard-2',
        rootCid: 'bafy-root-1',
      },
    ])
  })

  it('rebuilds committed state for the same piece committed under multiple roots', async () => {
    vi.mocked(fetchDataSetPieces).mockResolvedValue({
      dataSetId: 123n,
      providerURL: null,
      pieces: [
        {
          pieceCID: 'bafkz-piece-shared',
          ipfsRootCID: 'bafy-root-a',
        },
        {
          pieceCID: 'bafkz-piece-shared',
          ipfsRootCID: 'bafy-root-b',
        },
      ],
    })

    const state = createState({
      phase: 'incomplete',
      shards: [
        createShard('bafy-root-a', 'bafy-shard-shared', 'bafkz-piece-shared'),
        createShard('bafy-root-b', 'bafy-shard-shared', 'bafkz-piece-shared'),
      ],
      copy0DataSetId: 123n,
      copy0Committed: [],
    })

    const result = await reconcileMigrationState({
      state,
      client: /** @type {any} */ ({}),
      spaceDIDs: [SPACE_DID],
    })

    expect(result.stateCorrected).toBe(true)
    expect([...state.spaces[SPACE_DID].copies[0].committed].sort()).toEqual(
      [
        commitKey('bafy-shard-shared', 'bafy-root-a'),
        commitKey('bafy-shard-shared', 'bafy-root-b'),
      ].sort()
    )
  })

  it('reports committed pieces with missing root metadata as unverified', async () => {
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
      phase: 'incomplete',
      copy0DataSetId: 123n,
      copy0Committed: [commitKey('bafy-shard-1', 'bafy-root-1')],
    })

    const result = await reconcileMigrationState({
      state,
      client: /** @type {any} */ ({}),
      spaceDIDs: [SPACE_DID],
    })

    expect(result.stateCorrected).toBe(false)
    expect(
      result.spaces[0]?.copies[0]?.warnings.unverifiedCommittedPieces
    ).toEqual(['bafkz-piece-1'])
    expect([...state.spaces[SPACE_DID].copies[0].committed]).toEqual([
      commitKey('bafy-shard-1', 'bafy-root-1'),
    ])
  })

  it('applies verified committed additions but suppresses removals when a dataset also contains unverified committed pieces', async () => {
    vi.mocked(fetchDataSetPieces).mockResolvedValue({
      dataSetId: 123n,
      providerURL: null,
      pieces: [
        {
          pieceCID: 'bafkz-piece-1',
          ipfsRootCID: 'bafy-root-1',
        },
        {
          pieceCID: 'bafkz-piece-foreign',
        },
      ],
    })

    const state = createState({
      phase: 'incomplete',
      shards: [
        createShard('bafy-root-1', 'bafy-shard-1', 'bafkz-piece-1'),
        createShard('bafy-root-2', 'bafy-shard-2', 'bafkz-piece-2'),
      ],
      copy0DataSetId: 123n,
      copy0Committed: [commitKey('bafy-shard-2', 'bafy-root-2')],
    })

    const result = await reconcileMigrationState({
      state,
      client: /** @type {any} */ ({}),
      spaceDIDs: [SPACE_DID],
    })

    expect(result.stateCorrected).toBe(true)
    expect(result.spaces[0]?.copies[0]?.changes.committedAdded).toEqual([
      commitKey('bafy-shard-1', 'bafy-root-1'),
    ])
    expect(result.spaces[0]?.copies[0]?.changes.committedRemoved).toEqual([])
    expect(
      result.spaces[0]?.copies[0]?.warnings.unverifiedCommittedPieces
    ).toEqual(['bafkz-piece-foreign'])
    expect([...state.spaces[SPACE_DID].copies[0].committed].sort()).toEqual(
      [
        commitKey('bafy-shard-1', 'bafy-root-1'),
        commitKey('bafy-shard-2', 'bafy-root-2'),
      ].sort()
    )
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
    version: STATE_VERSION,
    phase: 'migrating',
    spaces: {
      [SPACE_DID]: {
        did: SPACE_DID,
        phase: input.phase ?? 'complete',
        copies: [
          createCopyState({
            copyIndex: 0,
            dataSetId: input.copy0DataSetId,
            committed: input.copy0Committed ?? [
              commitKey('bafy-shard-1', 'bafy-root-1'),
            ],
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

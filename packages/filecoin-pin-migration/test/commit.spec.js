import { describe, it, expect } from 'vitest'
import { iterateCommitPieces, commitPieceBatches } from '../src/commit.js'
import { createPieceCID } from './helpers.js'

/**
 * @import * as API from '../src/api.js'
 */

const SPACE_DID = /** @type {API.SpaceDID} */ (
  'did:key:z6MkCommitBatchingSpaceTest'
)

describe('commit batching', () => {
  it('splits commit work into multiple batches and checkpoints each successful batch', async () => {
    const entries = createCommitEntries(30)
    const { context, presignCalls } = createMockCommitContext()
    const state = createMockCommitState()

    /** @type {API.MigrationEvent[]} */
    const events = []
    for await (const event of commitPieceBatches({
      commitPieceIterable: iterateCommitPieces(entries),
      context,
      state,
      spaceDID: SPACE_DID,
      copyIndex: 0,
      maxCommitRetries: 0,
      commitRetryTimeout: 0,
      activeFailedRoots: new Set(),
    })) {
      events.push(event)
    }

    expect(presignCalls.length).toBeGreaterThan(1)
    expect(state.spaces[SPACE_DID].copies[0].committed.size).toBe(entries.length)
    expect(events.filter((event) => event.type === 'state:checkpoint')).toHaveLength(
      presignCalls.length
    )
  })

  it('allows a larger first batch when the dataset already exists', async () => {
    const entries = createCommitEntries(30)

    const fresh = await collectCommitRun(
      entries,
      createMockCommitContext({ dataSetId: undefined })
    )
    const resumed = await collectCommitRun(
      entries,
      createMockCommitContext({ dataSetId: 777n })
    )

    expect(fresh.presignCalls.length).toBeGreaterThan(1)
    expect(resumed.presignCalls.length).toBeGreaterThan(0)
    expect(resumed.presignCalls[0]).toBeGreaterThan(fresh.presignCalls[0])
  })
})

/**
 * @param {API.CommitEntry[]} entries
 * @param {{ context: API.StorageContext, presignCalls: number[] }} run
 */
async function collectCommitRun(entries, run) {
  const state = createMockCommitState()

  for await (const _ of commitPieceBatches({
    commitPieceIterable: iterateCommitPieces(entries),
    context: run.context,
    state,
    spaceDID: SPACE_DID,
    copyIndex: 0,
    maxCommitRetries: 0,
    commitRetryTimeout: 0,
    activeFailedRoots: new Set(),
  })) {
    /* drain */
  }

  return run
}

/**
 * @param {number} count
 * @returns {API.CommitEntry[]}
 */
function createCommitEntries(count) {
  const pieceCID = createPieceCID().toString()

  return Array.from({ length: count }, (_, index) => ({
    shardCid: `bafyshard${String(index).padStart(4, '0')}`,
    pieceCID,
    root: `bafyroot${String(index).padStart(52, 'a')}`,
  }))
}

function createMockCommitState() {
  return /** @type {API.MigrationState} */ ({
    phase: 'migrating',
    spaces: {
      [SPACE_DID]: {
        did: SPACE_DID,
        phase: 'migrating',
        copies: [createCopyState(0), createCopyState(1)],
      },
    },
    spacesInventories: {},
    readerProgressCursors: undefined,
  })
}

/**
 * @param {number} copyIndex
 * @returns {API.SpaceCopyState}
 */
function createCopyState(copyIndex) {
  return {
    copyIndex,
    providerId: BigInt(copyIndex + 1),
    serviceProvider: /** @type {`0x${string}`} */ (
      `0x${String(copyIndex + 1).padStart(40, '0')}`
    ),
    dataSetId: null,
    pulled: new Set(),
    committed: new Set(),
    failedUploads: new Set(),
    storedShards: {},
  }
}

/**
 * @param {{ dataSetId?: bigint | undefined }} [options]
 */
function createMockCommitContext(options = {}) {
  let dataSetId = options.dataSetId
  /** @type {number[]} */
  const presignCalls = []

  const context = /** @type {API.StorageContext} */ (/** @type {unknown} */ ({
    get dataSetId() {
      return dataSetId
    },
    get dataSetMetadata() {
      return {
        source: 'storacha-migration',
        withIPFSIndexing: '',
        'space-did': SPACE_DID,
        'space-name': 'Commit Test Space',
      }
    },
    get withCDN() {
      return false
    },
    /**
     * @param {Array<{ pieceCid: API.PieceLink, pieceMetadata?: Record<string, string> }>} pieces
     */
    async presignForCommit(pieces) {
      presignCalls.push(pieces.length)
      return /** @type {import('viem').Hex} */ ('0x1234')
    },
    /**
     * @param {{ pieces: Array<{ pieceCid: API.PieceLink }> }} args
     */
    async commit({ pieces }) {
      if (dataSetId == null) {
        dataSetId = 999n
      }
      return {
        txHash: /** @type {import('viem').Hex} */ ('0x1234'),
        pieceIds: pieces.map(
          /**
           * @param {{ pieceCid: API.PieceLink }} _piece
           * @param {number} index
           */
          (_piece, index) => BigInt(index + 1)
        ),
        dataSetId,
        isNewDataSet: options.dataSetId == null,
      }
    },
  }))

  return { context, presignCalls }
}

import { describe, it, expect } from 'vitest'
import {
  iterateCommitPieces,
  commitPieceBatches,
} from '../src/migrator/commit.js'
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
      signal: undefined,
      activeFailedRoots: new Set(),
    })) {
      events.push(event)
    }

    expect(presignCalls.length).toBeGreaterThan(1)
    expect(state.spaces[SPACE_DID].copies[0].committed.size).toBe(
      entries.length
    )
    expect(
      events.filter((event) => event.type === 'state:checkpoint')
    ).toHaveLength(presignCalls.length)
    expect(
      events.filter(
        (event) =>
          event.type === 'migration:commit:settled' &&
          /** @type {{ status?: string }} */ (event).status === 'succeeded'
      )
    ).toHaveLength(presignCalls.length)
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

  it('stops before starting the next commit batch after abort', async () => {
    const entries = createCommitEntries(30)
    const controller = new AbortController()
    const { context, commitCalls } = createMockCommitContext({
      onCommit() {
        controller.abort()
      },
    })
    const state = createMockCommitState()

    for await (const _ of commitPieceBatches({
      commitPieceIterable: iterateCommitPieces(entries),
      context,
      state,
      spaceDID: SPACE_DID,
      copyIndex: 0,
      maxCommitRetries: 0,
      commitRetryTimeout: 0,
      signal: controller.signal,
      activeFailedRoots: new Set(),
    })) {
      /* drain */
    }

    expect(commitCalls.length).toBe(1)
    expect(state.spaces[SPACE_DID].copies[0].committed.size).toBe(
      commitCalls[0]
    )
    expect(state.spaces[SPACE_DID].copies[0].committed.size).toBeLessThan(
      entries.length
    )
  })

  it('emits a failed commit result with batch metadata when commit throws', async () => {
    const entries = createCommitEntries(2)
    const { context } = createMockCommitContext({
      failCommit: new Error('commit exploded'),
    })
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
      signal: undefined,
      activeFailedRoots: new Set(),
    })) {
      events.push(event)
    }

    const settledEvent = /** @type {API.MigrationEvent | undefined} */ (
      events.find((event) => event.type === 'migration:commit:settled')
    )
    expect(settledEvent?.type).toBe('migration:commit:settled')
    if (settledEvent?.type !== 'migration:commit:settled') {
      throw new Error('expected migration:commit:settled')
    }

    const commitSettledEvent = /** @type {any} */ (settledEvent)

    expect(commitSettledEvent.commitIndex).toBe(1)
    expect(commitSettledEvent.pieceCount).toBe(2)
    expect(commitSettledEvent.status).toBe('failed')
    expect(commitSettledEvent.txHash).toBeUndefined()
    expect(commitSettledEvent.error?.message).toBe('commit exploded')
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
    signal: undefined,
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
 * @param {{
 *   dataSetId?: bigint | undefined
 *   onCommit?: () => void
 *   failCommit?: Error
 * }} [options]
 */
function createMockCommitContext(options = {}) {
  let dataSetId = options.dataSetId
  /** @type {number[]} */
  const presignCalls = []
  /** @type {number[]} */
  const commitCalls = []

  const context = /** @type {API.StorageContext} */ (
    /** @type {unknown} */ ({
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
        if (options.failCommit) {
          throw options.failCommit
        }
        commitCalls.push(pieces.length)
        if (dataSetId == null) {
          dataSetId = 999n
        }
        options.onCommit?.()
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
    })
  )

  return { context, presignCalls, commitCalls }
}

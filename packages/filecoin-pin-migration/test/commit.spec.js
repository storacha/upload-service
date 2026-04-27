import { describe, it, expect, vi } from 'vitest'
import {
  iterateCommitPieces,
  commitPieceBatches,
} from '../src/migrator/commit.js'
import { createMockInitialState, createPieceCID } from './helpers.js'

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
      commitConcurrency: 4,
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
      commitConcurrency: 4,
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
      commitConcurrency: 4,
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
    commitConcurrency: 4,
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

// ── Two-phase commit tests ────────────────────────────────────────────────────
//
// These tests exercise the Phase 1 (sequential dataset-creation) → Phase 2
// (concurrent add-pieces with persistence-first ordering) flow. Each test
// uses a root string long enough that the 8 KiB extraData cap forces exactly
// one piece per batch — giving deterministic batch counts without relying on
// approximate byte math.

const TWO_PHASE_SPACE_DID = /** @type {API.SpaceDID} */ (
  'did:key:z6MkTwoPhaseCommitTest'
)
const TWO_PHASE_COPY_INDEX = 0
// A 5116-char root pads to 5120 bytes. Combined with the per-piece structural
// bytes this exceeds 8 KiB when two pieces would share a single batch.
const TWO_PHASE_ROOT_PAD = 'x'.repeat(5110)

/**
 * @param {number} i
 */
function makeTwoPhaseRoot(i) {
  return `r_${String(i).padStart(4, '0')}_${TWO_PHASE_ROOT_PAD}`
}

/**
 * @param {number} i
 * @returns {API.CommitPiece}
 */
function makeTwoPhasePiece(i) {
  return {
    pieceCid: createPieceCID(),
    pieceMetadata: { ipfsRootCID: makeTwoPhaseRoot(i) },
    shardCid: `shard_${i}`,
  }
}

function createTwoPhaseState() {
  const state = createMockInitialState()
  state.spaces[TWO_PHASE_SPACE_DID] = {
    did: TWO_PHASE_SPACE_DID,
    phase: 'migrating',
    copies: [
      {
        copyIndex: TWO_PHASE_COPY_INDEX,
        providerId: 10n,
        serviceProvider: /** @type {`0x${string}`} */ ('0x1000'),
        dataSetId: null,
        pulled: new Set(),
        committed: new Set(),
        failedUploads: new Set(),
        storedShards: {},
      },
    ],
  }
  state.spacesInventories[TWO_PHASE_SPACE_DID] = {
    did: TWO_PHASE_SPACE_DID,
    uploads: [],
    shards: [],
    shardsToStore: [],
    skippedUploads: [],
    totalBytes: 0n,
    totalSizeToMigrate: 0n,
  }
  state.phase = 'migrating'
  return state
}

function createTwoPhaseContext() {
  return /** @type {API.StorageContext & { presignForCommit: ReturnType<typeof vi.fn>, commit: ReturnType<typeof vi.fn> }} */ (
    /** @type {unknown} */ ({
      dataSetId: null,
      dataSetMetadata: {
        source: 'storacha-migration',
        withIPFSIndexing: '',
        'space-did': TWO_PHASE_SPACE_DID,
      },
      presignForCommit: vi.fn(async () => new Uint8Array([1, 2, 3])),
      commit: vi.fn(
        /**
         * @param {{ pieces: API.CommitPiece[] }} args
         */
        async ({ pieces }) => ({
          dataSetId: 100n,
          txHash: '0xtxdefault',
          pieces,
        })
      ),
    })
  )
}

function createTwoPhaseAbortError() {
  const error = new Error('This operation was aborted')
  error.name = 'AbortError'
  return error
}

describe('commitPieceBatches two-phase flow', () => {
  it('commits the first batch sequentially and the rest concurrently', async () => {
    const state = createTwoPhaseState()
    const context = createTwoPhaseContext()
    const pieces = [0, 1, 2].map(makeTwoPhasePiece)

    /** @type {API.MigrationEvent[]} */
    const events = []
    for await (const event of commitPieceBatches({
      commitPieceIterable: pieces,
      context,
      state,
      spaceDID: TWO_PHASE_SPACE_DID,
      copyIndex: TWO_PHASE_COPY_INDEX,
      maxCommitRetries: 0,
      commitRetryTimeout: 0,
      commitConcurrency: 4,
      signal: undefined,
    })) {
      events.push(event)
    }

    expect(context.commit).toHaveBeenCalledTimes(3)
    expect(context.commit.mock.calls[0][0].pieces).toHaveLength(1)

    const copy = state.spaces[TWO_PHASE_SPACE_DID].copies[0]
    expect(copy.committed.size).toBe(3)
    expect(copy.dataSetId).toBe(100n)

    const settled =
      /** @type {Array<API.MigrationEvent & { type: 'migration:commit:settled' }>} */ (
        events.filter((e) => e.type === 'migration:commit:settled')
      )
    expect(settled.map((e) => e.commitIndex)).toEqual([1, 2, 3])
    expect(settled.every((e) => e.status === 'succeeded')).toBe(true)
  })

  it('runs Phase 2 commits concurrently up to commitConcurrency', async () => {
    const state = createTwoPhaseState()
    const context = createTwoPhaseContext()
    const pieces = [0, 1, 2, 3].map(makeTwoPhasePiece)

    let phase2InFlight = 0
    let phase2MaxInFlight = 0
    let phase2Started = 0
    /** @type {() => void} */
    let releaseResolve = () => {}
    /** @type {Promise<void>} */
    const release = new Promise((resolve) => {
      releaseResolve = () => resolve()
    })
    let callCount = 0

    context.commit.mockImplementation(
      /**
       * @param {{ pieces: API.CommitPiece[] }} args
       */
      async ({ pieces: batchPieces }) => {
        callCount++
        if (callCount === 1) {
          return { dataSetId: 100n, txHash: '0xtx1', pieces: batchPieces }
        }

        phase2InFlight++
        phase2Started++
        phase2MaxInFlight = Math.max(phase2MaxInFlight, phase2InFlight)
        if (phase2Started >= 2) releaseResolve()
        await release
        phase2InFlight--
        return {
          dataSetId: 100n,
          txHash: `0xtx${callCount}`,
          pieces: batchPieces,
        }
      }
    )

    for await (const _event of commitPieceBatches({
      commitPieceIterable: pieces,
      context,
      state,
      spaceDID: TWO_PHASE_SPACE_DID,
      copyIndex: TWO_PHASE_COPY_INDEX,
      maxCommitRetries: 0,
      commitRetryTimeout: 0,
      commitConcurrency: 3,
      signal: undefined,
    })) {
      // drain
    }

    expect(context.commit).toHaveBeenCalledTimes(4)
    expect(phase2MaxInFlight).toBeGreaterThanOrEqual(2)
    expect(state.spaces[TWO_PHASE_SPACE_DID].copies[0].committed.size).toBe(4)
  })

  it('persists successful Phase 2 batches before any retry prompt', async () => {
    const state = createTwoPhaseState()
    const context = createTwoPhaseContext()
    const pieces = [0, 1, 2, 3].map(makeTwoPhasePiece)
    const failingRoot = pieces[2].pieceMetadata.ipfsRootCID

    context.commit.mockImplementation(
      /**
       * @param {{ pieces: API.CommitPiece[] }} args
       */
      async ({ pieces: batchPieces }) => {
        const root = batchPieces[0].pieceMetadata.ipfsRootCID
        if (root === failingRoot) throw new Error('simulated commit failure')
        return { dataSetId: 100n, txHash: '0xtx', pieces: batchPieces }
      }
    )

    /** @type {Set<string> | null} */
    let committedAtFailure = null

    for await (const event of commitPieceBatches({
      commitPieceIterable: pieces,
      context,
      state,
      spaceDID: TWO_PHASE_SPACE_DID,
      copyIndex: TWO_PHASE_COPY_INDEX,
      maxCommitRetries: 1,
      commitRetryTimeout: 0,
      commitConcurrency: 3,
      signal: undefined,
    })) {
      if (event.type === 'migration:commit:failed') {
        committedAtFailure = new Set(
          state.spaces[TWO_PHASE_SPACE_DID].copies[0].committed
        )
        event.skip()
      }
    }

    expect(committedAtFailure).not.toBeNull()
    expect(committedAtFailure?.has('shard_0')).toBe(true)
    expect(committedAtFailure?.has('shard_1')).toBe(true)
    expect(committedAtFailure?.has('shard_3')).toBe(true)
    expect(committedAtFailure?.has('shard_2')).toBe(false)
  })

  it('emits Phase 2 settled events in commit-index order after a retry win', async () => {
    const state = createTwoPhaseState()
    const context = createTwoPhaseContext()
    const pieces = [0, 1, 2].map(makeTwoPhasePiece)
    const failingRoot = pieces[2].pieceMetadata.ipfsRootCID
    let failedOnce = false

    context.commit.mockImplementation(
      /**
       * @param {{ pieces: API.CommitPiece[] }} args
       */
      async ({ pieces: batchPieces }) => {
        const root = batchPieces[0].pieceMetadata.ipfsRootCID
        if (root === failingRoot && !failedOnce) {
          failedOnce = true
          throw new Error('transient failure')
        }
        return { dataSetId: 100n, txHash: '0xtx', pieces: batchPieces }
      }
    )

    /** @type {API.MigrationEvent[]} */
    const events = []
    for await (const event of commitPieceBatches({
      commitPieceIterable: pieces,
      context,
      state,
      spaceDID: TWO_PHASE_SPACE_DID,
      copyIndex: TWO_PHASE_COPY_INDEX,
      maxCommitRetries: 2,
      commitRetryTimeout: 1_000,
      commitConcurrency: 2,
      signal: undefined,
    })) {
      events.push(event)
      if (event.type === 'migration:commit:failed') event.retry()
    }

    const copy = state.spaces[TWO_PHASE_SPACE_DID].copies[0]
    expect(copy.committed.size).toBe(3)
    expect(copy.failedUploads.size).toBe(0)

    const settled =
      /** @type {Array<API.MigrationEvent & { type: 'migration:commit:settled' }>} */ (
        events.filter((e) => e.type === 'migration:commit:settled')
      )
    expect(settled.map((e) => e.commitIndex)).toEqual([1, 2, 3])
    expect(settled.every((e) => e.status === 'succeeded')).toBe(true)
  })

  it('records failures for a Phase 2 batch whose retry is skipped', async () => {
    const state = createTwoPhaseState()
    const context = createTwoPhaseContext()
    const pieces = [0, 1, 2].map(makeTwoPhasePiece)
    const failingRoot = pieces[2].pieceMetadata.ipfsRootCID

    context.commit.mockImplementation(
      /**
       * @param {{ pieces: API.CommitPiece[] }} args
       */
      async ({ pieces: batchPieces }) => {
        const root = batchPieces[0].pieceMetadata.ipfsRootCID
        if (root === failingRoot) throw new Error('persistent failure')
        return { dataSetId: 100n, txHash: '0xtx', pieces: batchPieces }
      }
    )

    /** @type {API.MigrationEvent[]} */
    const events = []
    for await (const event of commitPieceBatches({
      commitPieceIterable: pieces,
      context,
      state,
      spaceDID: TWO_PHASE_SPACE_DID,
      copyIndex: TWO_PHASE_COPY_INDEX,
      maxCommitRetries: 1,
      commitRetryTimeout: 0,
      commitConcurrency: 2,
      signal: undefined,
    })) {
      events.push(event)
    }

    const copy = state.spaces[TWO_PHASE_SPACE_DID].copies[0]
    expect(copy.committed.size).toBe(2)
    expect(copy.committed.has('shard_0')).toBe(true)
    expect(copy.committed.has('shard_1')).toBe(true)
    expect(copy.committed.has('shard_2')).toBe(false)
    expect(copy.failedUploads.has(failingRoot)).toBe(true)

    const failedSettled = events.find(
      (e) =>
        e.type === 'migration:commit:settled' &&
        /** @type {{ status?: string }} */ (e).status === 'failed'
    )
    expect(failedSettled).toBeDefined()

    const batchFailed = events.find((e) => e.type === 'migration:batch:failed')
    expect(batchFailed).toBeDefined()
  })

  it('preserves completed Phase 2 batches when aborted mid-wave', async () => {
    const state = createTwoPhaseState()
    const context = createTwoPhaseContext()
    const pieces = [0, 1, 2, 3].map(makeTwoPhasePiece)
    const hangingRoot = pieces[3].pieceMetadata.ipfsRootCID
    const controller = new AbortController()

    let completedFastCount = 0
    /** @type {() => void} */
    let allFastCompletedResolve = () => {}
    /** @type {Promise<void>} */
    const allFastCompleted = new Promise((resolve) => {
      allFastCompletedResolve = () => resolve()
    })
    /** @type {() => void} */
    let hangingStartedResolve = () => {}
    /** @type {Promise<void>} */
    const hangingStarted = new Promise((resolve) => {
      hangingStartedResolve = () => resolve()
    })

    context.commit.mockImplementation(
      /**
       * @param {{ pieces: API.CommitPiece[] }} args
       */
      async ({ pieces: batchPieces }) => {
        const root = batchPieces[0].pieceMetadata.ipfsRootCID
        if (root === hangingRoot) {
          hangingStartedResolve()
          await new Promise((_, reject) => {
            controller.signal.addEventListener(
              'abort',
              () => reject(createTwoPhaseAbortError()),
              { once: true }
            )
          })
          throw new Error('unreachable')
        }
        completedFastCount++
        if (completedFastCount === 3) allFastCompletedResolve()
        return { dataSetId: 100n, txHash: '0xtx', pieces: batchPieces }
      }
    )

    const run = (async () => {
      /** @type {API.MigrationEvent[]} */
      const events = []
      for await (const event of commitPieceBatches({
        commitPieceIterable: pieces,
        context,
        state,
        spaceDID: TWO_PHASE_SPACE_DID,
        copyIndex: TWO_PHASE_COPY_INDEX,
        maxCommitRetries: 0,
        commitRetryTimeout: 0,
        commitConcurrency: 3,
        signal: controller.signal,
      })) {
        events.push(event)
      }
      return events
    })()

    await Promise.all([allFastCompleted, hangingStarted])
    controller.abort()
    await run

    const copy = state.spaces[TWO_PHASE_SPACE_DID].copies[0]
    expect(copy.committed.size).toBe(3)
    expect(copy.committed.has('shard_0')).toBe(true)
    expect(copy.committed.has('shard_1')).toBe(true)
    expect(copy.committed.has('shard_2')).toBe(true)
    expect(copy.committed.has('shard_3')).toBe(false)
  })

  it('commits the same set of shards when commitConcurrency is 1', async () => {
    const state = createTwoPhaseState()
    const context = createTwoPhaseContext()
    const pieces = [0, 1, 2].map(makeTwoPhasePiece)

    for await (const _event of commitPieceBatches({
      commitPieceIterable: pieces,
      context,
      state,
      spaceDID: TWO_PHASE_SPACE_DID,
      copyIndex: TWO_PHASE_COPY_INDEX,
      maxCommitRetries: 0,
      commitRetryTimeout: 0,
      commitConcurrency: 1,
      signal: undefined,
    })) {
      // drain
    }

    expect(context.commit).toHaveBeenCalledTimes(3)
    const copy = state.spaces[TWO_PHASE_SPACE_DID].copies[0]
    expect(copy.committed.size).toBe(3)
    expect(copy.dataSetId).toBe(100n)
  })

  it('skips pieces whose root is already in activeFailedRoots at pack time', async () => {
    const state = createTwoPhaseState()
    const context = createTwoPhaseContext()
    const pieces = [0, 1, 2].map(makeTwoPhasePiece)
    const blockedRoot = pieces[1].pieceMetadata.ipfsRootCID

    const activeFailedRoots = new Set([blockedRoot])

    for await (const _event of commitPieceBatches({
      commitPieceIterable: pieces,
      context,
      state,
      spaceDID: TWO_PHASE_SPACE_DID,
      copyIndex: TWO_PHASE_COPY_INDEX,
      maxCommitRetries: 0,
      commitRetryTimeout: 0,
      commitConcurrency: 4,
      signal: undefined,
      activeFailedRoots,
    })) {
      // drain
    }

    expect(context.commit).toHaveBeenCalledTimes(2)
    const copy = state.spaces[TWO_PHASE_SPACE_DID].copies[0]
    expect(copy.committed.has('shard_0')).toBe(true)
    expect(copy.committed.has('shard_1')).toBe(false)
    expect(copy.committed.has('shard_2')).toBe(true)
  })
})

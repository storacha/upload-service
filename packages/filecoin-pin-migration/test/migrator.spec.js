import { describe, it, expect, vi } from 'vitest'
import { executeMigration } from '../src/migrator/migrator.js'
import { executeStoreMigration } from '../src/migrator/store-executor.js'
import { createMockInitialState, createPieceCID } from './helpers.js'
import { transitionToApproved } from '../src/state.js'

/**
 * @import * as API from '../src/api.js'
 */

/**
 * @param {API.MigrationState} state
 * @param {API.SpaceInventory} inventory
 */
function withInventory(state, inventory) {
  state.spacesInventories[inventory.did] = inventory
  return state
}

/**
 * @param {object} input
 * @param {API.SpaceDID} input.spaceDID
 * @param {number} input.copyIndex
 * @param {API.StorageContext} input.context
 * @returns {API.PerCopyCost}
 */
function createPerCopyCost({ spaceDID, copyIndex, context }) {
  return /** @type {API.PerCopyCost} */ ({
    copyIndex,
    spaceDID,
    context,
    providerId: 10n + BigInt(copyIndex),
    serviceProvider: /** @type {`0x${string}`} */ (
      copyIndex === 0 ? '0x1000' : '0x2000'
    ),
    dataSetId: null,
    isResumed: false,
    bytesToMigrate: 384n,
    currentDataSetSize: 0n,
    lockupUSDFC: 0n,
    sybilFee: 0n,
    rateLockupDelta: 0n,
    ratePerEpoch: 0n,
    ratePerMonth: 0n,
  })
}

/**
 * @param {object} input
 * @param {API.SpaceDID} input.spaceDID
 * @param {API.StorageContext} input.copy0Context
 * @param {API.StorageContext} input.copy1Context
 * @returns {API.MigrationPlan}
 */
function createPlan({ spaceDID, copy0Context, copy1Context }) {
  const copy0Cost = createPerCopyCost({
    spaceDID,
    copyIndex: 0,
    context: copy0Context,
  })
  const copy1Cost = createPerCopyCost({
    spaceDID,
    copyIndex: 1,
    context: copy1Context,
  })

  return /** @type {API.MigrationPlan} */ ({
    totals: {
      uploads: 2,
      shards: 2,
      bytes: 384n,
      bytesToMigrate: 384n,
    },
    costs: {
      perSpace: [
        {
          spaceDID,
          copies: [copy0Cost, copy1Cost],
          isResumed: false,
          bytesToMigrate: 384n,
          currentDataSetSize: 0n,
          lockupUSDFC: 0n,
          sybilFee: 0n,
          rateLockupDelta: 0n,
          ratePerEpoch: 0n,
          ratePerMonth: 0n,
        },
      ],
      summary: {
        totalBytes: 384n,
        totalLockupUSDFC: 0n,
        totalRatePerEpoch: 0n,
        totalRatePerMonth: 0n,
        debt: 0n,
        runway: 0n,
        buffer: 0n,
        availableFunds: 0n,
        skipBufferApplied: false,
        resumedCopies: 0,
      },
      totalDepositNeeded: 0n,
      needsFwssMaxApproval: false,
      ready: true,
      warnings: [],
    },
    warnings: [],
    ready: true,
    fundingAmount: 0n,
  })
}

/**
 * @param {object} input
 * @param {API.SpaceDID} input.spaceDID
 * @param {string} input.name
 * @returns {API.StorageContext & {
 *   presignForCommit: ReturnType<typeof vi.fn>
 *   pull: ReturnType<typeof vi.fn>
 *   commit: ReturnType<typeof vi.fn>
 *   store: ReturnType<typeof vi.fn>
 *   getPieceUrl: ReturnType<typeof vi.fn>
 * }}
 */
function createStorageContext({ spaceDID, name }) {
  let commitCalls = 0
  const context = /**
                   * @type {API.StorageContext & {
                   *   presignForCommit: ReturnType<typeof vi.fn>
                   *   pull: ReturnType<typeof vi.fn>
                   *   commit: ReturnType<typeof vi.fn>
                   *   store: ReturnType<typeof vi.fn>
                   *   getPieceUrl: ReturnType<typeof vi.fn>
                    }} */ (
    /** @type {unknown} */ ({
      dataSetId: null,
      dataSetMetadata: {
        source: 'storacha-migration',
        withIPFSIndexing: '',
        'space-did': spaceDID,
        'space-name': name,
      },
      presignForCommit: vi.fn(async () => new Uint8Array([1, 2, 3])),
      pull: vi.fn(async ({ pieces }) => ({
        pieces: pieces.map(
          /**
           * @param {API.PieceCID} pieceCid
           */
          (pieceCid) => ({
            pieceCid,
            status: 'complete',
          })
        ),
      })),
      commit: vi.fn(async ({ pieces }) => ({
        dataSetId: 100n + BigInt(commitCalls++),
        pieces,
      })),
      store: vi.fn(async () => ({
        pieceCid: createPieceCID(),
      })),
      getPieceUrl: vi.fn(
        /**
         * @param {API.PieceCID} pieceCid
         */
        (pieceCid) => `https://stored.example/${pieceCid}`
      ),
    })
  )
  return context
}

function createAbortError() {
  const error = new Error('This operation was aborted')
  error.name = 'AbortError'
  return error
}

describe('executeMigration', () => {
  it('migrates normal shards via source pull and shardsToStore via store+pull in one commit phase per copy', async () => {
    const spaceDID = /** @type {API.SpaceDID} */ (
      'did:key:z6MkMixedMigrationSpace1'
    )
    const normalPieceCID = createPieceCID().toString()
    const state = withInventory(createMockInitialState(), {
      did: spaceDID,
      name: 'Mixed Space',
      uploads: ['bafy-root-pull', 'bafy-root-store'],
      shards: [
        {
          root: 'bafy-root-pull',
          cid: 'bafy-shard-pull',
          pieceCID: normalPieceCID,
          sourceURL: 'https://source.example/pull',
          sizeBytes: 128n,
        },
      ],
      shardsToStore: [
        {
          root: 'bafy-root-store',
          cid: 'bafy-shard-store',
          sourceURL: 'https://source.example/store',
          sizeBytes: 256n,
        },
      ],
      skippedUploads: [],
      totalBytes: 384n,
      totalSizeToMigrate: 384n,
    })

    const copy0Context = createStorageContext({ spaceDID, name: 'copy0' })
    const copy1Context = createStorageContext({ spaceDID, name: 'copy1' })
    const plan = createPlan({ spaceDID, copy0Context, copy1Context })

    transitionToApproved(state, plan.costs.perSpace)

    /** @type {API.MigrationEvent[]} */
    const events = []
    const fetcher = /** @type {typeof fetch} */ (
      vi.fn(async () => new Response('ok'))
    )

    for await (const event of executeMigration({
      plan,
      state,
      synapse: /** @type {API.Synapse} */ ({}),
      fetcher,
    })) {
      events.push(event)
    }

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(copy0Context.store).toHaveBeenCalledTimes(1)
    expect(copy0Context.pull).toHaveBeenCalledTimes(1)
    expect(copy1Context.pull).toHaveBeenCalledTimes(2)
    expect(copy0Context.commit).toHaveBeenCalledTimes(1)
    expect(copy1Context.commit).toHaveBeenCalledTimes(1)

    const copy0CommittedRoots = copy0Context.commit.mock.calls[0][0].pieces.map(
      /**
       * @param {API.CommitPiece} piece
       */
      (piece) => piece.pieceMetadata.ipfsRootCID
    )
    const copy1CommittedRoots = copy1Context.commit.mock.calls[0][0].pieces.map(
      /**
       * @param {API.CommitPiece} piece
       */
      (piece) => piece.pieceMetadata.ipfsRootCID
    )

    expect(copy0CommittedRoots.sort()).toEqual(
      ['bafy-root-pull', 'bafy-root-store'].sort()
    )
    expect(copy1CommittedRoots.sort()).toEqual(
      ['bafy-root-pull', 'bafy-root-store'].sort()
    )

    const space = state.spaces[spaceDID]
    expect(space.phase).toBe('complete')
    expect(space.copies[0].committed.size).toBe(2)
    expect(space.copies[1].committed.size).toBe(2)
    expect(space.copies[0].storedShards).toHaveProperty('bafy-shard-store')
    expect(state.phase).toBe('complete')

    expect(
      events.some(
        (event) =>
          /** @type {any} */ (event).type === 'migration:space:start' &&
          /** @type {any} */ (event).spaceDID === spaceDID
      )
    ).toBe(true)
    expect(
      events.some(
        (event) =>
          /** @type {any} */ (event).type === 'migration:space:complete' &&
          /** @type {any} */ (event).spaceDID === spaceDID &&
          /** @type {any} */ (event).phase === 'complete'
      )
    ).toBe(true)
    expect(
      events.some(
        (event) =>
          /** @type {any} */ (event).type === 'migration:copy:start' &&
          /** @type {any} */ (event).copyIndex === 0
      )
    ).toBe(true)
    expect(
      events.some(
        (event) =>
          /** @type {any} */ (event).type === 'migration:copy:start' &&
          /** @type {any} */ (event).copyIndex === 1
      )
    ).toBe(true)
    expect(
      events.some(
        (event) =>
          /** @type {any} */ (event).type === 'migration:phase:start' &&
          /** @type {any} */ (event).copyIndex === 0 &&
          /** @type {any} */ (event).phase === 'store' &&
          /** @type {any} */ (event).itemCount === 1 &&
          /** @type {any} */ (event).batchCount === 1
      )
    ).toBe(true)
    expect(
      events.some(
        (event) =>
          /** @type {any} */ (event).type === 'migration:phase:start' &&
          /** @type {any} */ (event).copyIndex === 0 &&
          /** @type {any} */ (event).phase === 'source-pull' &&
          /** @type {any} */ (event).itemCount === 1 &&
          /** @type {any} */ (event).batchCount === 1
      )
    ).toBe(true)
    expect(
      events.some(
        (event) =>
          /** @type {any} */ (event).type === 'migration:phase:start' &&
          /** @type {any} */ (event).copyIndex === 1 &&
          /** @type {any} */ (event).phase === 'secondary-pull' &&
          /** @type {any} */ (event).itemCount === 1 &&
          /** @type {any} */ (event).batchCount === 1
      )
    ).toBe(true)
    expect(
      events.some(
        (event) =>
          /** @type {any} */ (event).type === 'migration:phase:start' &&
          /** @type {any} */ (event).phase === 'commit' &&
          /** @type {any} */ (
            event.copyIndex === 0 || /** @type {any} */ (event).copyIndex === 1
          )
      )
    ).toBe(true)

    const completionEvent = events.at(-1)
    expect(completionEvent?.type).toBe('migration:complete')
    if (completionEvent?.type !== 'migration:complete') {
      throw new Error('expected migration:complete')
    }

    expect(completionEvent.summary.succeeded).toBe(4)
    expect(completionEvent.summary.failed).toBe(0)
    expect(completionEvent.summary.totalBytes).toBe(384n)
  })

  it('stops before copy 1 when copy 0 source pull fully fails for a root', async () => {
    const spaceDID = /** @type {API.SpaceDID} */ (
      'did:key:z6MkMixedMigrationSpace2'
    )
    const sharedRoot = 'bafy-root-shared'
    const state = withInventory(createMockInitialState(), {
      did: spaceDID,
      name: 'Shared Root Space',
      uploads: [sharedRoot],
      shards: [
        {
          root: sharedRoot,
          cid: 'bafy-shard-fail',
          pieceCID: createPieceCID().toString(),
          sourceURL: 'https://source.example/fail',
          sizeBytes: 128n,
        },
        {
          root: sharedRoot,
          cid: 'bafy-shard-success',
          pieceCID: createPieceCID().toString(),
          sourceURL: 'https://source.example/success',
          sizeBytes: 128n,
        },
      ],
      shardsToStore: [],
      skippedUploads: [],
      totalBytes: 256n,
      totalSizeToMigrate: 256n,
    })

    const copy0Context = createStorageContext({ spaceDID, name: 'copy0' })
    const copy1Context = createStorageContext({ spaceDID, name: 'copy1' })
    const failFirstPull =
      /**
       * @param {{ pieces: API.PieceCID[] }} input
       */
      async ({ pieces }) => ({
        pieces: pieces.map(
          /**
           * @param {API.PieceCID} pieceCid
           */
          (pieceCid) => ({
            pieceCid,
            status: 'failed',
          })
        ),
      })
    copy0Context.pull.mockImplementationOnce(failFirstPull)
    copy1Context.pull.mockImplementationOnce(failFirstPull)

    const plan = createPlan({ spaceDID, copy0Context, copy1Context })
    plan.totals.uploads = 1
    plan.totals.bytes = 256n
    plan.totals.bytesToMigrate = 256n
    plan.costs.perSpace[0].bytesToMigrate = 256n
    plan.costs.summary.totalBytes = 256n

    transitionToApproved(state, plan.costs.perSpace)

    /** @type {API.MigrationEvent[]} */
    const events = []
    for await (const event of executeMigration({
      plan,
      state,
      synapse: /** @type {API.Synapse} */ ({}),
      batchSize: 1,
      pullConcurrency: 1,
    })) {
      events.push(event)
    }

    expect(copy0Context.pull).toHaveBeenCalledTimes(2)
    expect(copy1Context.pull).not.toHaveBeenCalled()
    expect(copy0Context.commit).not.toHaveBeenCalled()
    expect(copy1Context.commit).not.toHaveBeenCalled()

    expect(state.spaces[spaceDID].copies[0].failedUploads.has(sharedRoot)).toBe(
      true
    )
    expect(state.spaces[spaceDID].copies[1].failedUploads.has(sharedRoot)).toBe(
      false
    )
    expect(
      state.spaces[spaceDID].copies[0].committed.has('bafy-shard-success')
    ).toBe(false)
    expect(
      state.spaces[spaceDID].copies[1].committed.has('bafy-shard-success')
    ).toBe(false)
    expect(state.spaces[spaceDID].phase).toBe('failed')
    expect(state.phase).toBe('incomplete')

    const completionEvent = events.at(-1)
    expect(completionEvent?.type).toBe('migration:complete')
    if (completionEvent?.type !== 'migration:complete') {
      throw new Error('expected migration:complete')
    }

    expect(completionEvent.summary.succeeded).toBe(0)
    expect(completionEvent.summary.failed).toBe(4)
  })

  it('returns cleanly when aborted during an in-flight source pull batch', async () => {
    const spaceDID = /** @type {API.SpaceDID} */ (
      'did:key:z6MkAbortSourcePullSpace1'
    )
    const firstShardCID = 'bafy-shard-pull-1'
    const state = withInventory(createMockInitialState(), {
      did: spaceDID,
      name: 'Abort Source Pull Space',
      uploads: ['bafy-root-pull'],
      shards: [
        {
          root: 'bafy-root-pull',
          cid: firstShardCID,
          pieceCID: createPieceCID().toString(),
          sourceURL: 'https://source.example/pull-1',
          sizeBytes: 128n,
        },
        {
          root: 'bafy-root-pull-2',
          cid: 'bafy-shard-pull-2',
          pieceCID: createPieceCID().toString(),
          sourceURL: 'https://source.example/pull-2',
          sizeBytes: 128n,
        },
      ],
      shardsToStore: [],
      skippedUploads: [],
      totalBytes: 256n,
      totalSizeToMigrate: 256n,
    })

    const copy0Context = createStorageContext({ spaceDID, name: 'copy0' })
    const copy1Context = createStorageContext({ spaceDID, name: 'copy1' })
    const plan = createPlan({ spaceDID, copy0Context, copy1Context })
    plan.totals.uploads = 1
    plan.totals.shards = 2
    plan.totals.bytes = 256n
    plan.totals.bytesToMigrate = 256n
    plan.costs.perSpace[0].bytesToMigrate = 256n
    plan.costs.summary.totalBytes = 256n

    transitionToApproved(state, plan.costs.perSpace)

    const controller = new AbortController()
    /** @type {() => void} */
    let secondPullStartedResolve = () => {}
    /** @type {Promise<void>} */
    const secondPullStarted = new Promise((resolve) => {
      secondPullStartedResolve = () => resolve()
    })
    /** @type {() => void} */
    let firstPullCompletedResolve = () => {}
    /** @type {Promise<void>} */
    const firstPullCompleted = new Promise((resolve) => {
      firstPullCompletedResolve = () => resolve()
    })
    let pullCalls = 0

    copy0Context.pull.mockImplementationOnce(
      /**
       * @param {{ pieces: API.PieceCID[] }} args
       */
      async ({ pieces }) => {
        pullCalls += 1
        firstPullCompletedResolve()
        return {
          pieces: pieces.map(
            /**
             * @param {API.PieceCID} pieceCid
             */
            (pieceCid) => ({
              pieceCid,
              status: 'complete',
            })
          ),
        }
      }
    )
    copy0Context.pull.mockImplementationOnce(async () => {
      pullCalls += 1
      secondPullStartedResolve()
      await new Promise((_, reject) => {
        controller.signal.addEventListener(
          'abort',
          () => reject(createAbortError()),
          { once: true }
        )
      })
      throw new Error('unreachable')
    })

    const run = (async () => {
      /** @type {API.MigrationEvent[]} */
      const events = []
      for await (const event of executeMigration({
        plan,
        state,
        synapse: /** @type {API.Synapse} */ ({}),
        batchSize: 1,
        pullConcurrency: 2,
        signal: controller.signal,
      })) {
        events.push(event)
      }
      return events
    })()

    await Promise.all([firstPullCompleted, secondPullStarted])
    controller.abort()

    const events = await run

    expect(
      events.find((event) => event.type === 'migration:complete')
    ).toBeUndefined()
    expect(pullCalls).toBe(2)
    expect(copy0Context.commit).not.toHaveBeenCalled()
    expect(copy1Context.pull).not.toHaveBeenCalled()
    expect(state.spaces[spaceDID].copies[0].pulled.has(firstShardCID)).toBe(
      true
    )
    expect(state.spaces[spaceDID].copies[0].pulled.size).toBe(1)
    expect(state.phase).toBe('migrating')
  })

  it('returns cleanly when aborted during an in-flight store batch', async () => {
    const spaceDID = /** @type {API.SpaceDID} */ (
      'did:key:z6MkAbortStoreBatchSpace1'
    )
    const firstShardCID = 'bafy-shard-store-1'
    const state = withInventory(createMockInitialState(), {
      did: spaceDID,
      name: 'Abort Store Space',
      uploads: ['bafy-root-store'],
      shards: [],
      shardsToStore: [
        {
          root: 'bafy-root-store',
          cid: firstShardCID,
          sourceURL: 'https://source.example/store-1',
          sizeBytes: 256n,
        },
        {
          root: 'bafy-root-store-2',
          cid: 'bafy-shard-store-2',
          sourceURL: 'https://source.example/store-2',
          sizeBytes: 256n,
        },
      ],
      skippedUploads: [],
      totalBytes: 512n,
      totalSizeToMigrate: 512n,
    })

    const copy0Context = createStorageContext({ spaceDID, name: 'copy0' })
    const copy1Context = createStorageContext({ spaceDID, name: 'copy1' })
    const plan = createPlan({ spaceDID, copy0Context, copy1Context })
    plan.totals.uploads = 1
    plan.totals.shards = 2
    plan.totals.bytes = 512n
    plan.totals.bytesToMigrate = 512n
    plan.costs.perSpace[0].bytesToMigrate = 512n
    plan.costs.summary.totalBytes = 512n

    transitionToApproved(state, plan.costs.perSpace)

    const controller = new AbortController()
    /** @type {() => void} */
    let secondStoreStartedResolve = () => {}
    /** @type {Promise<void>} */
    const secondStoreStarted = new Promise((resolve) => {
      secondStoreStartedResolve = () => resolve()
    })
    /** @type {() => void} */
    let firstStoreCompletedResolve = () => {}
    /** @type {Promise<void>} */
    const firstStoreCompleted = new Promise((resolve) => {
      firstStoreCompletedResolve = () => resolve()
    })
    let storeCalls = 0

    const fetcher = /** @type {typeof fetch} */ (
      vi.fn(async () => new Response('ok'))
    )

    copy0Context.store.mockImplementationOnce(async () => {
      storeCalls += 1
      firstStoreCompletedResolve()
      return {
        pieceCid: createPieceCID(),
      }
    })
    copy0Context.store.mockImplementationOnce(async () => {
      storeCalls += 1
      secondStoreStartedResolve()
      await new Promise((_, reject) => {
        controller.signal.addEventListener(
          'abort',
          () => reject(createAbortError()),
          { once: true }
        )
      })
      throw new Error('unreachable')
    })

    const run = (async () => {
      /** @type {API.MigrationEvent[]} */
      const events = []
      for await (const event of executeMigration({
        plan,
        state,
        synapse: /** @type {API.Synapse} */ ({}),
        fetcher,
        signal: controller.signal,
      })) {
        events.push(event)
      }
      return events
    })()

    await Promise.all([firstStoreCompleted, secondStoreStarted])
    controller.abort()

    const events = await run

    expect(
      events.find((event) => event.type === 'migration:complete')
    ).toBeUndefined()
    expect(storeCalls).toBe(2)
    expect(copy0Context.commit).not.toHaveBeenCalled()
    expect(copy1Context.pull).not.toHaveBeenCalled()
    expect(state.spaces[spaceDID].copies[0].storedShards).toHaveProperty(
      firstShardCID
    )
    expect(state.phase).toBe('migrating')
  })

  it('does not commit copy 1 when aborted during secondary pull from copy 0', async () => {
    const spaceDID = /** @type {API.SpaceDID} */ (
      'did:key:z6MkAbortSecondaryPullSpace1'
    )
    const firstShardCID = 'bafy-shard-store-secondary-1'
    const state = withInventory(createMockInitialState(), {
      did: spaceDID,
      name: 'Abort Secondary Pull Space',
      uploads: ['bafy-root-store-secondary'],
      shards: [],
      shardsToStore: [
        {
          root: 'bafy-root-store-secondary-1',
          cid: firstShardCID,
          sourceURL: 'https://source.example/store-secondary-1',
          sizeBytes: 256n,
        },
        {
          root: 'bafy-root-store-secondary-2',
          cid: 'bafy-shard-store-secondary-2',
          sourceURL: 'https://source.example/store-secondary-2',
          sizeBytes: 256n,
        },
      ],
      skippedUploads: [],
      totalBytes: 512n,
      totalSizeToMigrate: 512n,
    })

    const copy0Context = createStorageContext({ spaceDID, name: 'copy0' })
    const copy1Context = createStorageContext({ spaceDID, name: 'copy1' })
    const plan = createPlan({ spaceDID, copy0Context, copy1Context })
    plan.totals.uploads = 1
    plan.totals.shards = 2
    plan.totals.bytes = 512n
    plan.totals.bytesToMigrate = 512n
    plan.costs.perSpace[0].bytesToMigrate = 512n
    plan.costs.summary.totalBytes = 512n

    transitionToApproved(state, plan.costs.perSpace)

    const controller = new AbortController()
    /** @type {() => void} */
    let secondPullStartedResolve = () => {}
    /** @type {Promise<void>} */
    const secondPullStarted = new Promise((resolve) => {
      secondPullStartedResolve = () => resolve()
    })
    /** @type {() => void} */
    let firstPullCompletedResolve = () => {}
    /** @type {Promise<void>} */
    const firstPullCompleted = new Promise((resolve) => {
      firstPullCompletedResolve = () => resolve()
    })
    let copy1PullCalls = 0

    copy1Context.pull.mockImplementationOnce(
      /**
       * @param {{ pieces: API.PieceCID[] }} args
       */
      async ({ pieces }) => {
        copy1PullCalls += 1
        firstPullCompletedResolve()
        return {
          pieces: pieces.map(
            /**
             * @param {API.PieceCID} pieceCid
             */
            (pieceCid) => ({
              pieceCid,
              status: 'complete',
            })
          ),
        }
      }
    )
    copy1Context.pull.mockImplementationOnce(async () => {
      copy1PullCalls += 1
      secondPullStartedResolve()
      await new Promise((_, reject) => {
        controller.signal.addEventListener(
          'abort',
          () => reject(createAbortError()),
          { once: true }
        )
      })
      throw new Error('unreachable')
    })

    const fetcher = /** @type {typeof fetch} */ (
      vi.fn(async () => new Response('ok'))
    )

    const run = (async () => {
      /** @type {API.MigrationEvent[]} */
      const events = []
      for await (const event of executeMigration({
        plan,
        state,
        synapse: /** @type {API.Synapse} */ ({}),
        fetcher,
        batchSize: 1,
        pullConcurrency: 2,
        signal: controller.signal,
      })) {
        events.push(event)
      }
      return events
    })()

    await Promise.all([firstPullCompleted, secondPullStarted])
    controller.abort()

    const events = await run

    expect(
      events.find((event) => event.type === 'migration:complete')
    ).toBeUndefined()
    expect(copy0Context.commit).toHaveBeenCalledTimes(1)
    expect(copy1PullCalls).toBe(2)
    expect(copy1Context.commit).not.toHaveBeenCalled()
    expect(state.spaces[spaceDID].copies[1].pulled.has(firstShardCID)).toBe(
      true
    )
    expect(state.spaces[spaceDID].copies[1].committed.size).toBe(0)
    expect(state.phase).toBe('migrating')
  })

  it('forwards commitConcurrency through executeMigration to the commit phase', async () => {
    const spaceDID = /** @type {API.SpaceDID} */ (
      'did:key:z6MkCommitConcurrencyWiring1'
    )
    const pieceCID = createPieceCID().toString()
    const state = withInventory(createMockInitialState(), {
      did: spaceDID,
      name: 'Commit Concurrency Wiring Space',
      uploads: ['bafy-root-1'],
      shards: [
        {
          root: 'bafy-root-1',
          cid: 'bafy-shard-1',
          pieceCID,
          sourceURL: 'https://source.example/s1',
          sizeBytes: 128n,
        },
      ],
      shardsToStore: [],
      skippedUploads: [],
      totalBytes: 128n,
      totalSizeToMigrate: 128n,
    })

    const copy0Context = createStorageContext({ spaceDID, name: 'copy0' })
    const copy1Context = createStorageContext({ spaceDID, name: 'copy1' })
    const plan = createPlan({ spaceDID, copy0Context, copy1Context })
    plan.totals.shards = 1
    plan.totals.bytes = 128n
    plan.totals.bytesToMigrate = 128n

    transitionToApproved(state, plan.costs.perSpace)

    for await (const _event of executeMigration({
      plan,
      state,
      synapse: /** @type {API.Synapse} */ ({}),
      commitConcurrency: 2,
    })) {
      // drain
    }

    expect(state.phase).toBe('complete')
    expect(state.spaces[spaceDID].copies[0].committed.size).toBe(1)
    expect(state.spaces[spaceDID].copies[1].committed.size).toBe(1)
  })

  it('forwards commitConcurrency through executeStoreMigration to the commit phase', async () => {
    const spaceDID = /** @type {API.SpaceDID} */ (
      'did:key:z6MkCommitConcurrencyWiring2'
    )
    const state = withInventory(createMockInitialState(), {
      did: spaceDID,
      name: 'Store Commit Concurrency Wiring Space',
      uploads: ['bafy-root-store-1'],
      shards: [],
      shardsToStore: [
        {
          root: 'bafy-root-store-1',
          cid: 'bafy-shard-store-1',
          sourceURL: 'https://source.example/store-1',
          sizeBytes: 256n,
        },
      ],
      skippedUploads: [],
      totalBytes: 256n,
      totalSizeToMigrate: 256n,
    })

    const copy0Context = createStorageContext({ spaceDID, name: 'copy0' })
    const copy1Context = createStorageContext({ spaceDID, name: 'copy1' })
    const plan = createPlan({ spaceDID, copy0Context, copy1Context })
    plan.totals.shards = 1
    plan.totals.bytes = 256n
    plan.totals.bytesToMigrate = 256n
    plan.costs.perSpace[0].bytesToMigrate = 256n
    plan.costs.summary.totalBytes = 256n

    transitionToApproved(state, plan.costs.perSpace)

    const fetcher = /** @type {typeof fetch} */ (
      vi.fn(async () => new Response('ok'))
    )

    for await (const _event of executeStoreMigration({
      plan,
      state,
      synapse: /** @type {API.Synapse} */ ({}),
      fetcher,
      commitConcurrency: 2,
    })) {
      // drain
    }

    expect(state.phase).toBe('complete')
    expect(state.spaces[spaceDID].copies[0].committed.size).toBe(1)
    expect(state.spaces[spaceDID].copies[1].committed.size).toBe(1)
  })
})

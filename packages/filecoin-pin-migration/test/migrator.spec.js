import { describe, it, expect, vi, afterEach } from 'vitest'
import { executeMigration } from '../src/migrator/migrator.js'
import { executeStoreMigration } from '../src/migrator/store-executor.js'
import { createTestStore, createPieceCID } from './helpers.js'
import { DEFAULT_STORE_OPERATION_RETRIES } from '../src/constants.js'
import {
  clearFailedUploadsForRetry,
  commitKey,
  transitionToApproved,
} from '../src/state.js'

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
 * Force duplicate-root commit entries to split across add-pieces batches.
 *
 * @param {string} label
 */
function createOversizedRoot(label) {
  return `bafy-root-${label}-${label.repeat(3800)}`
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
    withCDN: true,
    isResumed: false,
    bytesToMigrate: 384n,
    currentDataSetSize: 0n,
    lockupUSDFC: 0n,
    sybilFee: 0n,
    cdnFixedLockup: 0n,
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
          cdnFixedLockup: 0n,
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
 * @param {bigint | null} [input.dataSetId]
 * @returns {API.StorageContext & {
 *   presignForCommit: ReturnType<typeof vi.fn>
 *   pull: ReturnType<typeof vi.fn>
 *   commit: ReturnType<typeof vi.fn>
 *   store: ReturnType<typeof vi.fn>
 *   getPieceUrl: ReturnType<typeof vi.fn>
 * }}
 */
function createStorageContext({ spaceDID, name, dataSetId = null }) {
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
      dataSetId,
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

function createDeferred() {
  /** @type {(value?: unknown) => void} */
  let resolve = () => {}
  /** @type {(reason?: unknown) => void} */
  let reject = () => {}
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, resolve, reject }
}

/**
 * @param {number} ms
 */
function createTimeout(ms) {
  return new Promise((resolve) => {
    setTimeout(() => resolve('timeout'), ms)
  })
}

/**
 * @param {ReadableStream<Uint8Array>} stream
 */
async function readStreamBytes(stream) {
  const reader = stream.getReader()
  let total = 0n
  let done = false

  while (!done) {
    const readResult = await reader.read()
    done = readResult.done
    if (done) break

    const value = readResult.value
    if (!value) {
      throw new Error('expected readable stream chunk')
    }

    total += BigInt(value.byteLength)
  }

  return total
}

describe('executeMigration', () => {
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

  it('migrates normal shards via source pull and shardsToStore via store+pull in one commit phase per copy', async () => {
    const spaceDID = /** @type {API.SpaceDID} */ (
      'did:key:z6MkMixedMigrationSpace1'
    )
    const normalPieceCID = createPieceCID().toString()
    const store = await openStore()
    const state = store.getState()
    withInventory(state, {
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
      store,
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

    const finalCheckpointEvent = events.at(-2)
    expect(finalCheckpointEvent?.type).toBe('state:checkpoint')
    if (finalCheckpointEvent?.type !== 'state:checkpoint') {
      throw new Error(
        'expected final state:checkpoint before migration:complete'
      )
    }
    expect(finalCheckpointEvent.state.phase).toBe('complete')

    const completionEvent = events.at(-1)
    expect(completionEvent?.type).toBe('migration:complete')
    if (completionEvent?.type !== 'migration:complete') {
      throw new Error('expected migration:complete')
    }

    expect(completionEvent.summary.succeeded).toBe(4)
    expect(completionEvent.summary.failed).toBe(0)
    expect(completionEvent.summary.totalBytes).toBe(384n)
  })

  it('streams shard bytes into context.store()', async () => {
    const spaceDID = /** @type {API.SpaceDID} */ (
      'did:key:z6MkStoreByteStreamSpace'
    )
    const store = await openStore()
    const state = store.getState()
    withInventory(state, {
      did: spaceDID,
      name: 'Store Byte Stream Space',
      uploads: ['bafy-root-store-bytes'],
      shards: [],
      shardsToStore: [
        {
          root: 'bafy-root-store-bytes',
          cid: 'bafy-shard-store-bytes',
          sourceURL: 'https://source.example/store-bytes',
          sizeBytes: 4n,
        },
      ],
      skippedUploads: [],
      totalBytes: 4n,
      totalSizeToMigrate: 4n,
    })

    const copy0Context = createStorageContext({ spaceDID, name: 'copy0' })
    const copy1Context = createStorageContext({ spaceDID, name: 'copy1' })
    const plan = createPlan({ spaceDID, copy0Context, copy1Context })
    plan.totals.uploads = 1
    plan.totals.shards = 1
    plan.totals.bytes = 4n
    plan.totals.bytesToMigrate = 4n
    plan.costs.perSpace[0].bytesToMigrate = 4n
    plan.costs.summary.totalBytes = 4n

    transitionToApproved(state, plan.costs.perSpace)

    let storedBytes = 0n
    copy0Context.store.mockImplementationOnce(async (body) => {
      storedBytes = await readStreamBytes(
        /** @type {ReadableStream<Uint8Array>} */ (body)
      )
      return { pieceCid: createPieceCID() }
    })

    const fetcher = /** @type {typeof fetch} */ (
      vi.fn(
        async () =>
          new Response(new Uint8Array([1, 2, 3, 4]), {
            headers: { 'content-length': '4' },
          })
      )
    )

    for await (const _event of executeMigration({
      plan,
      store,
      synapse: /** @type {API.Synapse} */ ({}),
      fetcher,
    })) {
      // drain
    }

    expect(storedBytes).toBe(4n)
  })

  it('mutates stored-shard progress before a slower sibling settles but checkpoints once per batch', async () => {
    const spaceDID = /** @type {API.SpaceDID} */ (
      'did:key:z6MkStoreCheckpointStreamingSpace'
    )
    const firstShardCID = 'bafy-shard-store-fast-success'
    const secondShardCID = 'bafy-shard-store-slow-success'
    const store = await openStore()
    const state = store.getState()
    withInventory(state, {
      did: spaceDID,
      name: 'Store Streaming Checkpoint Space',
      uploads: ['bafy-root-store-fast', 'bafy-root-store-slow'],
      shards: [],
      shardsToStore: [
        {
          root: 'bafy-root-store-fast',
          cid: firstShardCID,
          sourceURL: 'https://source.example/store-fast-success',
          sizeBytes: 128n,
        },
        {
          root: 'bafy-root-store-slow',
          cid: secondShardCID,
          sourceURL: 'https://source.example/store-slow-success',
          sizeBytes: 128n,
        },
      ],
      skippedUploads: [],
      totalBytes: 256n,
      totalSizeToMigrate: 256n,
    })

    const copy0Context = createStorageContext({ spaceDID, name: 'copy0' })
    const copy1Context = createStorageContext({ spaceDID, name: 'copy1' })
    const plan = createPlan({ spaceDID, copy0Context, copy1Context })

    transitionToApproved(state, plan.costs.perSpace)

    const slowStoreStarted = createDeferred()
    const slowStoreRelease = createDeferred()

    copy0Context.store.mockImplementationOnce(async () => ({
      pieceCid: createPieceCID(),
    }))
    copy0Context.store.mockImplementationOnce(async () => {
      slowStoreStarted.resolve()
      await slowStoreRelease.promise
      return { pieceCid: createPieceCID() }
    })

    const fetcher = /** @type {typeof fetch} */ (
      vi.fn(async () => new Response('ok'))
    )
    const iterator = executeMigration({
      plan,
      store,
      synapse: /** @type {API.Synapse} */ ({}),
      batchSize: 2,
      storeConcurrency: 2,
      fetcher,
    })[Symbol.asyncIterator]()

    let waitingForStorePhase = true
    while (waitingForStorePhase) {
      const next = await iterator.next()
      if (next.done) {
        throw new Error('expected store phase to start before migration ended')
      }
      if (
        next.value.type === 'migration:phase:start' &&
        next.value.phase === 'store'
      ) {
        waitingForStorePhase = false
      }
    }

    const firstResult = iterator.next()
    await slowStoreStarted.promise

    const earlyEvent = await Promise.race([firstResult, createTimeout(100)])
    expect(earlyEvent).toBe('timeout')
    if (earlyEvent === 'timeout' || earlyEvent.done) {
      // expected: progress mutates in memory, but checkpoint waits for batch end
    } else {
      throw new Error('expected no early store checkpoint event')
    }
    expect(state.spaces[spaceDID].copies[0].storedShards).toHaveProperty(
      firstShardCID
    )
    expect(state.spaces[spaceDID].copies[0].storedShards).not.toHaveProperty(
      secondShardCID
    )

    slowStoreRelease.resolve()

    const settledCheckpoint = await firstResult
    expect(settledCheckpoint.done).toBe(false)
    if (settledCheckpoint.done) {
      throw new Error('expected store batch checkpoint event')
    }
    expect(settledCheckpoint.value.type).toBe('state:checkpoint')
    expect(state.spaces[spaceDID].copies[0].storedShards).toHaveProperty(
      secondShardCID
    )

    while (!(await iterator.next()).done) {
      // drain
    }
  })

  it('emits store failures before a slower sibling settles', async () => {
    const spaceDID = /** @type {API.SpaceDID} */ (
      'did:key:z6MkStoreFailureStreamingSpace'
    )
    const failedRoot = 'bafy-root-store-fast-failure'
    const store = await openStore()
    const state = store.getState()
    withInventory(state, {
      did: spaceDID,
      name: 'Store Streaming Failure Space',
      uploads: [failedRoot, 'bafy-root-store-slow'],
      shards: [],
      shardsToStore: [
        {
          root: failedRoot,
          cid: 'bafy-shard-store-fast-failure',
          sourceURL: 'https://source.example/store-fast-failure',
          sizeBytes: 128n,
        },
        {
          root: 'bafy-root-store-slow',
          cid: 'bafy-shard-store-slow',
          sourceURL: 'https://source.example/store-slow',
          sizeBytes: 128n,
        },
      ],
      skippedUploads: [],
      totalBytes: 256n,
      totalSizeToMigrate: 256n,
    })

    const copy0Context = createStorageContext({ spaceDID, name: 'copy0' })
    const copy1Context = createStorageContext({ spaceDID, name: 'copy1' })
    const plan = createPlan({ spaceDID, copy0Context, copy1Context })

    transitionToApproved(state, plan.costs.perSpace)

    const slowStoreStarted = createDeferred()
    const slowStoreRelease = createDeferred()

    copy0Context.store.mockImplementationOnce(async () => {
      throw new Error('store failed fast')
    })
    copy0Context.store.mockImplementationOnce(async () => {
      slowStoreStarted.resolve()
      await slowStoreRelease.promise
      return { pieceCid: createPieceCID() }
    })

    const fetcher = /** @type {typeof fetch} */ (
      vi.fn(async () => new Response('ok'))
    )
    const iterator = executeMigration({
      plan,
      store,
      synapse: /** @type {API.Synapse} */ ({}),
      batchSize: 2,
      storeConcurrency: 2,
      fetcher,
    })[Symbol.asyncIterator]()

    let waitingForStorePhase = true
    while (waitingForStorePhase) {
      const next = await iterator.next()
      if (next.done) {
        throw new Error('expected store phase to start before migration ended')
      }
      if (
        next.value.type === 'migration:phase:start' &&
        next.value.phase === 'store'
      ) {
        waitingForStorePhase = false
      }
    }

    const firstResult = iterator.next()
    await slowStoreStarted.promise

    const earlyEvent = await Promise.race([firstResult, createTimeout(100)])
    expect(earlyEvent).not.toBe('timeout')
    if (earlyEvent === 'timeout' || earlyEvent.done) {
      throw new Error('expected early store failure event')
    }

    expect(earlyEvent.value.type).toBe('migration:batch:failed')
    if (earlyEvent.value.type !== 'migration:batch:failed') {
      throw new Error('expected migration:batch:failed')
    }
    expect(earlyEvent.value.stage).toBe('store')
    expect(earlyEvent.value.roots).toEqual([failedRoot])
    expect(state.spaces[spaceDID].copies[0].failedUploads.has(failedRoot)).toBe(
      true
    )

    slowStoreRelease.resolve()

    while (!(await iterator.next()).done) {
      // drain
    }
  })

  it('retries transient fetch failures before a later store attempt succeeds', async () => {
    const spaceDID = /** @type {API.SpaceDID} */ (
      'did:key:z6MkStoreFetchRetrySuccessSpace'
    )
    const store = await openStore()
    const state = store.getState()
    withInventory(state, {
      did: spaceDID,
      name: 'Store Fetch Retry Success Space',
      uploads: ['bafy-root-store-retry'],
      shards: [],
      shardsToStore: [
        {
          root: 'bafy-root-store-retry',
          cid: 'bafy-shard-store-retry',
          sourceURL: 'https://source.example/store-retry',
          sizeBytes: 4n,
        },
      ],
      skippedUploads: [],
      totalBytes: 4n,
      totalSizeToMigrate: 4n,
    })

    const copy0Context = createStorageContext({ spaceDID, name: 'copy0' })
    const copy1Context = createStorageContext({ spaceDID, name: 'copy1' })
    const plan = createPlan({ spaceDID, copy0Context, copy1Context })
    plan.totals.uploads = 1
    plan.totals.shards = 1
    plan.totals.bytes = 4n
    plan.totals.bytesToMigrate = 4n
    plan.costs.perSpace[0].bytesToMigrate = 4n
    plan.costs.summary.totalBytes = 4n

    transitionToApproved(state, plan.costs.perSpace)

    let fetchCalls = 0
    const fetcher = /** @type {typeof fetch} */ (
      vi.fn(async () => {
        fetchCalls += 1
        if (fetchCalls < 3) {
          return new Response('temporary', { status: 503 })
        }

        return new Response(new Uint8Array([1, 2, 3, 4]), {
          headers: { 'content-length': '4' },
        })
      })
    )

    /** @type {API.MigrationEvent[]} */
    const events = []
    for await (const event of executeMigration({
      plan,
      store,
      synapse: /** @type {API.Synapse} */ ({}),
      fetcher,
    })) {
      events.push(event)
    }

    expect(fetchCalls).toBe(3)
    expect(copy0Context.store).toHaveBeenCalledTimes(1)
    expect(
      events.some((event) => event.type === 'migration:batch:failed')
    ).toBe(false)
  })

  it('adds shard, byte, and retry context to exhausted store failure events', async () => {
    const spaceDID = /** @type {API.SpaceDID} */ (
      'did:key:z6MkStoreFailureContextSpace'
    )
    const shardCID = 'bafy-shard-store-error'
    const sourceURL = 'https://source.example/store-error'
    const store = await openStore()
    const state = store.getState()
    withInventory(state, {
      did: spaceDID,
      name: 'Store Failure Context Space',
      uploads: ['bafy-root-store-error'],
      shards: [],
      shardsToStore: [
        {
          root: 'bafy-root-store-error',
          cid: shardCID,
          sourceURL,
          sizeBytes: 4n,
        },
      ],
      skippedUploads: [],
      totalBytes: 4n,
      totalSizeToMigrate: 4n,
    })

    const copy0Context = createStorageContext({ spaceDID, name: 'copy0' })
    const copy1Context = createStorageContext({ spaceDID, name: 'copy1' })
    const plan = createPlan({ spaceDID, copy0Context, copy1Context })
    plan.totals.uploads = 1
    plan.totals.shards = 1
    plan.totals.bytes = 4n
    plan.totals.bytesToMigrate = 4n
    plan.costs.perSpace[0].bytesToMigrate = 4n
    plan.costs.summary.totalBytes = 4n

    transitionToApproved(state, plan.costs.perSpace)

    copy0Context.store.mockImplementation(async () => {
      throw Object.assign(new Error('store failed'), { retryable: true })
    })

    /** @type {API.MigrationEvent[]} */
    const events = []
    const fetcher = /** @type {typeof fetch} */ (
      vi.fn(
        async () =>
          new Response(new Uint8Array([1, 2, 3, 4]), {
            headers: { 'content-length': '4' },
          })
      )
    )

    for await (const event of executeMigration({
      plan,
      store,
      synapse: /** @type {API.Synapse} */ ({}),
      fetcher,
    })) {
      events.push(event)
    }

    const failedEvent = events.find(
      (event) =>
        event.type === 'migration:batch:failed' && event.stage === 'store'
    )
    if (!failedEvent || failedEvent.type !== 'migration:batch:failed') {
      throw new Error('expected store migration:batch:failed event')
    }

    expect(failedEvent.error.message).toContain('store failed')
    expect(failedEvent.error.message).toContain(`shardCid=${shardCID}`)
    expect(failedEvent.error.message).toContain(`sourceURL=${sourceURL}`)
    expect(failedEvent.error.message).toContain('expectedBytes=4')
    expect(failedEvent.error.message).toContain('observedBytes=0')
    expect(failedEvent.error.message).toContain('failureStep=store')
    expect(failedEvent.error.message).toContain('attempts=5')
    const err = /** @type {API.StoreDiagnosticError} */ (
      /** @type {unknown} */ (failedEvent.error)
    )
    expect(err.shardCid).toBe(shardCID)
    expect(err.sourceURL).toBe(sourceURL)
    expect(err.expectedBytes).toBe(4n)
    expect(err.observedBytes).toBe(0n)
    expect(err.failureStep).toBe('store')
    expect(err.attempts).toBe(DEFAULT_STORE_OPERATION_RETRIES + 1)
    expect(err.retriesConfigured).toBe(DEFAULT_STORE_OPERATION_RETRIES)
    expect(err.elapsedMs).toBeGreaterThanOrEqual(0)
    expect(copy0Context.store).toHaveBeenCalledTimes(
      DEFAULT_STORE_OPERATION_RETRIES + 1
    )
  })

  it('marks fetch-stage store failures as retryable or immediate based on HTTP status', async () => {
    const cases = [
      {
        label: 'retries 503 responses',
        status: 503,
        expectedAttempts: DEFAULT_STORE_OPERATION_RETRIES + 1,
      },
      {
        label: 'does not retry 404 responses',
        status: 404,
        expectedAttempts: 1,
      },
    ]

    for (const testCase of cases) {
      const spaceDID = /** @type {API.SpaceDID} */ (
        `did:key:z6MkStoreFetchStatusSpace${testCase.status}`
      )
      const store = await openStore()
      const state = store.getState()
      withInventory(state, {
        did: spaceDID,
        name: 'Store Fetch Status Space',
        uploads: ['bafy-root-store-status'],
        shards: [],
        shardsToStore: [
          {
            root: 'bafy-root-store-status',
            cid: 'bafy-shard-store-status',
            sourceURL: 'https://source.example/store-status',
            sizeBytes: 4n,
          },
        ],
        skippedUploads: [],
        totalBytes: 4n,
        totalSizeToMigrate: 4n,
      })

      const copy0Context = createStorageContext({ spaceDID, name: 'copy0' })
      const copy1Context = createStorageContext({ spaceDID, name: 'copy1' })
      const plan = createPlan({ spaceDID, copy0Context, copy1Context })
      plan.totals.uploads = 1
      plan.totals.shards = 1
      plan.totals.bytes = 4n
      plan.totals.bytesToMigrate = 4n
      plan.costs.perSpace[0].bytesToMigrate = 4n
      plan.costs.summary.totalBytes = 4n

      transitionToApproved(state, plan.costs.perSpace)

      let fetchCalls = 0
      const fetcher = /** @type {typeof fetch} */ (
        vi.fn(async () => {
          fetchCalls += 1
          return new Response('missing', { status: testCase.status })
        })
      )

      /** @type {API.MigrationEvent[]} */
      const events = []
      for await (const event of executeMigration({
        plan,
        store,
        synapse: /** @type {API.Synapse} */ ({}),
        fetcher,
      })) {
        events.push(event)
      }

      const failedEvent = events.find(
        (event) =>
          event.type === 'migration:batch:failed' && event.stage === 'store'
      )
      if (!failedEvent || failedEvent.type !== 'migration:batch:failed') {
        throw new Error(`expected store failure event for ${testCase.label}`)
      }

      const err = /** @type {API.StoreDiagnosticError} */ (
        /** @type {unknown} */ (failedEvent.error)
      )
      expect(fetchCalls, testCase.label).toBe(testCase.expectedAttempts)
      expect(copy0Context.store, testCase.label).not.toHaveBeenCalled()
      expect(err.failureStep, testCase.label).toBe('fetch')
      expect(err.status, testCase.label).toBe(testCase.status)
      expect(err.attempts, testCase.label).toBe(testCase.expectedAttempts)
      expect(err.retriesConfigured, testCase.label).toBe(
        DEFAULT_STORE_OPERATION_RETRIES
      )
      expect(err.expectedBytes, testCase.label).toBeNull()
      expect(err.observedBytes, testCase.label).toBe(0n)
    }
  })

  it('withholds a failed store root from copy 1 even when success and failure land in separate batches', async () => {
    const spaceDID = /** @type {API.SpaceDID} */ (
      'did:key:z6MkStoreIsolationSpace1'
    )
    const failedRoot = 'bafy-root-store-failed'
    const firstShardCID = 'bafy-shard-store-failed-1'
    const secondShardCID = 'bafy-shard-store-failed-2'
    const store = await openStore()
    const state = store.getState()
    withInventory(state, {
      did: spaceDID,
      name: 'Store Isolation Space',
      uploads: [failedRoot],
      shards: [],
      shardsToStore: [
        {
          root: failedRoot,
          cid: firstShardCID,
          sourceURL: 'https://source.example/store-failed-1',
          sizeBytes: 256n,
        },
        {
          root: failedRoot,
          cid: secondShardCID,
          sourceURL: 'https://source.example/store-failed-2',
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

    let storeCalls = 0
    copy0Context.store.mockImplementation(async () => {
      storeCalls += 1
      if (storeCalls === 1) {
        return { pieceCid: createPieceCID() }
      }

      throw Object.assign(new Error('store failed'), { retryable: true })
    })

    /** @type {API.MigrationEvent[]} */
    const events = []
    const fetcher = /** @type {typeof fetch} */ (
      vi.fn(async () => new Response('ok'))
    )

    for await (const event of executeMigration({
      plan,
      store,
      synapse: /** @type {API.Synapse} */ ({}),
      batchSize: 1,
      fetcher,
    })) {
      events.push(event)
    }

    expect(copy0Context.store).toHaveBeenCalledTimes(
      DEFAULT_STORE_OPERATION_RETRIES + 2
    )
    expect(copy0Context.commit).not.toHaveBeenCalled()
    expect(copy1Context.pull).not.toHaveBeenCalled()
    expect(copy1Context.commit).not.toHaveBeenCalled()
    expect(state.spaces[spaceDID].copies[0].storedShards).toHaveProperty(
      firstShardCID
    )
    expect(state.spaces[spaceDID].copies[0].failedUploads.has(failedRoot)).toBe(
      true
    )
    expect(state.spaces[spaceDID].copies[1].failedUploads.has(failedRoot)).toBe(
      false
    )
    expect(
      events.some(
        (event) =>
          event.type === 'migration:phase:start' &&
          event.copyIndex === 1 &&
          event.phase === 'secondary-pull'
      )
    ).toBe(false)
    expect(state.spaces[spaceDID].phase).toBe('failed')
    expect(state.phase).toBe('incomplete')
  })

  it('lets clean store roots proceed while withholding failed store roots from copy 1', async () => {
    const spaceDID = /** @type {API.SpaceDID} */ (
      'did:key:z6MkStoreIsolationSpace2'
    )
    const failedRoot = 'bafy-root-store-failed'
    const cleanRoot = 'bafy-root-store-clean'
    const failedShardCID = 'bafy-shard-store-failed-1'
    const cleanShardCID = 'bafy-shard-store-clean-1'
    const store = await openStore()
    const state = store.getState()
    withInventory(state, {
      did: spaceDID,
      name: 'Mixed Store Roots Space',
      uploads: [failedRoot, cleanRoot],
      shards: [],
      shardsToStore: [
        {
          root: failedRoot,
          cid: failedShardCID,
          sourceURL: 'https://source.example/store-failed-1',
          sizeBytes: 256n,
        },
        {
          root: failedRoot,
          cid: 'bafy-shard-store-failed-2',
          sourceURL: 'https://source.example/store-failed-2',
          sizeBytes: 256n,
        },
        {
          root: cleanRoot,
          cid: cleanShardCID,
          sourceURL: 'https://source.example/store-clean-1',
          sizeBytes: 256n,
        },
      ],
      skippedUploads: [],
      totalBytes: 768n,
      totalSizeToMigrate: 768n,
    })

    const copy0Context = createStorageContext({ spaceDID, name: 'copy0' })
    const copy1Context = createStorageContext({ spaceDID, name: 'copy1' })
    const plan = createPlan({ spaceDID, copy0Context, copy1Context })
    plan.totals.uploads = 2
    plan.totals.shards = 3
    plan.totals.bytes = 768n
    plan.totals.bytesToMigrate = 768n
    plan.costs.perSpace[0].bytesToMigrate = 768n
    plan.costs.summary.totalBytes = 768n

    transitionToApproved(state, plan.costs.perSpace)

    let storeCalls = 0
    copy0Context.store.mockImplementation(async () => {
      storeCalls += 1
      if (
        storeCalls === 1 ||
        storeCalls === DEFAULT_STORE_OPERATION_RETRIES + 3
      ) {
        return { pieceCid: createPieceCID() }
      }

      throw Object.assign(new Error('store failed'), { retryable: true })
    })

    const fetcher = /** @type {typeof fetch} */ (
      vi.fn(async () => new Response('ok'))
    )

    for await (const _event of executeMigration({
      plan,
      store,
      synapse: /** @type {API.Synapse} */ ({}),
      batchSize: 1,
      fetcher,
    })) {
      // drain
    }

    expect(copy0Context.commit).toHaveBeenCalledTimes(1)
    expect(copy1Context.pull).toHaveBeenCalledTimes(1)
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

    expect(copy0CommittedRoots).toEqual([cleanRoot])
    expect(copy1CommittedRoots).toEqual([cleanRoot])
    expect(state.spaces[spaceDID].copies[0].failedUploads.has(failedRoot)).toBe(
      true
    )
    expect(state.spaces[spaceDID].copies[0].storedShards).toHaveProperty(
      failedShardCID
    )
    expect(state.spaces[spaceDID].copies[0].storedShards).toHaveProperty(
      cleanShardCID
    )
  })

  it('withholds persisted stored shards from copy 1 until failed uploads are cleared', async () => {
    const spaceDID = /** @type {API.SpaceDID} */ (
      'did:key:z6MkStoreIsolationSpace3'
    )
    const root = 'bafy-root-store-persisted'
    const shardCID = 'bafy-shard-store-persisted-1'
    const storedPieceCID = createPieceCID().toString()
    const store = await openStore()
    const state = store.getState()
    withInventory(state, {
      did: spaceDID,
      name: 'Persisted Store Root Space',
      uploads: [root],
      shards: [],
      shardsToStore: [
        {
          root,
          cid: shardCID,
          sourceURL: 'https://source.example/store-persisted-1',
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
    plan.totals.uploads = 1
    plan.totals.shards = 1
    plan.totals.bytes = 256n
    plan.totals.bytesToMigrate = 256n
    plan.costs.perSpace[0].bytesToMigrate = 256n
    plan.costs.summary.totalBytes = 256n

    transitionToApproved(state, plan.costs.perSpace)
    state.spaces[spaceDID].copies[0].storedShards[shardCID] = storedPieceCID
    state.spaces[spaceDID].copies[0].failedUploads.add(root)

    const fetcher = /** @type {typeof fetch} */ (
      vi.fn(async () => new Response('ok'))
    )

    for await (const _event of executeMigration({
      plan,
      store,
      synapse: /** @type {API.Synapse} */ ({}),
      fetcher,
    })) {
      // drain
    }

    expect(copy0Context.store).not.toHaveBeenCalled()
    expect(copy0Context.commit).not.toHaveBeenCalled()
    expect(copy1Context.pull).not.toHaveBeenCalled()
    expect(copy1Context.commit).not.toHaveBeenCalled()
    expect(state.spaces[spaceDID].copies[0].storedShards[shardCID]).toBe(
      storedPieceCID
    )
    expect(state.spaces[spaceDID].copies[0].failedUploads.has(root)).toBe(true)
  })

  it('reuses persisted stored shards after failed uploads are cleared for retry', async () => {
    const spaceDID = /** @type {API.SpaceDID} */ (
      'did:key:z6MkStoreIsolationSpace4'
    )
    const root = 'bafy-root-store-retry'
    const shardCID = 'bafy-shard-store-retry-1'
    const storedPieceCID = createPieceCID().toString()
    const store = await openStore()
    const state = store.getState()
    withInventory(state, {
      did: spaceDID,
      name: 'Retry Reuse Store Root Space',
      uploads: [root],
      shards: [],
      shardsToStore: [
        {
          root,
          cid: shardCID,
          sourceURL: 'https://source.example/store-retry-1',
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
    plan.totals.uploads = 1
    plan.totals.shards = 1
    plan.totals.bytes = 256n
    plan.totals.bytesToMigrate = 256n
    plan.costs.perSpace[0].bytesToMigrate = 256n
    plan.costs.summary.totalBytes = 256n

    transitionToApproved(state, plan.costs.perSpace)
    state.spaces[spaceDID].copies[0].storedShards[shardCID] = storedPieceCID
    state.spaces[spaceDID].copies[0].failedUploads.add(root)
    clearFailedUploadsForRetry(state, spaceDID)

    const fetcher = /** @type {typeof fetch} */ (
      vi.fn(async () => new Response('ok'))
    )

    for await (const _event of executeMigration({
      plan,
      store,
      synapse: /** @type {API.Synapse} */ ({}),
      fetcher,
    })) {
      // drain
    }

    expect(copy0Context.store).not.toHaveBeenCalled()
    expect(copy0Context.commit).toHaveBeenCalledTimes(1)
    expect(copy1Context.pull).toHaveBeenCalledTimes(1)
    expect(copy1Context.commit).toHaveBeenCalledTimes(1)
    expect(
      state.spaces[spaceDID].copies[0].committed.has(commitKey(shardCID, root))
    ).toBe(true)
    expect(
      state.spaces[spaceDID].copies[1].committed.has(commitKey(shardCID, root))
    ).toBe(true)
    expect(state.phase).toBe('complete')
  })

  it('pulls one source shard per copy but commits it once per root when roots share the same shard CID', async () => {
    const spaceDID = /** @type {API.SpaceDID} */ (
      'did:key:z6MkDuplicateRootSourceSpace1'
    )
    const sharedShardCID = 'bafy-shard-source-shared'
    const sharedPieceCID = createPieceCID().toString()
    const rootA = 'bafy-root-source-a'
    const rootB = 'bafy-root-source-b'
    const store = await openStore()
    const state = store.getState()
    withInventory(state, {
      did: spaceDID,
      name: 'Duplicate Root Source Space',
      uploads: [rootA, rootB],
      shards: [
        {
          root: rootA,
          cid: sharedShardCID,
          pieceCID: sharedPieceCID,
          sourceURL: 'https://source.example/source-shared-a',
          sizeBytes: 128n,
        },
        {
          root: rootB,
          cid: sharedShardCID,
          pieceCID: sharedPieceCID,
          sourceURL: 'https://source.example/source-shared-b',
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
    plan.totals.uploads = 2
    plan.totals.shards = 2
    plan.totals.bytes = 256n
    plan.totals.bytesToMigrate = 256n
    plan.costs.perSpace[0].bytesToMigrate = 256n
    plan.costs.summary.totalBytes = 256n

    transitionToApproved(state, plan.costs.perSpace)

    for await (const _event of executeMigration({
      plan,
      store,
      synapse: /** @type {API.Synapse} */ ({}),
    })) {
      // drain
    }

    expect(copy0Context.pull).toHaveBeenCalledTimes(1)
    expect(copy1Context.pull).toHaveBeenCalledTimes(1)
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

    expect(copy0CommittedRoots.sort()).toEqual([rootA, rootB].sort())
    expect(copy1CommittedRoots.sort()).toEqual([rootA, rootB].sort())

    expect([...state.spaces[spaceDID].copies[0].committed].sort()).toEqual(
      [
        commitKey(sharedShardCID, rootA),
        commitKey(sharedShardCID, rootB),
      ].sort()
    )
    expect([...state.spaces[spaceDID].copies[1].committed].sort()).toEqual(
      [
        commitKey(sharedShardCID, rootA),
        commitKey(sharedShardCID, rootB),
      ].sort()
    )
    expect(state.phase).toBe('complete')
  })

  it('expands failed source-pull roots for a multi-root shard from one representative failure', async () => {
    const spaceDID = /** @type {API.SpaceDID} */ (
      'did:key:z6MkDuplicateRootSourceFailureSpace1'
    )
    const sharedShardCID = 'bafy-shard-source-shared-failure'
    const sharedPieceCID = createPieceCID().toString()
    const rootA = 'bafy-root-source-failure-a'
    const rootB = 'bafy-root-source-failure-b'
    const store = await openStore()
    const state = store.getState()
    withInventory(state, {
      did: spaceDID,
      name: 'Duplicate Root Source Failure Space',
      uploads: [rootA, rootB],
      shards: [
        {
          root: rootA,
          cid: sharedShardCID,
          pieceCID: sharedPieceCID,
          sourceURL: 'https://source.example/source-failure-a',
          sizeBytes: 128n,
        },
        {
          root: rootB,
          cid: sharedShardCID,
          pieceCID: sharedPieceCID,
          sourceURL: 'https://source.example/source-failure-b',
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
    copy0Context.pull.mockImplementationOnce(
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
    )

    const plan = createPlan({ spaceDID, copy0Context, copy1Context })
    plan.totals.uploads = 2
    plan.totals.shards = 2
    plan.totals.bytes = 256n
    plan.totals.bytesToMigrate = 256n
    plan.costs.perSpace[0].bytesToMigrate = 256n
    plan.costs.summary.totalBytes = 256n

    transitionToApproved(state, plan.costs.perSpace)

    /** @type {API.MigrationEvent[]} */
    const events = []
    for await (const event of executeMigration({
      plan,
      store,
      synapse: /** @type {API.Synapse} */ ({}),
      batchSize: 1,
      pullConcurrency: 1,
    })) {
      events.push(event)
    }

    expect(copy0Context.pull).toHaveBeenCalledTimes(1)
    expect(copy1Context.pull).not.toHaveBeenCalled()
    expect(copy0Context.commit).not.toHaveBeenCalled()
    expect(copy1Context.commit).not.toHaveBeenCalled()
    expect([...state.spaces[spaceDID].copies[0].failedUploads].sort()).toEqual(
      [rootA, rootB].sort()
    )
    expect(state.spaces[spaceDID].copies[1].failedUploads.size).toBe(0)

    const failedEvent = events.find(
      (event) =>
        event.type === 'migration:batch:failed' &&
        event.copyIndex === 0 &&
        event.stage === 'source-pull'
    )
    expect(failedEvent).toBeDefined()
    if (!failedEvent || failedEvent.type !== 'migration:batch:failed') {
      throw new Error('expected source-pull migration:batch:failed event')
    }
    expect([...failedEvent.roots].sort()).toEqual([rootA, rootB].sort())
    expect(state.spaces[spaceDID].phase).toBe('failed')
    expect(state.phase).toBe('incomplete')
  })

  it('stores and secondary-pulls one shard but commits both roots when store entries share the same shard CID', async () => {
    const spaceDID = /** @type {API.SpaceDID} */ (
      'did:key:z6MkDuplicateRootStoreSpace1'
    )
    const sharedShardCID = 'bafy-shard-store-shared'
    const rootA = 'bafy-root-store-a'
    const rootB = 'bafy-root-store-b'
    const store = await openStore()
    const state = store.getState()
    withInventory(state, {
      did: spaceDID,
      name: 'Duplicate Root Store Space',
      uploads: [rootA, rootB],
      shards: [],
      shardsToStore: [
        {
          root: rootA,
          cid: sharedShardCID,
          sourceURL: 'https://source.example/store-shared-a',
          sizeBytes: 128n,
        },
        {
          root: rootB,
          cid: sharedShardCID,
          sourceURL: 'https://source.example/store-shared-b',
          sizeBytes: 128n,
        },
      ],
      skippedUploads: [],
      totalBytes: 256n,
      totalSizeToMigrate: 256n,
    })

    const copy0Context = createStorageContext({ spaceDID, name: 'copy0' })
    const copy1Context = createStorageContext({ spaceDID, name: 'copy1' })
    const plan = createPlan({ spaceDID, copy0Context, copy1Context })
    plan.totals.uploads = 2
    plan.totals.shards = 2
    plan.totals.bytes = 256n
    plan.totals.bytesToMigrate = 256n
    plan.costs.perSpace[0].bytesToMigrate = 256n
    plan.costs.summary.totalBytes = 256n

    const fetcher = /** @type {typeof fetch} */ (
      vi.fn(async () => new Response('ok'))
    )

    transitionToApproved(state, plan.costs.perSpace)

    for await (const _event of executeMigration({
      plan,
      store,
      synapse: /** @type {API.Synapse} */ ({}),
      fetcher,
    })) {
      // drain
    }

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(copy0Context.store).toHaveBeenCalledTimes(1)
    expect(copy1Context.pull).toHaveBeenCalledTimes(1)
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

    expect(copy0CommittedRoots.sort()).toEqual([rootA, rootB].sort())
    expect(copy1CommittedRoots.sort()).toEqual([rootA, rootB].sort())
    expect(state.spaces[spaceDID].copies[0].storedShards).toHaveProperty(
      sharedShardCID
    )
    expect([...state.spaces[spaceDID].copies[0].committed].sort()).toEqual(
      [
        commitKey(sharedShardCID, rootA),
        commitKey(sharedShardCID, rootB),
      ].sort()
    )
    expect([...state.spaces[spaceDID].copies[1].committed].sort()).toEqual(
      [
        commitKey(sharedShardCID, rootA),
        commitKey(sharedShardCID, rootB),
      ].sort()
    )
    expect(state.phase).toBe('complete')
  })

  it('keeps a duplicate-root store shard staged when one root commit fails in the current run', async () => {
    const spaceDID = /** @type {API.SpaceDID} */ (
      'did:key:z6MkDuplicateRootStoreFailureSpace1'
    )
    const sharedShardCID = 'bafy-shard-store-shared-failure'
    const rootA = createOversizedRoot('store-failure-a')
    const rootB = createOversizedRoot('store-failure-b')
    const store = await openStore()
    const state = store.getState()
    withInventory(state, {
      did: spaceDID,
      name: 'Duplicate Root Store Failure Space',
      uploads: [rootA, rootB],
      shards: [],
      shardsToStore: [
        {
          root: rootA,
          cid: sharedShardCID,
          sourceURL: 'https://source.example/store-failure-a',
          sizeBytes: 128n,
        },
        {
          root: rootB,
          cid: sharedShardCID,
          sourceURL: 'https://source.example/store-failure-b',
          sizeBytes: 128n,
        },
      ],
      skippedUploads: [],
      totalBytes: 256n,
      totalSizeToMigrate: 256n,
    })

    const copy0Context = createStorageContext({ spaceDID, name: 'copy0' })
    const copy1Context = createStorageContext({ spaceDID, name: 'copy1' })
    let copy0DataSetId = 100n
    copy0Context.commit.mockImplementation(
      /**
       * @param {{ pieces: API.CommitPiece[] }} args
       */
      async ({ pieces }) => {
        const root = pieces[0]?.pieceMetadata.ipfsRootCID
        if (root === rootB) {
          throw new Error('duplicate-root commit failed')
        }
        return { dataSetId: copy0DataSetId++, pieces }
      }
    )

    const plan = createPlan({ spaceDID, copy0Context, copy1Context })
    plan.totals.uploads = 2
    plan.totals.shards = 2
    plan.totals.bytes = 256n
    plan.totals.bytesToMigrate = 256n
    plan.costs.perSpace[0].bytesToMigrate = 256n
    plan.costs.summary.totalBytes = 256n

    const fetcher = /** @type {typeof fetch} */ (
      vi.fn(async () => new Response('ok'))
    )

    transitionToApproved(state, plan.costs.perSpace)

    for await (const _event of executeMigration({
      plan,
      store,
      synapse: /** @type {API.Synapse} */ ({}),
      fetcher,
      maxCommitRetries: 0,
    })) {
      // drain
    }

    expect(copy0Context.store).toHaveBeenCalledTimes(1)
    expect(copy1Context.pull).toHaveBeenCalledTimes(1)
    expect(copy0Context.commit).toHaveBeenCalledTimes(2)
    expect(copy0Context.commit.mock.calls[0][0].pieces).toHaveLength(1)
    expect(copy0Context.commit.mock.calls[1][0].pieces).toHaveLength(1)
    expect(state.spaces[spaceDID].copies[0].storedShards).toHaveProperty(
      sharedShardCID
    )
    expect([...state.spaces[spaceDID].copies[0].committed]).toEqual([
      commitKey(sharedShardCID, rootA),
    ])
    expect(state.spaces[spaceDID].copies[0].failedUploads.has(rootB)).toBe(true)
    expect(state.spaces[spaceDID].phase).toBe('incomplete')
    expect(state.phase).toBe('incomplete')
  })

  it('retries only the missing duplicate-root store commit without re-storing or re-pulling', async () => {
    const spaceDID = /** @type {API.SpaceDID} */ (
      'did:key:z6MkDuplicateRootStoreRetrySpace1'
    )
    const sharedShardCID = 'bafy-shard-store-shared-retry'
    const rootA = createOversizedRoot('store-retry-a')
    const rootB = createOversizedRoot('store-retry-b')
    const store = await openStore()
    const state = store.getState()
    withInventory(state, {
      did: spaceDID,
      name: 'Duplicate Root Store Retry Space',
      uploads: [rootA, rootB],
      shards: [],
      shardsToStore: [
        {
          root: rootA,
          cid: sharedShardCID,
          sourceURL: 'https://source.example/store-retry-a',
          sizeBytes: 128n,
        },
        {
          root: rootB,
          cid: sharedShardCID,
          sourceURL: 'https://source.example/store-retry-b',
          sizeBytes: 128n,
        },
      ],
      skippedUploads: [],
      totalBytes: 256n,
      totalSizeToMigrate: 256n,
    })

    const copy0Context = createStorageContext({ spaceDID, name: 'copy0' })
    const copy1Context = createStorageContext({ spaceDID, name: 'copy1' })
    let failRootB = true
    let copy0DataSetId = 100n
    copy0Context.commit.mockImplementation(
      /**
       * @param {{ pieces: API.CommitPiece[] }} args
       */
      async ({ pieces }) => {
        const root = pieces[0]?.pieceMetadata.ipfsRootCID
        if (root === rootB && failRootB) {
          throw new Error('duplicate-root commit failed')
        }
        return { dataSetId: copy0DataSetId++, pieces }
      }
    )

    const plan = createPlan({ spaceDID, copy0Context, copy1Context })
    plan.totals.uploads = 2
    plan.totals.shards = 2
    plan.totals.bytes = 256n
    plan.totals.bytesToMigrate = 256n
    plan.costs.perSpace[0].bytesToMigrate = 256n
    plan.costs.summary.totalBytes = 256n

    const fetcher = /** @type {typeof fetch} */ (
      vi.fn(async () => new Response('ok'))
    )

    transitionToApproved(state, plan.costs.perSpace)

    for await (const _event of executeMigration({
      plan,
      store,
      synapse: /** @type {API.Synapse} */ ({}),
      fetcher,
      maxCommitRetries: 0,
    })) {
      // drain
    }

    expect(copy0Context.store).toHaveBeenCalledTimes(1)
    expect(copy1Context.pull).toHaveBeenCalledTimes(1)
    expect(state.spaces[spaceDID].copies[0].failedUploads.has(rootB)).toBe(true)
    expect([...state.spaces[spaceDID].copies[0].committed]).toEqual([
      commitKey(sharedShardCID, rootA),
    ])

    failRootB = false
    clearFailedUploadsForRetry(state, spaceDID)
    copy0Context.store.mockClear()
    copy0Context.pull.mockClear()
    copy0Context.commit.mockClear()
    copy1Context.pull.mockClear()
    copy1Context.commit.mockClear()

    for await (const _event of executeMigration({
      plan,
      store,
      synapse: /** @type {API.Synapse} */ ({}),
      fetcher,
      maxCommitRetries: 0,
    })) {
      // drain
    }

    expect(copy0Context.store).not.toHaveBeenCalled()
    expect(copy0Context.pull).not.toHaveBeenCalled()
    expect(copy0Context.commit).toHaveBeenCalledTimes(1)
    expect(
      copy0Context.commit.mock.calls[0][0].pieces.map(
        /**
         * @param {API.CommitPiece} piece
         */
        (piece) => piece.pieceMetadata.ipfsRootCID
      )
    ).toEqual([rootB])
    expect(copy1Context.pull).not.toHaveBeenCalled()
    expect(copy1Context.commit).not.toHaveBeenCalled()
    expect(state.spaces[spaceDID].copies[0].storedShards).toHaveProperty(
      sharedShardCID
    )
    expect([...state.spaces[spaceDID].copies[0].committed].sort()).toEqual(
      [
        commitKey(sharedShardCID, rootA),
        commitKey(sharedShardCID, rootB),
      ].sort()
    )
    expect(state.spaces[spaceDID].copies[0].failedUploads.size).toBe(0)
    expect(state.spaces[spaceDID].phase).toBe('complete')
    expect(state.phase).toBe('complete')
  })

  it('commits the missing duplicate-root store entry without re-storing or re-pulling when one root is already committed on both copies', async () => {
    const spaceDID = /** @type {API.SpaceDID} */ (
      'did:key:z6MkDuplicateRootStoreResumeSpace1'
    )
    const sharedShardCID = 'bafy-shard-store-shared-resume'
    const rootA = 'bafy-root-store-resume-a'
    const rootB = 'bafy-root-store-resume-b'
    const storedPieceCID = createPieceCID().toString()
    const store = await openStore()
    const state = store.getState()
    withInventory(state, {
      did: spaceDID,
      name: 'Duplicate Root Store Resume Space',
      uploads: [rootA, rootB],
      shards: [],
      shardsToStore: [
        {
          root: rootA,
          cid: sharedShardCID,
          sourceURL: 'https://source.example/store-resume-a',
          sizeBytes: 128n,
        },
        {
          root: rootB,
          cid: sharedShardCID,
          sourceURL: 'https://source.example/store-resume-b',
          sizeBytes: 128n,
        },
      ],
      skippedUploads: [],
      totalBytes: 256n,
      totalSizeToMigrate: 256n,
    })

    const copy0Context = createStorageContext({
      spaceDID,
      name: 'copy0',
      dataSetId: 100n,
    })
    const copy1Context = createStorageContext({
      spaceDID,
      name: 'copy1',
      dataSetId: 200n,
    })
    const plan = createPlan({ spaceDID, copy0Context, copy1Context })
    plan.totals.uploads = 2
    plan.totals.shards = 2
    plan.totals.bytes = 256n
    plan.totals.bytesToMigrate = 256n
    plan.costs.perSpace[0].bytesToMigrate = 256n
    plan.costs.perSpace[0].copies[0].dataSetId = 100n
    plan.costs.perSpace[0].copies[1].dataSetId = 200n
    plan.costs.summary.totalBytes = 256n

    transitionToApproved(state, plan.costs.perSpace)
    state.spaces[spaceDID].copies[0].storedShards[sharedShardCID] =
      storedPieceCID
    state.spaces[spaceDID].copies[0].committed.add(
      commitKey(sharedShardCID, rootA)
    )
    state.spaces[spaceDID].copies[0].dataSetId = 100n
    state.spaces[spaceDID].copies[1].committed.add(
      commitKey(sharedShardCID, rootA)
    )
    state.spaces[spaceDID].copies[1].dataSetId = 200n

    const fetcher = /** @type {typeof fetch} */ (
      vi.fn(async () => new Response('ok'))
    )

    for await (const _event of executeMigration({
      plan,
      store,
      synapse: /** @type {API.Synapse} */ ({}),
      fetcher,
      maxCommitRetries: 0,
    })) {
      // drain
    }

    expect(copy0Context.store).not.toHaveBeenCalled()
    expect(copy1Context.pull).not.toHaveBeenCalled()
    expect(copy0Context.commit).toHaveBeenCalledTimes(1)
    expect(copy1Context.commit).toHaveBeenCalledTimes(1)
    expect(copy0Context.commit.mock.calls[0][0].pieces).toHaveLength(1)
    expect(copy1Context.commit.mock.calls[0][0].pieces).toHaveLength(1)
    expect(
      copy0Context.commit.mock.calls[0][0].pieces[0]?.pieceMetadata.ipfsRootCID
    ).toBe(rootB)
    expect(
      copy1Context.commit.mock.calls[0][0].pieces[0]?.pieceMetadata.ipfsRootCID
    ).toBe(rootB)
    expect([...state.spaces[spaceDID].copies[0].committed].sort()).toEqual(
      [
        commitKey(sharedShardCID, rootA),
        commitKey(sharedShardCID, rootB),
      ].sort()
    )
    expect([...state.spaces[spaceDID].copies[1].committed].sort()).toEqual(
      [
        commitKey(sharedShardCID, rootA),
        commitKey(sharedShardCID, rootB),
      ].sort()
    )
    expect(state.spaces[spaceDID].phase).toBe('complete')
    expect(state.phase).toBe('complete')
  })

  it('stops before copy 1 when copy 0 source pull fully fails for a root', async () => {
    const spaceDID = /** @type {API.SpaceDID} */ (
      'did:key:z6MkMixedMigrationSpace2'
    )
    const sharedRoot = 'bafy-root-shared'
    const store = await openStore()
    const state = store.getState()
    withInventory(state, {
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
      store,
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
      state.spaces[spaceDID].copies[0].committed.has(
        commitKey('bafy-shard-success', sharedRoot)
      )
    ).toBe(false)
    expect(
      state.spaces[spaceDID].copies[1].committed.has(
        commitKey('bafy-shard-success', sharedRoot)
      )
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
    const store = await openStore()
    const state = store.getState()
    withInventory(state, {
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
        store,
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
    const store = await openStore()
    const state = store.getState()
    withInventory(state, {
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
        store,
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
    const store = await openStore()
    const state = store.getState()
    withInventory(state, {
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
        store,
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
    const store = await openStore()
    const state = store.getState()
    withInventory(state, {
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
      store,
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
    const store = await openStore()
    const state = store.getState()
    withInventory(state, {
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
      store,
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

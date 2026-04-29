import { describe, it, expect, vi } from 'vitest'
import { executeMigration } from '../src/migrator/migrator.js'
import { executeStoreMigration } from '../src/migrator/store-executor.js'
import { createMockInitialState, createPieceCID } from './helpers.js'
import { DEFAULT_STORE_OPERATION_RETRIES } from '../src/constants.js'
import {
  clearFailedUploadsForRetry,
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

  it('streams shard bytes into context.store()', async () => {
    const spaceDID = /** @type {API.SpaceDID} */ (
      'did:key:z6MkStoreByteStreamSpace'
    )
    const state = withInventory(createMockInitialState(), {
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
      state,
      synapse: /** @type {API.Synapse} */ ({}),
      fetcher,
    })) {
      // drain
    }

    expect(storedBytes).toBe(4n)
  })

  it('retries transient fetch failures before a later store attempt succeeds', async () => {
    const spaceDID = /** @type {API.SpaceDID} */ (
      'did:key:z6MkStoreFetchRetrySuccessSpace'
    )
    const state = withInventory(createMockInitialState(), {
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
      state,
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
    const state = withInventory(createMockInitialState(), {
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
      state,
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
      const state = withInventory(createMockInitialState(), {
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
        state,
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
    const state = withInventory(createMockInitialState(), {
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
      state,
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
    const state = withInventory(createMockInitialState(), {
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
      state,
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
    const state = withInventory(createMockInitialState(), {
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
      state,
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
    const state = withInventory(createMockInitialState(), {
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
      state,
      synapse: /** @type {API.Synapse} */ ({}),
      fetcher,
    })) {
      // drain
    }

    expect(copy0Context.store).not.toHaveBeenCalled()
    expect(copy0Context.commit).toHaveBeenCalledTimes(1)
    expect(copy1Context.pull).toHaveBeenCalledTimes(1)
    expect(copy1Context.commit).toHaveBeenCalledTimes(1)
    expect(state.spaces[spaceDID].copies[0].committed.has(shardCID)).toBe(true)
    expect(state.spaces[spaceDID].copies[1].committed.has(shardCID)).toBe(true)
    expect(state.phase).toBe('complete')
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

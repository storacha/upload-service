import {
  DEFAULT_STORE_OPERATION_RETRIES,
  PRIMARY_COPY_INDEX,
  SECONDARY_COPY_INDEX,
} from '../constants.js'
import { runConcurrentTasks } from './concurrent.js'
import { applyPullResults } from './pull-results.js'
import { presignAndPullBatch } from './pull.js'
import {
  copyOptionalErrorFlags,
  createRetryableOperationError,
  isRetryableHttpStatus,
  shouldRetryTransientOperationError,
} from './retry-policy.js'
import { batches, isAbortError } from '../utils.js'
import { recordFailedUpload, recordPull, recordStoredShard } from '../state.js'
import { extractRetryDiagnostics, runRetried } from './retried-operation.js'

/**
 * @import * as API from '../api.js'
 */

/**
 * Store all actionable store-routed shards on the primary copy and return the
 * same-run eligible commit entries keyed by shard CID.
 *
 * @param {object} args
 * @param {API.SpaceInventory} args.inventory
 * @param {API.SpaceCopyState} args.copyState
 * @param {API.PerCopyCost} args.copyCost
 * @param {API.MigrationState} args.state
 * @param {typeof fetch} args.fetcher
 * @param {number} args.batchSize
 * @param {number} args.storeConcurrency
 * @param {Set<string>} args.activeFailedRoots
 * @param {AbortSignal | undefined} args.signal
 * @returns {AsyncGenerator<API.MigrationEvent, Map<string, API.CommitEntry> | undefined, void>}
 */
export async function* storeShardsOnPrimaryCopy({
  inventory,
  copyState,
  copyCost,
  state,
  fetcher,
  batchSize,
  storeConcurrency,
  activeFailedRoots,
  signal,
}) {
  const { context, spaceDID } = copyCost
  if (copyState.copyIndex !== PRIMARY_COPY_INDEX) return

  const entriesByShardCid = new Map()
  /** @type {API.StoreShard[]} */
  const actionableShards = []
  for (const shard of inventory.shardsToStore) {
    const storedPieceCID = copyState.storedShards[shard.cid]
    if (storedPieceCID) {
      entriesByShardCid.set(shard.cid, {
        shardCid: shard.cid,
        pieceCID: storedPieceCID,
        root: shard.root,
      })
    }

    if (copyState.committed.has(shard.cid)) continue
    if (storedPieceCID) continue
    if (activeFailedRoots.has(shard.root)) continue
    actionableShards.push(shard)
  }

  const batchCount = Math.ceil(actionableShards.length / batchSize)
  yield {
    type: 'migration:phase:start',
    spaceDID,
    copyIndex: copyState.copyIndex,
    phase: 'store',
    itemCount: actionableShards.length,
    batchCount,
  }

  for (const batch of batches(actionableShards, batchSize)) {
    yield* processStoreBatch({
      batch,
      context,
      fetcher,
      state,
      spaceDID,
      copyState,
      entriesByShardCid,
      activeFailedRoots,
      storeConcurrency,
      signal,
    })
  }

  const completed = !signal?.aborted
  yield {
    type: 'migration:phase:complete',
    spaceDID,
    copyIndex: copyState.copyIndex,
    phase: 'store',
    completed,
  }
  if (!completed) return

  if (activeFailedRoots.size === 0) {
    return entriesByShardCid
  }

  const eligibleEntriesByShardCid = new Map()
  for (const entry of entriesByShardCid.values()) {
    if (activeFailedRoots.has(entry.root)) continue
    eligibleEntriesByShardCid.set(entry.shardCid, entry)
  }

  // Durable state keeps all stored shards for retry reuse; the returned map
  // omits roots that failed in this run so copy 1 does not pull/commit them.
  return eligibleEntriesByShardCid
}

/**
 * Pull stored piece CIDs from the primary copy into the secondary copy and
 * return commit entries keyed by shard CID.
 *
 * @param {object} args
 * @param {Map<string, API.CommitEntry>} args.entriesByShardCid
 * @param {API.SpaceCopyState} args.copyState
 * @param {API.StorageContext} args.sourceContext
 * @param {API.PerCopyCost} args.copyCost
 * @param {API.MigrationState} args.state
 * @param {number} args.batchSize
 * @param {number} args.pullConcurrency
 * @param {Set<string>} args.activeFailedRoots
 * @param {AbortSignal | undefined} args.signal
 * @returns {AsyncGenerator<API.MigrationEvent, Map<string, API.CommitEntry> | undefined, void>}
 */
export async function* pullStoredShardsOnSecondaryCopy({
  entriesByShardCid,
  copyState,
  sourceContext,
  copyCost,
  state,
  batchSize,
  pullConcurrency,
  activeFailedRoots,
  signal,
}) {
  if (copyState.copyIndex !== SECONDARY_COPY_INDEX) return

  const { context, copyIndex, spaceDID } = copyCost
  const isFreshCopy =
    copyState.committed.size === 0 &&
    copyState.pulled.size === 0 &&
    copyState.failedUploads.size === 0

  /** @type {API.CommitEntry[]} */
  let entriesToPull
  const pulledEntriesByShardCid = new Map()

  // Fast path: fresh copy has no committed, pulled, or failed entries, so all
  // entries are actionable and no filtering is needed.
  if (isFreshCopy) {
    entriesToPull = [...entriesByShardCid.values()]
  } else {
    entriesToPull = []
    for (const entry of entriesByShardCid.values()) {
      if (copyState.committed.has(entry.shardCid)) continue
      if (activeFailedRoots.has(entry.root)) continue
      if (copyState.pulled.has(entry.shardCid)) {
        pulledEntriesByShardCid.set(entry.shardCid, entry)
        continue
      }
      entriesToPull.push(entry)
    }
  }

  const batchCount = Math.ceil(entriesToPull.length / batchSize)
  yield {
    type: 'migration:phase:start',
    spaceDID,
    copyIndex,
    phase: 'secondary-pull',
    itemCount: entriesToPull.length,
    batchCount,
  }

  if (entriesToPull.length > 0 && !signal?.aborted) {
    const { results: pullResults, aborted } = await runConcurrentTasks({
      items: batches(entriesToPull, batchSize),
      concurrency: pullConcurrency,
      signal,
      run: (batch) =>
        presignAndPullFromStore({
          batch,
          context,
          sourceContext,
          phase: 'secondary-pull',
          signal,
        }),
    })

    yield* applyPullResults({
      pullResults,
      state,
      spaceDID,
      copyIndex,
      activeFailedRoots,
      onPulledCandidate: (entry) => {
        pulledEntriesByShardCid.set(entry.shardCid, entry)
        return recordPull(state, spaceDID, copyIndex, entry.shardCid)
      },
    })

    if (aborted) {
      yield {
        type: 'migration:phase:complete',
        spaceDID,
        copyIndex,
        phase: 'secondary-pull',
        completed: false,
      }
      return
    }
  }

  if (signal?.aborted) {
    yield {
      type: 'migration:phase:complete',
      spaceDID,
      copyIndex,
      phase: 'secondary-pull',
      completed: false,
    }
    return
  }

  yield {
    type: 'migration:phase:complete',
    spaceDID,
    copyIndex,
    phase: 'secondary-pull',
    completed: true,
  }

  return pulledEntriesByShardCid
}

/**
 * @param {object} args
 * @param {API.StoreShard[]} args.batch
 * @param {API.StorageContext} args.context
 * @param {typeof fetch} args.fetcher
 * @param {API.MigrationState} args.state
 * @param {API.SpaceDID} args.spaceDID
 * @param {API.SpaceCopyState} args.copyState
 * @param {Map<string, API.CommitEntry>} args.entriesByShardCid
 * @param {Set<string>} args.activeFailedRoots
 * @param {number} args.storeConcurrency
 * @param {AbortSignal | undefined} args.signal
 * @returns {AsyncGenerator<API.MigrationEvent>}
 */
async function* processStoreBatch({
  batch,
  context,
  fetcher,
  state,
  spaceDID,
  copyState,
  entriesByShardCid,
  activeFailedRoots,
  storeConcurrency,
  signal,
}) {
  if (signal?.aborted || batch.length === 0) return

  let stateChanged = false
  const failedUploads = new Set()
  /** @type {Error | undefined} */
  let firstError
  const { results: storeResults, aborted } = await runConcurrentTasks({
    items: batch,
    concurrency: storeConcurrency,
    signal,
    run: (shard) => storeShard({ shard, context, fetcher, signal }),
  })

  for (const result of storeResults) {
    if (result.ok) {
      entriesByShardCid.set(result.ok.shardCid, result.ok)
      stateChanged =
        recordStoredShard(
          state,
          spaceDID,
          result.ok.shardCid,
          result.ok.pieceCID
        ) || stateChanged
    } else {
      activeFailedRoots.add(result.error.root)
      failedUploads.add(result.error.root)
      firstError ??= result.error.error
      stateChanged =
        recordFailedUpload(
          state,
          spaceDID,
          copyState.copyIndex,
          result.error.root
        ) || stateChanged
    }
  }

  if (failedUploads.size > 0) {
    yield /** @type {API.MigrationEvent} */ ({
      type: 'migration:batch:failed',
      spaceDID,
      copyIndex: copyState.copyIndex,
      stage: 'store',
      error:
        firstError ??
        new Error(
          `${failedUploads.size} upload(s) had shards that failed to store`
        ),
      roots: [...failedUploads],
    })
  }

  if (stateChanged) {
    yield /** @type {API.MigrationEvent} */ ({
      type: 'state:checkpoint',
      state,
    })
  }

  if (aborted) return
}

/**
 * @param {object} args
 * @param {API.StoreShard} args.shard
 * @param {API.StorageContext} args.context
 * @param {typeof fetch} args.fetcher
 * @param {AbortSignal | undefined} args.signal
 */
async function storeShard({ shard, context, fetcher, signal }) {
  /** @type {'fetch' | 'store'} */
  let failureStep = 'fetch'
  /** @type {bigint | null} */
  let expectedBytes = null
  let observedBytes = 0n

  try {
    const result = await runRetried({
      retries: DEFAULT_STORE_OPERATION_RETRIES,
      signal,
      shouldRetry: shouldRetryTransientOperationError,
      attempt: async () => {
        failureStep = 'fetch'
        expectedBytes = null
        observedBytes = 0n

        const response = await fetcher(shard.sourceURL, { signal })
        if (!response.ok) {
          throw createRetryableOperationError(
            `Download failed with status ${response.status}`,
            isRetryableHttpStatus(response.status),
            response.status
          )
        }
        if (!response.body) {
          throw createRetryableOperationError(
            'Download response body is missing',
            false
          )
        }

        const body = createCountedShardBody(response)
        expectedBytes = body.expectedBytes
        failureStep = 'store'

        try {
          const stored = await context.store(body.stream, { signal })
          observedBytes = body.getObservedBytes()
          return stored
        } catch (error) {
          observedBytes = body.getObservedBytes()
          try {
            await body.cancel(error)
          } catch {
            // Best-effort cleanup; preserve the original store error.
          }
          throw error
        }
      },
    })

    return {
      ok: {
        shardCid: shard.cid,
        pieceCID: String(result.pieceCid),
        root: shard.root,
      },
    }
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) {
      throw error
    }

    const { baseError, attempts, retriesConfigured, elapsedMs } =
      extractRetryDiagnostics(error, DEFAULT_STORE_OPERATION_RETRIES)

    return {
      error: {
        shardCid: shard.cid,
        root: shard.root,
        error: withStoreErrorContext(baseError, {
          shard,
          expectedBytes,
          observedBytes,
          failureStep,
          attempts,
          retriesConfigured,
          elapsedMs,
        }),
      },
    }
  }
}

/**
 * @param {Response} response
 */
function createCountedShardBody(response) {
  const body = /** @type {ReadableStream<Uint8Array>} */ (response.body)
  const reader = body.getReader()
  const expectedBytes = parseContentLength(response)
  let observedBytes = 0

  return {
    stream: new ReadableStream(
      {
        async pull(controller) {
          const { done, value } = await reader.read()
          if (done) {
            controller.close()
            return
          }

          observedBytes += value.byteLength
          controller.enqueue(value)
        },
        async cancel(/** @type {unknown} */ reason) {
          await reader.cancel(reason)
        },
      },
      { highWaterMark: 0 }
    ),
    expectedBytes,
    getObservedBytes() {
      return BigInt(observedBytes)
    },
    async cancel(/** @type {unknown} */ reason) {
      await reader.cancel(reason)
    },
  }
}

/**
 * @param {Response} response
 * @returns {bigint | null}
 */
function parseContentLength(response) {
  const value = response.headers.get('content-length')
  if (!value) return null

  try {
    return BigInt(value)
  } catch {
    return null
  }
}

/**
 * @param {unknown} error
 * @param {object} context
 * @param {API.StoreShard} context.shard
 * @param {bigint | null} context.expectedBytes
 * @param {bigint} context.observedBytes
 * @param {'fetch' | 'store'} context.failureStep
 * @param {number} context.attempts
 * @param {number} context.retriesConfigured
 * @param {number} context.elapsedMs
 * @returns {API.StoreDiagnosticError}
 */
function withStoreErrorContext(
  error,
  {
    shard,
    expectedBytes,
    observedBytes,
    failureStep,
    attempts,
    retriesConfigured,
    elapsedMs,
  }
) {
  if (hasStoreErrorContext(error)) {
    return /** @type {API.StoreDiagnosticError} */ (error)
  }

  const baseError = error instanceof Error ? error : new Error(String(error))
  /** @type {API.StoreDiagnosticError} */
  const contextualError = /** @type {API.StoreDiagnosticError} */ (
    /** @type {unknown} */ (
      new Error(
        `${baseError.message} (shardCid=${shard.cid}, root=${
          shard.root
        }, sourceURL=${shard.sourceURL}, expectedBytes=${formatExpectedBytes(
          expectedBytes
        )}, observedBytes=${observedBytes}, failureStep=${failureStep}, attempts=${attempts}, retriesConfigured=${retriesConfigured}, elapsedMs=${elapsedMs})`
      )
    )
  )
  contextualError.name = baseError.name
  contextualError.cause = baseError
  contextualError.shardCid = shard.cid
  contextualError.root = shard.root
  contextualError.sourceURL = shard.sourceURL
  contextualError.expectedBytes = expectedBytes
  contextualError.observedBytes = observedBytes
  contextualError.failureStep = failureStep
  contextualError.attempts = attempts
  contextualError.retriesConfigured = retriesConfigured
  contextualError.elapsedMs = elapsedMs
  copyOptionalErrorFlags(contextualError, baseError)

  return contextualError
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
function hasStoreErrorContext(error) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'shardCid' in error &&
      typeof error.shardCid === 'string' &&
      'sourceURL' in error &&
      typeof error.sourceURL === 'string' &&
      'observedBytes' in error &&
      typeof error.observedBytes === 'bigint'
  )
}

/**
 * @param {bigint | null} expectedBytes
 */
function formatExpectedBytes(expectedBytes) {
  return expectedBytes == null ? 'unknown' : String(expectedBytes)
}

/**
 * @param {object} args
 * @param {API.CommitEntry[]} args.batch
 * @param {API.StorageContext} args.context
 * @param {API.StorageContext} args.sourceContext
 * @param {'source-pull' | 'secondary-pull'} args.phase
 * @param {AbortSignal | undefined} args.signal
 * @returns {Promise<API.PullResult<API.CommitEntry>>}
 */
async function presignAndPullFromStore({
  batch,
  context,
  sourceContext,
  phase,
  signal,
}) {
  return await presignAndPullBatch({
    batch,
    context,
    getPieceCID: (entry) => entry.pieceCID,
    getRoot: (entry) => entry.root,
    getSourceURL: (_entry, pieceCid) => sourceContext.getPieceUrl(pieceCid),
    phase,
    signal,
  })
}

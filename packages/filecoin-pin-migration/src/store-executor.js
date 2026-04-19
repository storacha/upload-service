import pMap from 'p-map'
import pRetry from 'p-retry'
import {
  DEFAULT_STOP_ON_ERROR,
  DEFAULT_MAX_COMMIT_RETRIES,
  DEFAULT_COMMIT_RETRY_TIMEOUT,
  DEFAULT_PULL_BATCH_SIZE,
  DEFAULT_PULL_CONCURRENCY,
  DEFAULT_STORE_FETCH_RETRIES,
  DEFAULT_STORE_OPERATION_RETRIES,
  DEFAULT_STORE_CONCURRENCY,
  PRIMARY_COPY_INDEX,
} from './constants.js'
import {
  commitPieceBatches,
  iterateCommitPieces,
} from './commit.js'
import { ensureFunding } from './funding.js'
import { presignAndPullBatch } from './pull.js'
import { deriveMigrationSummary } from './summary.js'
import { batches } from './utils.js'
import {
  recordPull,
  recordFailedUpload,
  recordStoredShard,
  finalizeSpace,
  finalizeMigration,
} from './state.js'

/** @import * as API from './api.js' */

/**
 * Execute the standalone store() migration flow for selected uploads.
 *
 * Flow per selected space:
 *   1. Download and store every selected shard on copy 0.
 *   2. Commit stored shards on copy 0 in sequential internal batches.
 *   3. Pull those stored piece CIDs to copy 1 in batches.
 *   4. Commit pulled shards on copy 1 in sequential internal batches.
 *
 * @param {API.ExecuteStoreMigrationInput} input
 * @returns {AsyncGenerator<API.MigrationEvent>}
 */
export async function* executeStoreMigration({
  plan,
  state,
  synapse,
  batchSize: batchSizeOpt,
  fetcher: fetcherOpt,
  storeConcurrency: storeConcurrencyOpt,
  pullConcurrency: pullConcurrencyOpt,
  stopOnError: stopOnErrorOpt,
  signal,
  maxCommitRetries: maxCommitRetriesOpt,
  commitRetryTimeout: commitRetryTimeoutOpt,
}) {
  const startedAt = Date.now()
  const fetcher = fetcherOpt ?? globalThis.fetch
  if (typeof fetcher !== 'function') {
    throw new TypeError('executeStoreMigration: a fetch implementation is required')
  }

  const batchSize = batchSizeOpt ?? DEFAULT_PULL_BATCH_SIZE
  const storeConcurrency = storeConcurrencyOpt ?? DEFAULT_STORE_CONCURRENCY
  const pullConcurrency = pullConcurrencyOpt ?? DEFAULT_PULL_CONCURRENCY
  const stopOnError = stopOnErrorOpt ?? DEFAULT_STOP_ON_ERROR
  const maxCommitRetries = maxCommitRetriesOpt ?? DEFAULT_MAX_COMMIT_RETRIES
  const commitRetryTimeout = commitRetryTimeoutOpt ?? DEFAULT_COMMIT_RETRY_TIMEOUT

  yield* ensureFunding(plan.costs, plan.fundingAmount, synapse, state)

  state.phase = 'migrating'
  /** @type {Record<API.SpaceDID, API.SpaceInventory>} */
  const executionInventories = {}

  for (const perSpaceCost of plan.costs.perSpace) {
    if (signal?.aborted) return

    const sourceInventory = state.spacesInventories[perSpaceCost.spaceDID]
    if (!sourceInventory) continue

    const inventory = prepareInventoryForExecution(sourceInventory)
    if (!inventory || inventory.shardsToStore.length === 0) continue
    executionInventories[perSpaceCost.spaceDID] = inventory

    yield* migrateStoreSpace({
      inventory,
      perSpaceCost,
      state,
      fetcher,
      batchSize,
      stopOnError,
      storeConcurrency,
      pullConcurrency,
      maxCommitRetries,
      commitRetryTimeout,
      signal,
    })
  }

  if (signal?.aborted) return

  finalizeMigration(state)
  
  const summary = deriveMigrationSummary({
    state,
    inventories: executionInventories,
    totalBytes: plan.totals.bytesToMigrate,
    startedAt,
    getActionableShards: (inventory) => inventory.shardsToStore,
  })

  yield {
    type: 'migration:complete',
    summary,
  }
}

// ── Per-space migration ─────────────────────────────────────────────────────

/**
 * @param {object} args
 * @param {API.SpaceInventory} args.inventory
 * @param {API.PerSpaceCost} args.perSpaceCost
 * @param {API.MigrationState} args.state
 * @param {typeof fetch} args.fetcher
 * @param {number} args.batchSize
 * @param {boolean} args.stopOnError
 * @param {number} args.storeConcurrency
 * @param {number} args.pullConcurrency
 * @param {number} args.maxCommitRetries
 * @param {number} args.commitRetryTimeout
 * @param {AbortSignal | undefined} args.signal
 * @returns {AsyncGenerator<API.MigrationEvent>}
 */
async function* migrateStoreSpace({
  inventory,
  perSpaceCost,
  state,
  fetcher,
  batchSize,
  stopOnError,
  storeConcurrency,
  pullConcurrency,
  maxCommitRetries,
  commitRetryTimeout,
  signal,
}) {
  const space = state.spaces[perSpaceCost.spaceDID]
  if (!space) return

  const [copy0State, copy1State] = space.copies[0]?.copyIndex === PRIMARY_COPY_INDEX
    ? [space.copies[0], space.copies[1]]
    : [space.copies[1], space.copies[0]]

  const [copy0Cost, copy1Cost] = perSpaceCost.copies[0]?.copyIndex === PRIMARY_COPY_INDEX
    ? [perSpaceCost.copies[0], perSpaceCost.copies[1]]
    : [perSpaceCost.copies[1], perSpaceCost.copies[0]]

  if (signal?.aborted || !copy0State || !copy1State || !copy0Cost || !copy1Cost) return

  const entriesByShardCid = yield* migratePrimaryStoreCopy({
    inventory,
    copyState: copy0State,
    copyCost: copy0Cost,
    state,
    fetcher,
    batchSize,
    stopOnError,
    storeConcurrency,
    maxCommitRetries,
    commitRetryTimeout,
    signal,
  })

  if (!entriesByShardCid || signal?.aborted) return

  yield* migrateSecondaryStoreCopy({
    entriesByShardCid,
    copy1State,
    copy0Context: copy0Cost.context,
    copy1Cost,
    state,
    batchSize,
    stopOnError,
    pullConcurrency,
    maxCommitRetries,
    commitRetryTimeout,
    signal,
  })

  if (signal?.aborted) return

  finalizeSpace(state, perSpaceCost.spaceDID)
  yield /** @type {API.MigrationEvent} */ ({ type: 'state:checkpoint', state })
}

/**
 * @param {object} args
 * @param {API.SpaceInventory} args.inventory
 * @param {API.SpaceCopyState} args.copyState
 * @param {API.PerCopyCost} args.copyCost
 * @param {API.MigrationState} args.state
 * @param {typeof fetch} args.fetcher
 * @param {number} args.batchSize
 * @param {boolean} args.stopOnError
 * @param {number} args.storeConcurrency
 * @param {number} args.maxCommitRetries
 * @param {number} args.commitRetryTimeout
 * @param {AbortSignal | undefined} args.signal
 * @returns {AsyncGenerator<API.MigrationEvent, Map<string, { shardCid: string, pieceCID: string, root: string }> | undefined, void>}
 */
async function* migratePrimaryStoreCopy({
  inventory,
  copyState,
  copyCost,
  state,
  fetcher,
  batchSize,
  stopOnError,
  storeConcurrency,
  maxCommitRetries,
  commitRetryTimeout,
  signal,
}) {
  const { context, copyIndex, spaceDID } = copyCost
  if (copyState.copyIndex !== PRIMARY_COPY_INDEX) return
 
  const failedRoots = new Set(copyState.failedUploads)
  const entriesByShardCid = new Map()
  /** @type {API.StoreShard[]} */
  let pendingStoreBatch = []

  // Scan once: seed existing stored entries and process new store work in bounded batches.
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
    if (stopOnError && failedRoots.has(shard.root)) continue
    pendingStoreBatch.push(shard)

    // flush full batch during scan, then later flush tail after scan
    if (pendingStoreBatch.length >= batchSize) {
      yield* processStoreBatch({
        batch: pendingStoreBatch,
        context,
        fetcher,
        state,
        spaceDID,
        copyState,
        entriesByShardCid,
        failedRoots,
        storeConcurrency,
        signal,
      })
      pendingStoreBatch = []
    }
  }

  if (pendingStoreBatch.length > 0 && !signal?.aborted) {
    yield* processStoreBatch({
      batch: pendingStoreBatch,
      context,
      fetcher,
      state,
      spaceDID,
      copyState,
      entriesByShardCid,
      failedRoots,
      storeConcurrency,
      signal,
    })
  }

  if (signal?.aborted) return

  const commitPieceIterable = iterateCommitPieces(
    entriesByShardCid.values(),
    (entry) =>
      !copyState.committed.has(entry.shardCid) &&
      !(stopOnError && failedRoots.has(entry.root))
  )

  yield* commitPieceBatches({
    commitPieceIterable,
    context,
    state,
    spaceDID,
    copyIndex,
    maxCommitRetries,
    commitRetryTimeout,
    activeFailedRoots: failedRoots,
  })

  return entriesByShardCid
}

/**
 * @param {object} args
 * @param {Map<string, { shardCid: string, pieceCID: string, root: string }>} args.entriesByShardCid
 * @param {API.SpaceCopyState} args.copy1State
 * @param {API.StorageContext} args.copy0Context
 * @param {API.PerCopyCost} args.copy1Cost
 * @param {API.MigrationState} args.state
 * @param {number} args.batchSize
 * @param {boolean} args.stopOnError
 * @param {number} args.pullConcurrency
 * @param {number} args.maxCommitRetries
 * @param {number} args.commitRetryTimeout
 * @param {AbortSignal | undefined} args.signal
 * @returns {AsyncGenerator<API.MigrationEvent>}
 */
async function* migrateSecondaryStoreCopy({
  entriesByShardCid,
  copy1State,
  copy0Context,
  copy1Cost,
  state,
  batchSize,
  stopOnError,
  pullConcurrency,
  maxCommitRetries,
  commitRetryTimeout,
  signal,
}) {
  const spaceDID = copy1Cost.spaceDID
  const failedRoots = new Set(copy1State.failedUploads)
  const isFreshCopy =
    copy1State.committed.size === 0 &&
    copy1State.pulled.size === 0 &&
    copy1State.failedUploads.size === 0
  /** @type {Array<{ shardCid: string, pieceCID: string, root: string }>} */
  let entriesToPull
  const pulledEntriesByShardCid = new Map()

  if (isFreshCopy) {
    entriesToPull = [...entriesByShardCid.values()]
  } else {
    entriesToPull = []
    for (const entry of entriesByShardCid.values()) {
      if (copy1State.committed.has(entry.shardCid)) continue
      if (stopOnError && failedRoots.has(entry.root)) continue
      if (copy1State.pulled.has(entry.shardCid)) {
        pulledEntriesByShardCid.set(entry.shardCid, entry)
        continue
      }
      entriesToPull.push(entry)
    }
  }

  let pulledChanged = false
  let stateChanged = false
  if (entriesToPull.length > 0 && !signal?.aborted) {
    const pullResults = await pMap(
      batches(entriesToPull, batchSize),
      (batch) =>
        presignAndPullFromStore({
          batch,
          context: copy1Cost.context,
          sourceContext: copy0Context,
          signal,
        }),
      { concurrency: pullConcurrency, signal }
    )

    for (const result of pullResults) {
      if (result.failedUploads.size > 0) {
        for (const root of result.failedUploads) {
          if (stopOnError) failedRoots.add(root)
          if (!copy1State.failedUploads.has(root)) {
            recordFailedUpload(state, spaceDID, 1, root)
            stateChanged = true
          }
        }
        yield /** @type {API.MigrationEvent} */ ({
          type: 'migration:batch:failed',
          spaceDID,
          copyIndex: 1,
          stage: /** @type {API.MigratorPhase} */ (result.stage),
          error: /** @type {Error} */ (result.error),
          roots: [...result.failedUploads],
        })
      }

      for (const entry of result.pulledCandidates) {
        if (stopOnError && failedRoots.has(entry.root)) continue
        pulledEntriesByShardCid.set(entry.shardCid, entry)
        pulledChanged = recordPull(state, spaceDID, 1, entry.shardCid) || pulledChanged
        stateChanged = pulledChanged || stateChanged
      }
    }

    if (stateChanged) {
      yield /** @type {API.MigrationEvent} */ ({ type: 'state:checkpoint', state })
    }
  }

  if (signal?.aborted) return

  const commitPieceIterable = iterateCommitPieces(
    pulledEntriesByShardCid.values(),
    (entry) => !(stopOnError && failedRoots.has(entry.root))
  )

  yield *
    commitPieceBatches({
      commitPieceIterable,
      context: copy1Cost.context,
      state,
      spaceDID,
      copyIndex: 1,
      maxCommitRetries,
      commitRetryTimeout,
      activeFailedRoots: failedRoots,
    })
}

// ── Store/pull helpers ──────────────────────────────────────────────────────

/**
 * @param {object} args
 * @param {API.StoreShard} args.shard
 * @param {API.StorageContext} args.context
 * @param {typeof fetch} args.fetcher
 * @param {AbortSignal | undefined} args.signal
 */
async function storeShard({ shard, context, fetcher, signal }) {
  try {
    const result = await pRetry(
      async () => {
        const body = await fetchShardBody({ shard, fetcher, signal })
        return await context.store(body, { signal })
      },
      {
        retries: DEFAULT_STORE_OPERATION_RETRIES,
        signal,
        shouldRetry: shouldRetryStoreOperationError,
      }
    )

    return {
      ok: {
        shardCid: shard.cid,
        pieceCID: String(result.pieceCid),
        root: shard.root,
      },
    }
  } catch (error) {
    return {
      error: {
        shardCid: shard.cid,
        root: shard.root,
        error: error instanceof Error ? error : new Error(String(error)),
      },
    }
  }
}

/**
 * @param {object} args
 * @param {API.StoreShard} args.shard
 * @param {typeof fetch} args.fetcher
 * @param {AbortSignal | undefined} args.signal
 */
async function fetchShardBody({ shard, fetcher, signal }) {
  return await pRetry(
    async () => {
      const response = await fetcher(shard.sourceURL, { signal })
      if (!response.ok) {
        throw createRetryableError(
          `Download failed with status ${response.status}`,
          isRetryableHttpStatus(response.status),
          response.status
        )
      }
      if (!response.body) {
        throw createRetryableError('Download response body is missing', false)
      }
      return response.body
    },
    {
      retries: DEFAULT_STORE_FETCH_RETRIES,
      signal,
      shouldRetry: shouldRetryFetchError,
    }
  )
}

/**
 * @param {unknown} error
 */
function shouldRetryFetchError(error) {
  if (signalAborted(error)) return false

  const retryable = getRetryableFlag(error)
  if (retryable != null) return retryable

  const status = getErrorStatus(error)
  if (status != null) return isRetryableHttpStatus(status)

  return true
}

/**
 * @param {unknown} error
 */
function shouldRetryStoreOperationError(error) {
  if (!shouldRetryFetchError(error)) return false

  const status = getErrorStatus(error)
  if (status != null) return isRetryableHttpStatus(status)

  const message = getErrorMessage(error).toLowerCase()
  return (
    /timeout|timed out|econnreset|econnrefused|socket hang up|connection reset|temporary|temporarily|network|unavailable|429|500|502|503|504|too many requests|fetch failed|stream/i.test(
      message
    ) || getRetryableFlag(error) === true
  )
}

/**
 * @param {string} message
 * @param {boolean} retryable
 * @param {number} [status]
 */
function createRetryableError(message, retryable, status) {
  const error = new Error(message)
  // @ts-expect-error local error metadata for retry classification
  error.retryable = retryable
  if (status != null) {
    // @ts-expect-error local error metadata for retry classification
    error.status = status
  }
  return error
}

/**
 * @param {unknown} error
 */
function getRetryableFlag(error) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'retryable' in error &&
    typeof error.retryable === 'boolean'
  ) {
    return error.retryable
  }
}

/**
 * @param {unknown} error
 */
function getErrorStatus(error) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number'
  ) {
    return error.status
  }
}

/**
 * @param {unknown} error
 */
function signalAborted(error) {
  const name = getErrorName(error)
  const message = getErrorMessage(error)
  return (
    name === 'AbortError' || message === 'This operation was aborted'
  )
}

/**
 * @param {number} status
 */
function isRetryableHttpStatus(status) {
  return status === 408 || status === 429 || status >= 500
}

/**
 * @param {unknown} error
 */
function getErrorName(error) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    typeof error.name === 'string'
  ) {
    return error.name
  }

  return ''
}

/**
 * @param {unknown} error
 */
function getErrorMessage(error) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message
  }

  return String(error)
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
 * @param {Set<string>} args.failedRoots
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
  failedRoots,
  storeConcurrency,
  signal,
}) {
  if (signal?.aborted || batch.length === 0) return

  let stateChanged = false
  const failedUploads = new Set()
  /** @type {Error | undefined} */
  let firstError
  const storeResults = await pMap(
    batch,
    (shard) => storeShard({ shard, context, fetcher, signal }),
    { concurrency: storeConcurrency, signal }
  )

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
      failedRoots.add(result.error.root)
      failedUploads.add(result.error.root)
      firstError ??= result.error.error
      if (!copyState.failedUploads.has(result.error.root)) {
        stateChanged =
          recordFailedUpload(state, spaceDID, 0, result.error.root) ||
          stateChanged
      }
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
        new Error(`${failedUploads.size} upload(s) had shards that failed to store`),
      roots: [...failedUploads],
    })
  }

  if (stateChanged) {
    yield /** @type {API.MigrationEvent} */ ({ type: 'state:checkpoint', state })
  }
}

/**
 * @param {object} args
 * @param {Array<{ shardCid: string, pieceCID: string, root: string }>} args.batch
 * @param {API.StorageContext} args.context
 * @param {API.StorageContext} args.sourceContext
 * @param {AbortSignal | undefined} args.signal
 * @returns {Promise<API.PullResult<{ shardCid: string, pieceCID: string, root: string }>>}
 */
async function presignAndPullFromStore({
  batch,
  context,
  sourceContext,
  signal,
}) {
  return await presignAndPullBatch({
    batch,
    context,
    getPieceCID: (entry) => entry.pieceCID,
    getRoot: (entry) => entry.root,
    getSourceURL: (_entry, pieceCid) => sourceContext.getPieceUrl(pieceCid),
    signal,
  })
}

// ── Utilities ───────────────────────────────────────────────────────────────

/**
 * Build a store-executor-only execution view for a single inventory.
 *
 * This intentionally does not mutate the reader-owned inventory in state.
 * Reader output is shared across planning, resume, summaries, and the pull
 * executor, so the store executor keeps its merged shard bucket as a local
 * per-space view only.
 *
 * @param {API.SpaceInventory} inventory
 * @returns {API.SpaceInventory}
 */
function prepareInventoryForExecution(inventory) {
  return {
    did: inventory.did,
    name: inventory.name,
    uploads: [...inventory.uploads],
    shards: [],
    shardsToStore: [...inventory.shardsToStore, ...inventory.shards],
    skippedUploads: [...inventory.skippedUploads],
    totalBytes: inventory.totalBytes,
    totalSizeToMigrate: inventory.totalSizeToMigrate,
  }
}

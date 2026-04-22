import pRetry from 'p-retry'
import {
  DEFAULT_STORE_FETCH_RETRIES,
  DEFAULT_STORE_OPERATION_RETRIES,
  PRIMARY_COPY_INDEX,
  SECONDARY_COPY_INDEX,
} from '../constants.js'
import { runConcurrentTasks } from './concurrent.js'
import { applyPullResults } from './pull-results.js'
import { presignAndPullBatch } from './pull.js'
import {
  createRetryableError,
  isRetryableHttpStatus,
  shouldRetryFetchError,
  shouldRetryStoreOperationError,
} from './retry-policy.js'
import { batches } from '../utils.js'
import { recordFailedUpload, recordPull, recordStoredShard } from '../state.js'

/**
 * @import * as API from '../api.js'
 */

/**
 * Store all actionable store-routed shards on the primary copy and return
 * durable commit entries keyed by shard CID.
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

  for (const shard of inventory.shardsToStore) {
    const storedPieceCID = copyState.storedShards[shard.cid]
    if (storedPieceCID) {
      entriesByShardCid.set(shard.cid, {
        shardCid: shard.cid,
        pieceCID: storedPieceCID,
        root: shard.root,
      })
    }
  }

  /** @type {API.StoreShard[]} */
  const actionableShards = []
  for (const shard of inventory.shardsToStore) {
    const storedPieceCID = copyState.storedShards[shard.cid]
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

  return entriesByShardCid
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

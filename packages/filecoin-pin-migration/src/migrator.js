import pMap from 'p-map'
import {
  DEFAULT_STOP_ON_ERROR,
  DEFAULT_MAX_COMMIT_RETRIES,
  DEFAULT_COMMIT_RETRY_TIMEOUT,
  DEFAULT_PULL_BATCH_SIZE,
  DEFAULT_PULL_CONCURRENCY,
} from './constants.js'
import {
  commitPieceBatches,
} from './commit.js'
import { ensureFunding } from './funding.js'
import { presignAndPullBatch } from './pull.js'
import { batches, toPieceCID } from './utils.js'
import {
  recordPull,
  recordFailedUpload,
  finalizeSpace,
  finalizeMigration,
} from './state.js'
import { deriveMigrationSummary } from './summary.js'

/** @import * as API from './api.js' */

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Execute a migration from Storacha to Filecoin on Chain (FOC).
 *
 * Yields MigrationEvents. Consumers iterate with `for await` and handle
 * persistence, progress display, and error reporting at their own pace.
 *
 * Flow:
 *   1. Fund once via synapse.payments.fundSync (pre-flight).
 *   2. For each space copy: presign+pull batches concurrently, checkpoint
 *      pulled shards, then commit that copy in sequential internal batches.
 *   3. Yield migration:complete with a summary derived from final state.
 *
 * Concurrency model:
 *   presign+pull runs concurrently across `pullConcurrency` batches.
 *   Commit runs sequentially per copy after all pull batches finish.
 *
 * Resume: pass the deserialized MigrationState. Shards already in a copy's
 * committed set are skipped. Shards already in a copy's pulled set are not
 * re-pulled and go straight to commit batching. createMigrationPlan() pins
 * SP and dataset bindings from state automatically.
 *
 * stopOnError: when true, a shard failure excludes remaining shards for
 * that upload root from future batches. Other uploads in the same space
 * and other spaces continue.
 *
 * @param {API.ExecuteMigrationInput} input
 * @returns {AsyncGenerator<API.MigrationEvent>}
 */
export async function* executeMigration({
  plan,
  state,
  synapse,
  batchSize: batchSizeOpt,
  stopOnError: stopOnErrorOpt,
  maxCommitRetries: maxCommitRetriesOpt,
  commitRetryTimeout: commitRetryTimeoutOpt,
  pullConcurrency: pullConcurrencyOpt,
  signal,
}) {
  const startedAt = Date.now()
  const batchSize = batchSizeOpt ?? DEFAULT_PULL_BATCH_SIZE
  const stopOnError = stopOnErrorOpt ?? DEFAULT_STOP_ON_ERROR
  const maxCommitRetries = maxCommitRetriesOpt ?? DEFAULT_MAX_COMMIT_RETRIES
  const commitRetryTimeout =
    commitRetryTimeoutOpt ?? DEFAULT_COMMIT_RETRY_TIMEOUT
  const pullConcurrency = pullConcurrencyOpt ?? DEFAULT_PULL_CONCURRENCY

  yield* ensureFunding(plan.costs, plan.fundingAmount, synapse, state)

  state.phase = 'migrating'

  for (const perSpaceCost of plan.costs.perSpace) {
    if (signal?.aborted) break

    const inventory = state.spacesInventories[perSpaceCost.spaceDID]
    if (!inventory) continue

    yield* migrateSpace({
      inventory,
      perSpaceCost,
      state,
      batchSize,
      stopOnError,
      maxCommitRetries,
      commitRetryTimeout,
      pullConcurrency,
      signal,
    })
  }

  finalizeMigration(state)

  const summary = deriveMigrationSummary({
    state,
    inventories: state.spacesInventories,
    totalBytes: plan.totals.bytes,
    startedAt,
    getActionableShards: (inventory) => inventory.shards,
  })
  
  yield {
    type: 'migration:complete',
    summary,
  }
}

// ── Per-space migration ───────────────────────────────────────────────────────

/**
 * Migrate all shards for one space across both copies.
 *
 * Pending shards are split into pull batches and processed concurrently.
 * Each batch returns pull candidates plus its failed upload roots. After all
 * pulls finish, the migrator reconciles failed roots once, checkpoints the
 * surviving pulled shards into the active copy state, then commits that copy
 * in sequential internal batches.
 *
 * @param {object} args
 * @param {API.SpaceInventory} args.inventory
 * @param {API.PerSpaceCost} args.perSpaceCost
 * @param {API.MigrationState} args.state
 * @param {number} args.batchSize
 * @param {boolean} args.stopOnError
 * @param {number} args.maxCommitRetries
 * @param {number} args.commitRetryTimeout
 * @param {number} args.pullConcurrency
 * @param {AbortSignal | undefined} args.signal
 * @returns {AsyncGenerator<API.MigrationEvent>}
 */
async function* migrateSpace({
  inventory,
  perSpaceCost,
  state,
  batchSize,
  stopOnError,
  maxCommitRetries,
  commitRetryTimeout,
  pullConcurrency,
  signal,
}) {
  const space = state.spaces[perSpaceCost.spaceDID]
  if (!space) return

  for (const copyCost of perSpaceCost.copies) {
    if (signal?.aborted) break

    yield* migrateCopy({
      inventory,
      copyCost,
      state,
      batchSize,
      stopOnError,
      maxCommitRetries,
      commitRetryTimeout,
      pullConcurrency,
      signal,
    })
  }

  finalizeSpace(state, perSpaceCost.spaceDID)
  // Final space checkpoint — reflects terminal phase after finalization.
  yield /** @type {API.MigrationEvent} */ ({ type: 'state:checkpoint', state })
}

/**
 * Migrate one copy for a single space.
 *
 * @param {object} args
 * @param {API.SpaceInventory} args.inventory
 * @param {API.PerCopyCost} args.copyCost
 * @param {API.MigrationState} args.state
 * @param {number} args.batchSize
 * @param {boolean} args.stopOnError
 * @param {number} args.maxCommitRetries
 * @param {number} args.commitRetryTimeout
 * @param {number} args.pullConcurrency
 * @param {AbortSignal | undefined} args.signal
 * @returns {AsyncGenerator<API.MigrationEvent>}
 */
async function* migrateCopy({
  inventory,
  copyCost,
  state,
  batchSize,
  stopOnError,
  maxCommitRetries,
  commitRetryTimeout,
  pullConcurrency,
  signal,
}) {
  const { context, copyIndex, spaceDID } = copyCost
  const space = state.spaces[spaceDID]
  const copy = space?.copies.find((item) => item.copyIndex === copyIndex)
  if (!space || !copy) return

  /** @type {Set<string>} */
  const activeFailedRoots = new Set(copy.failedUploads)
  /** @type {API.ResolvedShard[]} */
  const shardsToPull = []
  /** @type {Map<string, API.ResolvedShard>} */
  const shardByCid = new Map()

  for (const shard of inventory.shards) {
    shardByCid.set(shard.cid, shard)
    if (copy.committed.has(shard.cid) || copy.pulled.has(shard.cid)) continue
    if (stopOnError && activeFailedRoots.has(shard.root)) continue
    shardsToPull.push(shard)
  }

  let pulledChanged = false

  if (shardsToPull.length > 0 && !signal?.aborted) {
    const pullResults = await pMap(
      batches(shardsToPull, batchSize),
      (batch) => presignAndPull({ batch, context, signal }),
      { concurrency: pullConcurrency, signal }
    )

    /** @type {API.ResolvedShard[]} */
    const pulledCandidates = []

    for (const result of pullResults) {
      if (result.failedUploads.size > 0) {
        for (const root of result.failedUploads) {
          if (stopOnError) activeFailedRoots.add(root)
          recordFailedUpload(state, spaceDID, copyIndex, root)
        }

        yield /** @type {API.MigrationEvent} */ ({
          type: 'migration:batch:failed',
          spaceDID,
          copyIndex,
          stage: /** @type {API.MigratorPhase} */ (result.stage),
          error: /** @type {Error} */ (result.error),
          roots: [...result.failedUploads],
        })
      }

      pulledCandidates.push(...result.pulledCandidates)
    }

    // check if activeFailedRoots.size > 0
    for (const shard of pulledCandidates) {
      if (stopOnError && activeFailedRoots.has(shard.root)) continue
      pulledChanged =
        recordPull(state, spaceDID, copyIndex, shard.cid) || pulledChanged
    }

    if (pulledChanged) {
      yield /** @type {API.MigrationEvent} */ ({
        type: 'state:checkpoint',
        state,
      })
    }
  }

  if (signal?.aborted) return

  const commitPieceIterable = iterateCopyCommitPieces({
    copy,
    shardByCid,
    activeFailedRoots,
    stopOnError,
  })

  yield *
    commitPieceBatches({
      commitPieceIterable,
      context,
      state,
      spaceDID,
      copyIndex,
      maxCommitRetries,
      commitRetryTimeout,
      activeFailedRoots,
    })
}

// ── Batch processing ──────────────────────────────────────────────────────────

/**
 * Execute presign → pull for a single shard batch.
 *
 * Never throws. Failure semantics:
 *   presign failure — whole batch fails, no shards are pulled
 *   pull failure   — per-piece; pulledCandidates contains only batch-local successful shards
 *
 * @param {object} args
 * @param {API.ResolvedShard[]} args.batch
 * @param {API.StorageContext} args.context
 * @param {AbortSignal | undefined} args.signal
 * @returns {Promise<API.PullResult>}
 */
async function presignAndPull({ batch, context, signal }) {
  return await presignAndPullBatch({
    batch,
    context,
    getPieceCID: (shard) => shard.pieceCID,
    getRoot: (shard) => shard.root,
    getSourceURL: (shard) => shard.sourceURL,
    signal,
  })
}

/**
 * @param {object} args
 * @param {API.SpaceCopyState} args.copy
 * @param {Map<string, API.ResolvedShard>} args.shardByCid
 * @param {Set<string>} args.activeFailedRoots
 * @param {boolean} args.stopOnError
 * @returns {Generator<API.CommitPiece>}
 */
function* iterateCopyCommitPieces({
  copy,
  shardByCid,
  activeFailedRoots,
  stopOnError,
}) {
  for (const cid of copy.pulled) {
    const shard = shardByCid.get(cid)
    if (!shard) continue
    if (stopOnError && activeFailedRoots.has(shard.root)) continue

    yield {
      pieceCid: toPieceCID(shard.pieceCID),
      pieceMetadata: { ipfsRootCID: shard.root },
      shardCid: shard.cid,
    }
  }
}

import pRetry from 'p-retry'
import { Piece } from '@web3-storage/data-segment'
import {
  FundingFailedFailure,
  PresignFailedFailure,
  PullFailedFailure,
  CommitFailedFailure,
} from './errors.js'
import {
  transitionToFunded,
  recordCommit,
  finalizeSpace,
  finalizeMigration,
} from './state.js'

/**
 * @import { PieceCID } from '@filoz/synapse-sdk'
 * @import * as API from './api.js'
 */

const DEFAULT_BATCH_SIZE = 50
const STOP_ON_ERROR = true
const PULL_RETRIES = 3
const DEFAULT_MAX_COMMIT_RETRIES = 3
const DEFAULT_COMMIT_RETRY_TIMEOUT = 30_000

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Execute a migration from Storacha to Filecoin on Chain (FOC).
 *
 * Yields MigrationEvents. Consumers iterate with `for await` and handle
 * persistence, progress display, and error reporting at their own pace.
 *
 * Flow:
 *   1. Fund once via synapse.payments.fundSync (pre-flight).
 *   2. For each space: process shards in cross-upload batches, checkpoint after each commit.
 *   3. Yield migration:complete with a summary derived from final state.
 *
 * Resume: pass the deserialized MigrationState. Shards already in
 * state.committed are skipped. createMigrationPlan() pins SP
 * and dataset bindings from state automatically.
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
  signal,
}) {
  const startedAt = Date.now()
  const batchSize = batchSizeOpt ?? DEFAULT_BATCH_SIZE
  const stopOnError = stopOnErrorOpt ?? STOP_ON_ERROR
  const maxCommitRetries = maxCommitRetriesOpt ?? DEFAULT_MAX_COMMIT_RETRIES
  const commitRetryTimeout =
    commitRetryTimeoutOpt ?? DEFAULT_COMMIT_RETRY_TIMEOUT

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
      signal,
    })
  }

  finalizeMigration(state)
  yield {
    type: 'migration:complete',
    summary: deriveSummary(plan, state, startedAt),
  }
}

// ── Funding ───────────────────────────────────────────────────────────────────

/**
 * Fund once if a deposit is needed.
 *
 * When costs.ready is true (deposit = 0 and FWSS approved) no transaction is
 * needed — transition state to 'funded' silently. On resume this is the common
 * path since the deposit was already made in a prior run.
 *
 * Yields funding:failed then re-throws so the generator terminates cleanly
 * and the consumer receives a terminal signal.
 *
 * @param {API.MigrationCostResult} costs
 * @param {bigint} fundingAmount - Pre-computed by planner (deposit + safety buffer)
 * @param {API.Synapse} synapse
 * @param {API.MigrationState} state
 * @returns {AsyncGenerator<API.MigrationEvent>}
 */
async function* ensureFunding(costs, fundingAmount, synapse, state) {
  if (costs.ready) {
    if (state.phase === 'approved') transitionToFunded(state)
    return
  }

  yield { type: 'funding:start', amount: fundingAmount }

  try {
    const result = await synapse.payments.fundSync({
      amount: fundingAmount,
      needsFwssMaxApproval: costs.needsFwssMaxApproval,
    })
    if (result.receipt.status === 'reverted') {
      throw new Error(
        `Funding transaction ${result.hash} failed with status ${result.receipt.status}`
      )
    }
  } catch (err) {
    const error = new FundingFailedFailure(
      err instanceof Error ? err.message : String(err)
    )
    yield { type: 'funding:failed', error }
    throw error
  }

  transitionToFunded(state)
  yield { type: 'funding:complete' }
}

// ── Per-space migration ───────────────────────────────────────────────────────

/**
 * Migrate all shards for one space in cross-upload batches.
 *
 * Reads from the flat inventory.shards array. Filters committed shards once,
 * then processes in full-sized batches. stopOnError tracks failed upload roots
 * in a Set — shards from failed roots are excluded from future batches.
 *
 * @param {object} args
 * @param {API.SpaceInventory} args.inventory
 * @param {API.PerSpaceCost} args.perSpaceCost
 * @param {API.MigrationState} args.state
 * @param {number} args.batchSize
 * @param {boolean} args.stopOnError
 * @param {number} args.maxCommitRetries
 * @param {number} args.commitRetryTimeout
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
  signal,
}) {
  const { context, spaceDID } = perSpaceCost
  const space = state.spaces[spaceDID]
  if (!space) return

  // Single filter on flat array — O(n), unavoidable
  const pending = inventory.shards.filter(
    (shard) => !(shard.cid in space.committed)
  )

  /** @type {Set<string>} */
  const failedRoots = new Set()

  for (const batch of batches(pending, batchSize)) {
    if (signal?.aborted) break

    // Exclude shards from uploads that already failed
    const eligible = stopOnError
      ? batch.filter((shard) => !failedRoots.has(shard.root))
      : batch

    if (eligible.length === 0) continue

    const result = await processBatch({
      batch: eligible,
      context,
      signal,
    })

    // ── Commit retry loop ──────────────────────────────────────────────
    if (
      result.stage === 'commit' &&
      result.commitPieces &&
      maxCommitRetries > 0
    ) {
      const piecesToRetry = result.commitPieces
      let attempt = 1
      while (attempt <= maxCommitRetries) {
        const decision = createDecision(commitRetryTimeout)

        yield /** @type {API.MigrationEvent} */ {
          type: 'migration:commit:failed',
          spaceDID,
          error: /** @type {Error} */ (result.error),
          roots: [...result.failedUploads],
          attempt,
          retry: decision.retry,
          skip: decision.skip,
        }

        const choice = await decision.promise
        if (choice !== 'retry') break

        try {
          const extraData = await context.presignForCommit(piecesToRetry)
          const commitResult = await context.commit({
            pieces: piecesToRetry,
            extraData,
          })

          result.dataSetId = commitResult.dataSetId
          result.committed = piecesToRetry.map((p) => ({
            shardCid: p.shardCid,
            pieceCID: String(p.pieceCid),
            root: p.pieceMetadata.ipfsRootCID,
          }))
          for (const p of piecesToRetry) {
            result.failedUploads.delete(p.pieceMetadata.ipfsRootCID)
          }
          result.stage = undefined
          result.error = undefined
          result.commitPieces = undefined
          break
        } catch (retryError) {
          result.error = new CommitFailedFailure(
            retryError instanceof Error
              ? retryError.message
              : String(retryError)
          )
          attempt++
        }
      }
    }

    if (result.failedUploads.size > 0) {
      for (const root of result.failedUploads) {
        if (stopOnError) failedRoots.add(root)
        space.failedUploads[root] = true
      }

      yield /** @type {API.MigrationEvent} */ ({
        type: 'migration:batch:failed',
        spaceDID,
        stage: /** @type {API.MigratorPhase} */ (result.stage),
        error: /** @type {Error} */ (result.error),
        roots: [...result.failedUploads],
      })
    }

    // Handle successful commits
    if (result.committed.length > 0 && result.dataSetId !== undefined) {
      for (const entry of result.committed) {
        recordCommit(state, spaceDID, entry.shardCid, result.dataSetId)
      }
      yield /** @type {API.MigrationEvent} */ ({
        type: 'state:checkpoint',
        state,
      })
    }
  }

  finalizeSpace(state, spaceDID)
  // Final space checkpoint — reflects terminal phase after finalization.
  yield /** @type {API.MigrationEvent} */ ({ type: 'state:checkpoint', state })
}

// ── Batch processing ──────────────────────────────────────────────────────────

/**
 * Execute one presign → pull → commit cycle on a shard batch.
 *
 * Never throws. Each stage has distinct failure semantics:
 *   presign failure — whole batch fails (no EIP-712 signature, cannot proceed)
 *   pull failure   — per-piece; commit proceeds with successfully pulled pieces only
 *   commit failure — all successfully-pulled pieces fail
 *
 * @param {object} args
 * @param {API.ResolvedShard[]} args.batch
 * @param {API.StorageContext} args.context
 * @param {AbortSignal | undefined} args.signal
 * @returns {Promise<API.BatchResult>}
 */
async function processBatch({ batch, context, signal }) {
  // one pass pre-processing
  /** @type {API.PieceCID[]} */
  const pieces = []
  const presignPayload = []
  const allRoots = new Set()
  const pieceToShard = new Map()

  // question: can we add concurrency here?
  for (const shard of batch) {
    const pieceCid = toPieceCID(shard.pieceCID)

    pieceToShard.set(shard.pieceCID, shard)
    pieces.push(pieceCid)

    presignPayload.push({
      pieceCid,
      pieceMetadata: { ipfsRootCID: shard.root },
    })

    allRoots.add(shard.root)
  }

  // ── 1. Presign ──────────────────────────────────────────────────────────
  // Per-batch: the EIP-712 signature is scoped to the exact pieces in the
  // batch, so it cannot be hoisted to the space or migration level.
  let extraData
  try {
    extraData = await context.presignForCommit(presignPayload)
  } catch (error) {
    return failBatch('presign', {
      error,
      failedUploads: allRoots,
    })
  }

  // ── 2. Pull (with retry — transient network errors are common) ──────────
  let pullResult
  try {
    pullResult = await pRetry(
      () =>
        context.pull({
          pieces,
          from: (cid) => {
            const shard = pieceToShard.get(String(cid))
            if (!shard) throw new Error(`No entry for pieceCID ${cid}`)
            return shard.sourceURL
          },
          extraData,
          signal,
        }),
      { retries: PULL_RETRIES, signal }
    )
  } catch (error) {
    return failBatch('pull', {
      error,
      failedUploads: allRoots,
    })
  }

  /** @type {API.ResolvedShard[]} */
  const commitCandidates = []
  const failedUploadsInBatch = new Set()

  for (const piece of pullResult.pieces) {
    const shard = pieceToShard.get(String(piece.pieceCid))
    if (!shard) continue

    if (piece.status === 'complete') {
      commitCandidates.push(shard)
    } else {
      failedUploadsInBatch.add(shard.root)
      // Note: if we want to notify the user about the shard failure this could be the place
    }
  }

  const shardsToCommit =
    failedUploadsInBatch.size === 0
      ? commitCandidates
      : commitCandidates.filter((s) => !failedUploadsInBatch.has(s.root))

  if (shardsToCommit.length === 0) {
    return failBatch('pull', {
      failedUploads: failedUploadsInBatch,
      error: new Error('All pieces in batch failed to pull'),
    })
  }

  // NOTE: if some pieces failed to pull, we need to verify if we can reuse the same signature or if we need to re-presign with the reduced piece set.

  // ── 3. Commit ────────────────────────────────────────────────────────────
  /** @type {API.CommitPiece[]} */
  const commitPieces = shardsToCommit.map((shard) => ({
    pieceCid: toPieceCID(shard.pieceCID),
    pieceMetadata: { ipfsRootCID: shard.root },
    shardCid: shard.cid, // this is ignored by the context.commit, only used for post-commit bookkeeping
  }))

  let commitResult
  try {
    commitResult = await context.commit({ pieces: commitPieces, extraData })
  } catch (error) {
    const failedUploads = new Set(shardsToCommit.map((s) => s.root))
    return failBatch('commit', { failedUploads, error, commitPieces })
  }

  /** @type {API.BatchResult} */
  const batchResult = {
    dataSetId: commitResult.dataSetId,
    committed: commitPieces.map((p) => ({
      shardCid: p.shardCid,
      pieceCID: String(p.pieceCid),
      root: p.pieceMetadata.ipfsRootCID,
    })),
    failedUploads: failedUploadsInBatch,
  }

  if (failedUploadsInBatch.size > 0) {
    batchResult.stage = 'pull'
    batchResult.error = new PullFailedFailure(
      `${failedUploadsInBatch.size} upload(s) had pieces that failed to pull`
    )
  }

  return batchResult
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Create a deferred decision with retry/skip callbacks.
 * Resolves to 'skip' automatically after timeout.
 *
 * @param {number} timeoutMs
 * @returns {{ promise: Promise<'retry' | 'skip'>, retry: () => void, skip: () => void }}
 */
function createDecision(timeoutMs) {
  /** @type {(value: 'retry' | 'skip') => void} */
  let resolve
  const promise = /** @type {Promise<'retry' | 'skip'>} */ (
    new Promise((r) => {
      resolve = r
    })
  )

  let settled = false
  const retry = () => {
    if (!settled) {
      settled = true
      resolve('retry')
    }
  }
  const skip = () => {
    if (!settled) {
      settled = true
      resolve('skip')
    }
  }

  if (timeoutMs <= 0) {
    // Zero or negative timeout — resolve immediately so we never hang
    resolve('skip')
  } else {
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        resolve('skip')
      }
    }, timeoutMs)
    if (typeof timer === 'object' && 'unref' in timer) timer.unref()
    promise.then(() => clearTimeout(timer))
  }

  return { promise, retry, skip }
}

/**
 * Lazy batch iterator — yields slices of `arr` without upfront allocation.
 *
 * @template T
 * @param {T[]} arr
 * @param {number} size
 * @returns {Generator<T[]>}
 */
function* batches(arr, size) {
  for (let i = 0; i < arr.length; i += size) {
    yield arr.slice(i, i + size)
  }
}

/**
 * Fail an entire batch at a named stage.
 *
 * @param {API.MigratorPhase} stage
 * @param {object} args
 * @param {unknown} args.error
 * @param {Set<string>} args.failedUploads
 * @param {API.CommittedEntry[]} [args.committed]
 * @param {bigint | undefined} [args.dataSetId]
 * @param {API.CommitPiece[]} [args.commitPieces]
 * @returns {API.BatchResult}
 */
function failBatch(
  stage,
  { error, failedUploads, committed = [], dataSetId, commitPieces }
) {
  const msg = error instanceof Error ? error.message : String(error)

  const err =
    stage === 'presign'
      ? new PresignFailedFailure(msg)
      : stage === 'commit'
      ? new CommitFailedFailure(msg)
      : new PullFailedFailure(msg)

  return {
    dataSetId,
    committed,
    failedUploads,
    error: err,
    stage,
    commitPieces,
  }
}

/**
 * Derive migration summary from final state.
 *
 * @param {API.MigrationPlan} plan
 * @param {API.MigrationState} state
 * @param {number} startedAt
 * @returns {API.MigrationSummary}
 */
function deriveSummary(plan, state, startedAt) {
  let succeeded = 0
  let failed = 0
  for (const [did, inventory] of Object.entries(state.spacesInventories)) {
    const space = state.spaces[/** @type {API.SpaceDID} */ (did)]
    if (!space) continue
    const committedCount = Object.keys(space.committed).length
    succeeded += committedCount
    failed += inventory.shards.length - committedCount
  }
  return {
    succeeded,
    failed,
    skippedUploads: Object.values(state.spacesInventories).reduce(
      (n, inv) => n + inv.failedUploads.length,
      0
    ),
    dataSetIds: Object.values(state.spaces)
      .map((s) => s.dataSetId)
      .filter(/** @returns {id is bigint} */ (id) => id != null),
    totalBytes: plan.totals.bytes,
    duration: Date.now() - startedAt,
  }
}

/**
 * Convert a pieceCID string to the SDK's typed PieceCID at the SDK boundary.
 *
 * @param {string} str
 * @returns {PieceCID}
 */
function toPieceCID(str) {
  return Piece.fromString(str).link
}

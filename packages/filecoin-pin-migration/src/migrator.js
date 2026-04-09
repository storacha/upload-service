import { Piece } from '@web3-storage/data-segment'
import {
  InsufficientFundsFailure,
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
// One dataset per space — avoids N× sybil fees and R2 egress.

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Execute a migration from Storacha to Filecoin on Chain (FOC).
 *
 * Yields MigrationEvents. Consumers iterate with `for await` and handle
 * persistence, progress display, and error reporting at their own pace.
 * The generator pauses at each yield — consumers can await async work
 * (e.g. writing state to disk) without blocking unrelated events.
 *
 * Flow:
 *   1. Fund once via synapse.payments.fundSync (pre-flight).
 *   2. For each space: process uploads in batches, checkpoint after each commit.
 *   3. Yield migration:complete with a summary derived from final state.
 *
 * Resume: pass the deserialized MigrationState. Shards already in
 * state.committed are skipped per provider. createMigrationPlan() pins SP
 * and dataset bindings from state automatically.
 *
 * stopOnError: when true, a shard failure stops the remaining batches for
 * that upload only. Other uploads in the same space and other spaces continue.
 * Failed uploads appear as 'incomplete' in the final state.
 *
 * @param {object} args
 * @param {API.MigrationPlan} args.plan - Approved plan from createMigrationPlan()
 * @param {API.MigrationState} args.state - Use createApprovalState() for fresh runs
 * @param {API.Synapse} args.synapse - Initialized Synapse SDK instance
 * @param {API.MigrationConfig} args.config - Same config used for planning
 * @returns {AsyncGenerator<API.MigrationEvent>}
 */
export async function* executeMigration({ plan, state, synapse, config }) {
  const startedAt = Date.now()
  const batchSize = config.options?.batchSize ?? DEFAULT_BATCH_SIZE
  const stopOnError = config.options?.stopOnError ?? false
  const signal = config.options?.signal

  yield* ensureFunding(plan.costs, synapse, state)

  state.phase = 'migrating'

  for (const perSpaceCost of plan.costs.perSpace) {
    if (signal?.aborted) break

    const spacePlan = plan.spaces.find((s) => s.did === perSpaceCost.spaceDID)
    if (!spacePlan) continue

    yield* migrateSpace({ spacePlan, perSpaceCost, state, batchSize, stopOnError, signal })
  }

  finalizeMigration(state)
  yield { type: 'migration:complete', summary: deriveSummary(plan, state, startedAt) }
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
 * @param {API.Synapse} synapse
 * @param {API.MigrationState} state
 * @returns {AsyncGenerator<API.MigrationEvent>}
 */
async function* ensureFunding(costs, synapse, state) {
  if (costs.ready) {
    if (state.phase === 'approved') transitionToFunded(state)
    return
  }

  yield { type: 'funding:start', amount: costs.totalDepositNeeded }

  try {
    await synapse.payments.fundSync({
      amount: costs.totalDepositNeeded,
      needsFwssMaxApproval: costs.needsFwssMaxApproval,
    })
  } catch (err) {
    // TODO:check the error message 
    const error = new InsufficientFundsFailure(err instanceof Error ? err.message : String(err))
    yield { type: 'funding:failed', error }
    throw error
  }

  transitionToFunded(state)
  yield { type: 'funding:complete' }
}

// ── Per-space migration ───────────────────────────────────────────────────────

/**
 * Migrate all uploads for one space in sequential batches.
 *
 * Iterates uploads individually so stopOnError can be applied at upload
 * granularity: a failure stops the remaining batches for that upload only,
 * then the next upload proceeds normally.
 *
 * Skips shards already committed to this provider (resume path).
 * Yields shard:failed per failure and state:checkpoint after each batch
 * with at least one commit. Calls finalizeSpace before the last checkpoint
 * so the space phase is resolved before the consumer persists.
 *
 * @param {object} args
 * @param {API.PlanSpace} args.spacePlan
 * @param {API.PerSpaceCost} args.perSpaceCost
 * @param {API.MigrationState} args.state
 * @param {number} args.batchSize
 * @param {boolean} args.stopOnError
 * @param {AbortSignal | undefined} args.signal
 * @returns {AsyncGenerator<API.MigrationEvent>}
 */
async function* migrateSpace({ spacePlan, perSpaceCost, state, batchSize, stopOnError, signal }) {
  const { context, spaceDID, serviceProvider } = perSpaceCost

  for (const upload of spacePlan.uploads) {
    if (signal?.aborted) break

    const shards = upload.shards.map((shard) => ({ shard, root: upload.root }))

    for (const batch of batches(shards, batchSize)) {
      if (signal?.aborted) break

      const pending = batch.filter(
        ({ shard }) => !(state.committed[shard.cid] ?? []).includes(serviceProvider)
      )
      if (pending.length === 0) continue

      const result = await processBatch({ batch: pending, context, signal })

      for (const failure of result.failures) {
        yield /** @type {API.MigrationEvent} */ ({
          type: 'shard:failed',
          spaceDID,
          root: failure.root,
          shard: failure.shardCid,
          error: failure.error,
        })
      }

      if (result.committed.length > 0 && result.dataSetId !== undefined) {
        for (const entry of result.committed) {
          recordCommit(state, spaceDID, entry.root, entry.shardCid, serviceProvider, result.dataSetId)
        }
        yield /** @type {API.MigrationEvent} */ ({ type: 'state:checkpoint', state })
      }

      // stopOnError: stop remaining batches for this upload only.
      // The next upload and other spaces are unaffected.
      if (stopOnError && result.failures.length > 0) break
    }
  }

  finalizeSpace(state, spaceDID)
  // Final space checkpoint — reflects terminal phase after finalization.
  yield /** @type {API.MigrationEvent} */ ({ type: 'state:checkpoint', state })
}

// ── Batch processing ──────────────────────────────────────────────────────────

/**
 * @typedef {{ shardCid: string; pieceCID: string; root: string }} CommittedEntry
 * @typedef {{ root: string; shardCid: string; error: Error }} FailureEntry
 * @typedef {{ dataSetId: bigint | undefined; committed: CommittedEntry[]; failures: FailureEntry[] }} BatchResult
 */

/**
 * Execute one presign → pull → commit cycle on a shard batch.
 *
 * Never throws. Each stage has distinct failure semantics:
 *   presign failure — whole batch fails (no EIP-712 signature, cannot proceed)
 *   pull failure   — per-piece; commit proceeds with successfully pulled pieces only
 *   commit failure — all successfully-pulled pieces fail
 *
 * Pull status is read from pullResult.pieces (source of truth)
 *
 * @param {object} args
 * @param {Array<{ shard: API.ResolvedShard; root: string }>} args.batch
 * @param {API.StorageContext} args.context
 * @param {AbortSignal | undefined} args.signal
 * @returns {Promise<BatchResult>}
 */
async function processBatch({ batch, context, signal }) {
  const pieceToEntry = new Map(batch.map((e) => [e.shard.pieceCID, e]))

  // ── 1. Presign ──────────────────────────────────────────────────────────
  let extraData
  try {
    extraData = await context.presignForCommit(
      batch.map(({ shard, root }) => ({
        pieceCid: toPieceCID(shard.pieceCID),
        pieceMetadata: { ipfsRootCID: root },
      }))
    )
  } catch (err) {
    return failBatch(batch, err, 'presign')
  }

  // ── 2. Pull ─────────────────────────────────────────────────────────────
  let pullResult
  try {
    pullResult = await context.pull({
      pieces: batch.map(({ shard }) => toPieceCID(shard.pieceCID)),
      from: (cid) => {
        const entry = pieceToEntry.get(String(cid))
        // Invariant: map is built from the same batch so this should never miss.
        if (!entry) throw new Error(`No entry for pieceCID ${cid}`)
        return entry.shard.sourceURL
      },
      extraData,
      signal,
    })
  } catch (err) {
    return failBatch(batch, err, 'pull')
  }

  // Partition pull result into succeeded entries and per-piece failures.
  // pullResult.pieces enumerates every piece with its final status.
  /** @type {Array<{ shard: API.ResolvedShard; root: string }>} */
  const succeeded = []
  /** @type {FailureEntry[]} */
  const pullFailures = []

  for (const piece of pullResult.pieces) {
    const entry = pieceToEntry.get(String(piece.pieceCid))
    if (!entry) continue
    if (piece.status === 'complete') {
      succeeded.push(entry)
    } else {
      pullFailures.push({
        root: entry.root,
        shardCid: entry.shard.cid,
        error: new PullFailedFailure(`Pull failed for piece ${entry.shard.pieceCID}`),
      })
    }
  }

  if (succeeded.length === 0) {
    return { dataSetId: undefined, committed: [], failures: pullFailures }
  }

  // ── 3. Commit ────────────────────────────────────────────────────────────
  let commitResult
  try {
    commitResult = await context.commit({
      pieces: succeeded.map(({ shard, root }) => ({
        pieceCid: toPieceCID(shard.pieceCID),
        pieceMetadata: { ipfsRootCID: root },
      })),
      extraData,
    })
  } catch (err) {
    return failBatch(succeeded, err, 'commit')
  }

  return {
    dataSetId: commitResult.dataSetId,
    committed: succeeded.map(({ shard, root }) => ({
      shardCid: shard.cid,
      pieceCID: shard.pieceCID,
      root,
    })),
    failures: pullFailures,
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

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
 * Always wraps the error in the stage-specific Failure class so `.name`-based
 * error classification is reliable downstream. The SDK never throws our own
 * Failure classes so double-wrapping is not a concern.
 *
 * @param {Array<{ shard: API.ResolvedShard; root: string }>} entries
 * @param {unknown} err
 * @param {'presign' | 'pull' | 'commit'} stage
 * @returns {BatchResult}
 */
function failBatch(entries, err, stage) {
  const msg = err instanceof Error ? err.message : String(err)
  const error =
    stage === 'presign' ? new PresignFailedFailure(msg)
    : stage === 'commit' ? new CommitFailedFailure(msg)
    : new PullFailedFailure(msg)
  return {
    dataSetId: undefined,
    committed: [],
    failures: entries.map(({ shard, root }) => ({ root, shardCid: shard.cid, error })),
  }
}

/**
 * Derive migration summary from final state.
 *
 * Called once after finalizeMigration() — counters are computed from
 * state.spaces rather than tracked separately during execution.
 *
 * @param {API.MigrationPlan} plan
 * @param {API.MigrationState} state
 * @param {number} startedAt
 * @returns {API.MigrationSummary}
 */
function deriveSummary(plan, state, startedAt) {
  let succeeded = 0
  let failed = 0
  for (const space of Object.values(state.spaces)) {
    for (const upload of Object.values(space.uploads)) {
      succeeded += upload.committedShards
      failed += upload.totalShards - upload.committedShards
    }
  }
  return {
    succeeded,
    failed,
    skipped: plan.spaces.reduce((n, s) => n + s.skippedShards.length, 0),
    dataSetIds: Object.values(state.spaces)
      .map((s) => s.dataSetId)
      .filter(/** @returns {id is bigint} */ (id) => id != null),
    totalBytes: plan.totals.bytes,
    duration: Date.now() - startedAt,
  }
}

/**
 * Convert a pieceCID string to the SDK's typed PieceCID at the SDK boundary.
 * Strings are used throughout the plan/state surface (Pattern A).
 *
 * @param {string} str
 * @returns {PieceCID}
 */
function toPieceCID(str) {
  return Piece.fromString(str).link
}

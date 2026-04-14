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
export async function* executeMigration({ plan, state, synapse, batchSize: batchSizeOpt, stopOnError: stopOnErrorOpt, signal }) {
  const startedAt = Date.now()
  const batchSize = batchSizeOpt ?? DEFAULT_BATCH_SIZE
  const stopOnError = stopOnErrorOpt ?? STOP_ON_ERROR

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
 * @param {AbortSignal | undefined} args.signal
 * @returns {AsyncGenerator<API.MigrationEvent>}
 */
async function* migrateSpace({
  inventory,
  perSpaceCost,
  state,
  batchSize,
  stopOnError,
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

    const result = await processBatch({ batch: eligible, context, signal })

    for (const failure of result.failures) {
      if (stopOnError) failedRoots.add(failure.root)
      space.failedUploads[failure.root] = true
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
 * @param {object} args
 * @param {API.ResolvedShard[]} args.batch
 * @param {API.StorageContext} args.context
 * @param {AbortSignal | undefined} args.signal
 * @returns {Promise<BatchResult>}
 */
async function processBatch({ batch, context, signal }) {
  const pieceToShard = new Map(batch.map((s) => [s.pieceCID, s]))

  // ── 1. Presign ──────────────────────────────────────────────────────────
  // Per-batch: the EIP-712 signature is scoped to the exact pieces in the
  // batch, so it cannot be hoisted to the space or migration level.
  let extraData
  try {
    extraData = await context.presignForCommit(
      batch.map((shard) => ({
        pieceCid: toPieceCID(shard.pieceCID),
        pieceMetadata: { ipfsRootCID: shard.root },
      }))
    )
  } catch (err) {
    return failBatch(batch, err, 'presign')
  }

  // ── 2. Pull (with retry — transient network errors are common) ──────────
  let pullResult
  try {
    pullResult = await pRetry(
      () =>
        context.pull({
          pieces: batch.map((shard) => toPieceCID(shard.pieceCID)),
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
  } catch (err) {
    return failBatch(batch, err, 'pull')
  }

  // Partition pull result into succeeded entries and per-piece failures.
  /** @type {API.ResolvedShard[]} */
  const succeeded = []
  /** @type {FailureEntry[]} */
  const pullFailures = []

  for (const piece of pullResult.pieces) {
    const shard = pieceToShard.get(String(piece.pieceCid))
    if (!shard) continue
    if (piece.status === 'complete') {
      succeeded.push(shard)
    } else {
      pullFailures.push({
        root: shard.root,
        shardCid: shard.cid,
        error: new PullFailedFailure(`Pull failed for piece ${shard.pieceCID}`),
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
      pieces: succeeded.map((shard) => ({
        pieceCid: toPieceCID(shard.pieceCID),
        pieceMetadata: { ipfsRootCID: shard.root },
      })),
      extraData,
    })
  } catch (err) {
    return failBatch(succeeded, err, 'commit')
  }

  return {
    dataSetId: commitResult.dataSetId,
    committed: succeeded.map((shard) => ({
      shardCid: shard.cid,
      pieceCID: shard.pieceCID,
      root: shard.root,
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
 * @param {API.ResolvedShard[]} shards
 * @param {unknown} err
 * @param {'presign' | 'pull' | 'commit'} stage
 * @returns {BatchResult}
 */
function failBatch(shards, err, stage) {
  const msg = err instanceof Error ? err.message : String(err)
  const error =
    stage === 'presign'
      ? new PresignFailedFailure(msg)
      : stage === 'commit'
      ? new CommitFailedFailure(msg)
      : new PullFailedFailure(msg)
  return {
    dataSetId: undefined,
    committed: [],
    failures: shards.map((shard) => ({
      root: shard.root,
      shardCid: shard.cid,
      error,
    })),
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
  for (const [did, space] of Object.entries(state.spaces)) {
    const inventory = state.spacesInventories[/** @type {API.SpaceDID} */ (did)]
    if (!inventory) continue
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

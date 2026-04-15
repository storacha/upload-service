import pRetry from 'p-retry'
import pMap from 'p-map'
import { Piece } from '@web3-storage/data-segment'
import {
  FundingFailedFailure,
  PresignFailedFailure,
  PullFailedFailure,
  CommitFailedFailure,
} from './errors.js'
import {
  transitionToFunded,
  recordPull,
  recordFailedUpload,
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
const DEFAULT_PULL_CONCURRENCY = 4

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Execute a migration from Storacha to Filecoin on Chain (FOC).
 *
 * Yields MigrationEvents. Consumers iterate with `for await` and handle
 * persistence, progress display, and error reporting at their own pace.
 *
 * Flow:
 *   1. Fund once via synapse.payments.fundSync (pre-flight).
 *   2. For each space: presign+pull batches concurrently, checkpoint pulled shards,
 *      then do one final space-level commit.
 *   3. Yield migration:complete with a summary derived from final state.
 *
 * Concurrency model:
 *   presign+pull runs concurrently across `pullConcurrency` batches.
 *   Commit runs once per space after all pull batches finish.
 *
 * Resume: pass the deserialized MigrationState. Shards already in
 * state.committed are skipped. Shards in state.pulled are not re-pulled and
 * go straight to the final commit. createMigrationPlan() pins SP and dataset
 * bindings from state automatically.
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
  const batchSize = batchSizeOpt ?? DEFAULT_BATCH_SIZE
  const stopOnError = stopOnErrorOpt ?? STOP_ON_ERROR
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
 * Migrate all shards for one space.
 *
 * Pending shards are split into pull batches and processed concurrently.
 * Each batch returns pull candidates plus its failed upload roots. After all
 * pulls finish, the migrator reconciles failed roots once, checkpoints the
 * surviving pulled shards into state.pulled, then does one final per-space
 * commit.
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
  const { context, spaceDID } = perSpaceCost
  const space = state.spaces[spaceDID]
  if (!space) return

  /** @type {Set<string>} */
  const failedRoots = new Set(space.failedUploads)
  /** @type {API.ResolvedShard[]} */
  const shardsToPull = []
  /** @type {Map<string, API.ResolvedShard>} */
  const shardByCid = new Map()

  for (const shard of inventory.shards) {
    shardByCid.set(shard.cid, shard)
    if (space.committed.has(shard.cid) || space.pulled.has(shard.cid)) continue
    if (stopOnError && failedRoots.has(shard.root)) continue
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
          if (stopOnError) failedRoots.add(root)
          recordFailedUpload(state, spaceDID, root)
        }

        yield /** @type {API.MigrationEvent} */ ({
          type: 'migration:batch:failed',
          spaceDID,
          stage: /** @type {API.MigratorPhase} */ (result.stage),
          error: /** @type {Error} */ (result.error),
          roots: [...result.failedUploads],
        })
      }

      pulledCandidates.push(...result.pulledCandidates)
    }

    for (const shard of pulledCandidates) {
      if (stopOnError && failedRoots.has(shard.root)) continue
      pulledChanged = recordPull(state, spaceDID, shard.cid) || pulledChanged
    }

    if (pulledChanged) {
      yield /** @type {API.MigrationEvent} */ ({
        type: 'state:checkpoint',
        state,
      })
    }
  }

  if (!signal?.aborted) {
    /** @type {API.ResolvedShard[]} */
    const shardsToCommit = []
    for (const cid of space.pulled) {
      const shard = shardByCid.get(cid)
      if (!shard) continue
      if (stopOnError && failedRoots.has(shard.root)) continue
      shardsToCommit.push(shard)
    }

    if (shardsToCommit.length > 0) {
      const result = await commitPulledShards({
        shards: shardsToCommit,
        context,
      })

      if (
        result.stage === 'commit' &&
        result.commitPieces &&
        maxCommitRetries > 0
      ) {
        yield* retryCommitInteractively(
          result,
          context,
          spaceDID,
          maxCommitRetries,
          commitRetryTimeout
        )
      }

      if (result.failedUploads.size > 0) {
        for (const root of result.failedUploads) {
          recordFailedUpload(state, spaceDID, root)
        }

        yield /** @type {API.MigrationEvent} */ ({
          type: 'migration:batch:failed',
          spaceDID,
          stage: 'commit',
          error: /** @type {Error} */ (result.error),
          roots: [...result.failedUploads],
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
  }

  finalizeSpace(state, spaceDID)
  // Final space checkpoint — reflects terminal phase after finalization.
  yield /** @type {API.MigrationEvent} */ ({ type: 'state:checkpoint', state })
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
  // One-pass pre-processing
  /** @type {API.PieceCID[]} */
  const pieces = []
  /** @type {Array<{ pieceCid: API.PieceCID; pieceMetadata: { ipfsRootCID: string } }>} */
  const presignPayload = []
  const allRoots = new Set()
  const pieceToShard = new Map()
  /**
   * @param {'presign' | 'pull'} stage
   * @param {unknown} error
   * @returns {API.PullResult}
   */
  const toOperationalFailure = (stage, error) => {
    const msg = error instanceof Error ? error.message : String(error)
    return {
      pulledCandidates: [],
      failedUploads: allRoots,
      failureKind: 'operational',
      stage,
      error:
        stage === 'presign'
          ? new PresignFailedFailure(msg)
          : new PullFailedFailure(msg),
    }
  }

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

  // ── 1. Presign ────────────────────────────────────────────────────────────
  // Per-batch: the EIP-712 signature is scoped to the exact pieces in this
  // batch and cannot be hoisted to the space or migration level.
  let extraData
  try {
    extraData = await context.presignForCommit(presignPayload)
  } catch (error) {
    return toOperationalFailure('presign', error)
  }

  // ── 2. Pull (with retry — transient network errors are common) ────────────
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
    return toOperationalFailure('pull', error)
  }

  // Partition pull results. When any piece of an upload fails, the rest of that
  // upload is excluded from this batch's candidate set.
  /** @type {API.ResolvedShard[]} */
  const pulledCandidates = []
  const failedUploadsInBatch = new Set()

  for (const piece of pullResult.pieces) {
    const shard = pieceToShard.get(String(piece.pieceCid))
    if (!shard) continue

    if (piece.status === 'complete') {
      pulledCandidates.push(shard)
    } else {
      failedUploadsInBatch.add(shard.root)
    }
  }

  const pulledCandidatesFiltered = failedUploadsInBatch.size === 0
    ? pulledCandidates
    : pulledCandidates.filter((s) => !failedUploadsInBatch.has(s.root))

  const baseResult = {
    pulledCandidates: pulledCandidatesFiltered,
    failedUploads: failedUploadsInBatch,
  }

  if (pulledCandidatesFiltered.length === 0) {
    return {
      ...baseResult,
      failureKind: 'upload',
      stage: /** @type {const} */ ('pull'),
      error: new PullFailedFailure('All pieces in batch failed to pull'),
    }
  }

  if (failedUploadsInBatch.size > 0) {
    return {
      ...baseResult,
      failureKind: 'upload',
      stage: 'pull',
      error: new PullFailedFailure(
        `${failedUploadsInBatch.size} upload(s) had pieces that failed to pull`
      ),
    }
  }

  return {
    ...baseResult,
  }
}

/**
 * Commit every pulled shard for a space in one final commit.
 *
 * Never throws.
 *
 * @param {object} args
 * @param {API.ResolvedShard[]} args.shards
 * @param {API.StorageContext} args.context
 * @returns {Promise<API.BatchResult>}
 */
async function commitPulledShards({ shards, context }) {
  const commitPieces = toCommitPieces(shards)

  try {
    const extraData = await context.presignForCommit(commitPieces)
    const result = await context.commit({
      pieces: commitPieces,
      extraData,
    })
    return {
      dataSetId: result.dataSetId,
      committed: toCommittedEntries(commitPieces),
      failedUploads: new Set(),
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    const failedUploads = new Set(
      commitPieces.map((piece) => piece.pieceMetadata.ipfsRootCID)
    )
    return {
      dataSetId: undefined,
      committed: [],
      failedUploads,
      error: new CommitFailedFailure(msg),
      stage: 'commit',
      commitPieces,
    }
  }
}

/**
 * Interactive commit retry loop. Yields `migration:commit:failed` events so the
 * consumer can call `retry()` or `skip()`, then re-presigns and retries up to
 * `maxRetries` times. Mutates `result` in place on success so the caller's
 * existing bookkeeping stays consistent.
 *
 * @param {API.BatchResult} result — commit-stage failure (result.commitPieces must be set)
 * @param {API.StorageContext} context
 * @param {API.SpaceDID} spaceDID
 * @param {number} maxRetries
 * @param {number} retryTimeout
 * @returns {AsyncGenerator<API.MigrationEvent>}
 */
async function* retryCommitInteractively(
  result,
  context,
  spaceDID,
  maxRetries,
  retryTimeout
) {
  const piecesToRetry = /** @type {API.CommitPiece[]} */ (result.commitPieces)
  let attempt = 1

  while (attempt <= maxRetries) {
    const decision = createDecision(retryTimeout)

    yield /** @type {API.MigrationEvent} */ ({
      type: 'migration:commit:failed',
      spaceDID,
      error: /** @type {Error} */ (result.error),
      roots: [...result.failedUploads],
      attempt,
      retry: decision.retry,
      skip: decision.skip,
    })

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
        retryError instanceof Error ? retryError.message : String(retryError)
      )
      attempt++
    }
  }
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
  // eslint-disable-next-line no-unused-vars
  let resolve = /** @type {(value: 'retry' | 'skip') => void} */ (() => {})
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
 * Yields batches lazily without allocating them upfront.
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
    const committedCount = space.committed.size
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

/**
 * @param {API.ResolvedShard[]} shards
 * @returns {API.CommitPiece[]}
 */
function toCommitPieces(shards) {
  return shards.map((shard) => ({
    pieceCid: toPieceCID(shard.pieceCID),
    pieceMetadata: { ipfsRootCID: shard.root },
    shardCid: shard.cid,
  }))
}

/**
 * @param {API.CommitPiece[]} commitPieces
 * @returns {API.CommittedEntry[]}
 */
function toCommittedEntries(commitPieces) {
  return commitPieces.map((piece) => ({
    shardCid: piece.shardCid,
    pieceCID: String(piece.pieceCid),
    root: piece.pieceMetadata.ipfsRootCID,
  }))
}

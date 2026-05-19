import { commitPieceBatches } from './commit.js'
import { drainConcurrentStream, streamConcurrentTasks } from './concurrent.js'
import { applyPullResults } from './pull-results.js'
import { presignAndPullBatch } from './pull.js'
import {
  pullStoredShardsOnSecondaryCopy,
  storeShardsOnPrimaryCopy,
} from './store-flow.js'
import {
  expandShardRoots,
  getActionableRootsForRun,
  hasAnyCommittedRootForShard,
  isShardFullyCommitted,
} from '../state.js'
import { batches, toPieceCID } from '../utils.js'
import { PRIMARY_COPY_INDEX } from '../constants.js'

/**
 * @import * as API from '../api.js'
 */

/**
 * @typedef {object} MigrationExecutionConfig
 * @property {typeof fetch | undefined} fetcher
 * @property {number} batchSize
 * @property {number} maxCommitRetries
 * @property {number} commitRetryTimeout
 * @property {number} pullConcurrency
 * @property {number} storeConcurrency
 * @property {number} commitConcurrency
 * @property {AbortSignal | undefined} signal
 */

/** @typedef {{ completed: true } | { completed: false }} PhaseResult */

/** @type {PhaseResult} */
const PHASE_COMPLETE = { completed: true }
/** @type {PhaseResult} */
const PHASE_INCOMPLETE = { completed: false }
/** @type {'source-pull'} */
const SOURCE_PULL_PHASE = 'source-pull'
/** @type {'commit'} */
const COMMIT_PHASE = 'commit'

/**
 * Execute one space across both copies.
 *
 * This is the deep internal boundary for migrator execution. It owns:
 * - copy ordering
 * - sticky failed-root tracking per copy
 * - source pull on both copies
 * - store flow on copy 0 and pull-from-copy0 on copy 1
 * - commit stream composition per copy
 * - final per-space checkpointing
 *
 * @param {object} args
 * @param {API.SpaceInventory} args.inventory
 * @param {API.PerSpaceCost} args.perSpaceCost
 * @param {API.MigrationStore} args.store
 * @param {MigrationExecutionConfig} args.config
 * @returns {AsyncGenerator<API.MigrationEvent>}
 */
export async function* migrateSpace({
  inventory,
  perSpaceCost,
  store,
  config,
}) {
  const { signal } = config
  const state = store.getState()
  const space = state.spaces[perSpaceCost.spaceDID]
  if (!space) return

  const { copy0State, copy1State, copy0Cost, copy1Cost } =
    resolveSpaceCopyPairs({ space, perSpaceCost })

  if (
    signal?.aborted ||
    !copy0State ||
    !copy1State ||
    !copy0Cost ||
    !copy1Cost
  ) {
    return
  }

  yield {
    type: 'migration:space:start',
    spaceDID: perSpaceCost.spaceDID,
  }

  const copy0FailedRoots = new Set(copy0State.failedUploads)
  const copy1FailedRoots = new Set(copy1State.failedUploads)

  const {
    representativeResolvedShardByCid,
    representativeStoreShardByCid,
    multiRootShards,
  } = buildSpaceShardExecutionContext(inventory)

  const copy0StoreEntries = yield* runCopy0({
    representativeResolvedShardByCid,
    representativeStoreShardByCid,
    copyState: copy0State,
    copyCost: copy0Cost,
    store,
    state,
    config,
    activeFailedRoots: copy0FailedRoots,
    multiRootShards,
  })

  if (!copy0StoreEntries.completed || signal?.aborted) {
    if (!signal?.aborted) {
      yield* finalizeSpaceExecution(store, state, perSpaceCost.spaceDID)
    }
    return
  }

  const copy1Completed = yield* runCopy1({
    representativeResolvedShardByCid,
    copyState: copy1State,
    copyCost: copy1Cost,
    sourceContext: copy0Cost.context,
    copy0StoreEntries: copy0StoreEntries.storeEntries,
    store,
    state,
    config,
    activeFailedRoots: copy1FailedRoots,
    multiRootShards,
  })

  if (!copy1Completed.completed || signal?.aborted) {
    if (!signal?.aborted) {
      yield* finalizeSpaceExecution(store, state, perSpaceCost.spaceDID)
    }
    return
  }

  yield* finalizeSpaceExecution(store, state, perSpaceCost.spaceDID)
}

/**
 * Execute the full copy 0 flow:
 * - store store-routed shards
 * - source-pull normal shards
 * - commit both buckets
 *
 * @param {object} args
 * @param {Map<string, API.ResolvedShard>} args.representativeResolvedShardByCid
 * @param {Map<string, API.StoreShard>} args.representativeStoreShardByCid
 * @param {API.SpaceCopyState} args.copyState
 * @param {API.PerCopyCost} args.copyCost
 * @param {API.MigrationStore} args.store
 * @param {API.MigrationState} args.state
 * @param {MigrationExecutionConfig} args.config
 * @param {Set<string>} args.activeFailedRoots
 * @param {Map<string, string[]>} args.multiRootShards
 * @returns {AsyncGenerator<API.MigrationEvent, { completed: true, storeEntries: Map<string, API.CommitEntry> } | { completed: false }, void>}
 */
async function* runCopy0({
  representativeResolvedShardByCid,
  representativeStoreShardByCid,
  copyState,
  copyCost,
  store,
  state,
  config,
  activeFailedRoots,
  multiRootShards,
}) {
  const {
    fetcher,
    batchSize,
    maxCommitRetries,
    commitRetryTimeout,
    storeConcurrency,
    commitConcurrency,
    signal,
  } = config
  /** @type {Map<string, API.CommitEntry>} */
  let storeEntries = new Map()
  const { copyIndex } = copyCost

  yield {
    type: 'migration:copy:start',
    spaceDID: copyCost.spaceDID,
    copyIndex,
  }

  if (representativeStoreShardByCid.size > 0) {
    const entriesByShardCid = yield* storeShardsOnPrimaryCopy({
      representativeStoreShardByCid,
      copyState,
      copyCost,
      store,
      state,
      fetcher: /** @type {typeof fetch} */ (fetcher),
      batchSize,
      storeConcurrency,
      activeFailedRoots,
      signal,
      multiRootShards,
    })

    if (!entriesByShardCid) {
      yield emitCopyComplete(copyCost.spaceDID, copyIndex, false)
      return { completed: false }
    }
    storeEntries = entriesByShardCid
  }

  const sourcePullCompleted = yield* pullSourceShardsForCopy({
    representativeResolvedShardByCid,
    copyState,
    copyCost,
    store,
    state,
    config,
    activeFailedRoots,
    multiRootShards,
  })

  if (
    !sourcePullCompleted.completed &&
    !hasPreparedOrCommittedCopyWork({
      copyState,
      storeEntries: storeEntries.values(),
    })
  ) {
    yield emitCopyComplete(copyCost.spaceDID, copyIndex, false)
    return { completed: false }
  }

  yield emitPhaseStart(copyCost.spaceDID, copyIndex, COMMIT_PHASE)
  yield* commitPieceBatches({
    commitPieceIterable: iterateCopyCommitPieces({
      copyState,
      representativeResolvedShardByCid,
      storeEntries: storeEntries.values(),
      activeFailedRoots,
      multiRootShards,
    }),
    context: copyCost.context,
    store,
    state,
    spaceDID: copyCost.spaceDID,
    copyIndex: copyCost.copyIndex,
    maxCommitRetries,
    commitRetryTimeout,
    commitConcurrency,
    signal,
    activeFailedRoots,
    getShardRoots: (shardCid, root) =>
      expandShardRoots(shardCid, root, multiRootShards),
  })

  const completed = !signal?.aborted
  yield emitPhaseComplete(copyCost.spaceDID, copyIndex, COMMIT_PHASE, completed)
  if (!completed) {
    yield emitCopyComplete(copyCost.spaceDID, copyIndex, false)
    return { completed: false }
  }

  yield emitCopyComplete(copyCost.spaceDID, copyIndex, true)
  return { completed: true, storeEntries }
}

/**
 * Execute the full copy 1 flow:
 * - source-pull normal shards
 * - pull stored pieces from copy 0
 * - commit both buckets
 *
 * @param {object} args
 * @param {Map<string, API.ResolvedShard>} args.representativeResolvedShardByCid
 * @param {API.SpaceCopyState} args.copyState
 * @param {API.PerCopyCost} args.copyCost
 * @param {API.StorageContext} args.sourceContext
 * @param {Map<string, API.CommitEntry>} args.copy0StoreEntries
 * @param {API.MigrationStore} args.store
 * @param {API.MigrationState} args.state
 * @param {MigrationExecutionConfig} args.config
 * @param {Set<string>} args.activeFailedRoots
 * @param {Map<string, string[]>} args.multiRootShards
 * @returns {AsyncGenerator<API.MigrationEvent, PhaseResult, void>}
 */
async function* runCopy1({
  representativeResolvedShardByCid,
  copyState,
  copyCost,
  sourceContext,
  copy0StoreEntries,
  store,
  state,
  config,
  activeFailedRoots,
  multiRootShards,
}) {
  const {
    batchSize,
    maxCommitRetries,
    commitRetryTimeout,
    pullConcurrency,
    commitConcurrency,
    signal,
  } = config
  const { copyIndex } = copyCost

  yield {
    type: 'migration:copy:start',
    spaceDID: copyCost.spaceDID,
    copyIndex,
  }
  const sourcePullCompleted = yield* pullSourceShardsForCopy({
    representativeResolvedShardByCid,
    copyState,
    copyCost,
    store,
    state,
    config,
    activeFailedRoots,
    multiRootShards,
  })

  if (
    !sourcePullCompleted.completed &&
    !hasPreparedOrCommittedCopyWork({
      copyState,
      storeEntries: copy0StoreEntries.values(),
    })
  ) {
    yield emitCopyComplete(copyCost.spaceDID, copyIndex, false)
    return PHASE_INCOMPLETE
  }

  /** @type {Map<string, API.CommitEntry>} */
  let storeEntries = new Map()

  if (copy0StoreEntries.size > 0) {
    const entriesByShardCid = yield* pullStoredShardsOnSecondaryCopy({
      entriesByShardCid: copy0StoreEntries,
      copyState,
      sourceContext,
      copyCost,
      store,
      state,
      batchSize,
      pullConcurrency,
      activeFailedRoots,
      signal,
      multiRootShards,
    })

    if (!entriesByShardCid) {
      yield emitCopyComplete(copyCost.spaceDID, copyIndex, false)
      return PHASE_INCOMPLETE
    }
    storeEntries = entriesByShardCid
  }

  yield emitPhaseStart(copyCost.spaceDID, copyIndex, COMMIT_PHASE)
  yield* commitPieceBatches({
    commitPieceIterable: iterateCopyCommitPieces({
      copyState,
      representativeResolvedShardByCid,
      storeEntries: storeEntries.values(),
      activeFailedRoots,
      multiRootShards,
    }),
    context: copyCost.context,
    store,
    state,
    spaceDID: copyCost.spaceDID,
    copyIndex: copyCost.copyIndex,
    maxCommitRetries,
    commitRetryTimeout,
    commitConcurrency,
    signal,
    activeFailedRoots,
    getShardRoots: (shardCid, root) =>
      expandShardRoots(shardCid, root, multiRootShards),
  })

  const completed = !signal?.aborted
  yield emitPhaseComplete(copyCost.spaceDID, copyIndex, COMMIT_PHASE, completed)
  if (!completed) {
    yield emitCopyComplete(copyCost.spaceDID, copyIndex, false)
    return PHASE_INCOMPLETE
  }

  yield emitCopyComplete(copyCost.spaceDID, copyIndex, true)
  return PHASE_COMPLETE
}

/**
 * Pull the normal source-routed shards for a single copy.
 *
 * @param {object} args
 * @param {Map<string, API.ResolvedShard>} args.representativeResolvedShardByCid
 * @param {API.SpaceCopyState} args.copyState
 * @param {API.PerCopyCost} args.copyCost
 * @param {API.MigrationStore} args.store
 * @param {API.MigrationState} args.state
 * @param {MigrationExecutionConfig} args.config
 * @param {Set<string>} args.activeFailedRoots
 * @param {Map<string, string[]>} args.multiRootShards
 * @returns {AsyncGenerator<API.MigrationEvent, PhaseResult, void>}
 */
async function* pullSourceShardsForCopy({
  representativeResolvedShardByCid,
  copyState,
  copyCost,
  store,
  state,
  config,
  activeFailedRoots,
  multiRootShards,
}) {
  const { batchSize, pullConcurrency, signal } = config
  const { context, copyIndex, spaceDID } = copyCost
  /** @type {API.ResolvedShard[]} */
  const shardsToPull = []

  for (const shard of representativeResolvedShardByCid.values()) {
    const shardRoots = expandShardRoots(shard.cid, shard.root, multiRootShards)
    if (
      copyState.pulled.has(shard.cid) ||
      isShardFullyCommitted(copyState, shard.cid, shardRoots)
    ) {
      continue
    }

    const pendingShardRoots = getActionableRootsForRun(
      copyState,
      shard.cid,
      shardRoots,
      activeFailedRoots
    )
    if (pendingShardRoots.length === 0) continue
    shardsToPull.push(shard)
  }

  const batchCount = Math.ceil(shardsToPull.length / batchSize)
  yield emitPhaseStart(spaceDID, copyIndex, SOURCE_PULL_PHASE, {
    itemCount: shardsToPull.length,
    batchCount,
  })

  if (shardsToPull.length > 0 && !signal?.aborted) {
    const stream = streamConcurrentTasks({
      items: batches(shardsToPull, batchSize),
      concurrency: pullConcurrency,
      signal,
      run: (batch) =>
        presignAndPull({
          batch,
          context,
          phase: SOURCE_PULL_PHASE,
          signal,
        }),
    })
    const { aborted } = yield* drainConcurrentStream(stream, (pullResult) =>
      applyPullResults({
        pullResults: [pullResult],
        store,
        state,
        spaceDID,
        copyIndex,
        activeFailedRoots,
        getFailureRoots: (shard) =>
          expandShardRoots(shard.cid, shard.root, multiRootShards),
        onPulledCandidate: (shard) =>
          store.recordPull({
            spaceDID,
            copyIndex,
            shardCid: shard.cid,
            shardRoots: expandShardRoots(
              shard.cid,
              shard.root,
              multiRootShards
            ),
          }),
      })
    )

    if (aborted) {
      yield emitPhaseComplete(spaceDID, copyIndex, SOURCE_PULL_PHASE, false)
      return PHASE_INCOMPLETE
    }
  }

  if (signal?.aborted) {
    yield emitPhaseComplete(spaceDID, copyIndex, SOURCE_PULL_PHASE, false)
    return PHASE_INCOMPLETE
  }

  if (representativeResolvedShardByCid.size === 0) {
    yield emitPhaseComplete(spaceDID, copyIndex, SOURCE_PULL_PHASE, true)
    return PHASE_COMPLETE
  }

  const completed = hasPreparedOrCommittedSourceWork({
    copyState,
    representativeResolvedShardByCid,
    multiRootShards,
  })
  yield emitPhaseComplete(spaceDID, copyIndex, SOURCE_PULL_PHASE, completed)
  return completed ? PHASE_COMPLETE : PHASE_INCOMPLETE
}

/**
 * Execute presign → pull for a single source-routed shard batch.
 *
 * @param {object} args
 * @param {API.ResolvedShard[]} args.batch
 * @param {API.StorageContext} args.context
 * @param {'source-pull' | 'secondary-pull'} args.phase
 * @param {AbortSignal | undefined} args.signal
 * @returns {Promise<API.PullResult>}
 */
async function presignAndPull({ batch, context, phase, signal }) {
  return await presignAndPullBatch({
    batch,
    context,
    getPieceCID: (shard) => shard.pieceCID,
    getRoot: (shard) => shard.root,
    getSourceURL: (shard) => shard.sourceURL,
    phase,
    signal,
  })
}

/**
 * @param {API.MigrationStore} store
 * @param {API.MigrationState} state
 * @param {API.SpaceDID} spaceDID
 * @returns {AsyncGenerator<API.MigrationEvent>}
 */
async function* finalizeSpaceExecution(store, state, spaceDID) {
  store.finalizeSpace(spaceDID)
  const phase = state.spaces[spaceDID]?.phase
  if (phase) {
    yield {
      type: 'migration:space:complete',
      spaceDID,
      phase,
    }
  }
  yield { type: 'state:checkpoint', state }
}

/**
 * @param {object} args
 * @param {API.SpaceCopyState} args.copyState
 * @param {Map<string, API.ResolvedShard>} args.representativeResolvedShardByCid
 * @param {Iterable<API.CommitEntry>} args.storeEntries
 * @param {Set<string>} args.activeFailedRoots
 * @param {Map<string, string[]>} args.multiRootShards
 * @returns {Generator<API.CommitPiece>}
 */
function* iterateCopyCommitPieces({
  copyState,
  representativeResolvedShardByCid,
  storeEntries,
  activeFailedRoots,
  multiRootShards,
}) {
  yield* iterateSourceCommitPieces({
    copyState,
    representativeResolvedShardByCid,
    activeFailedRoots,
    multiRootShards,
  })

  for (const entry of storeEntries) {
    yield* iterateRootExpandedCommitPieces({
      copyState,
      shardCid: entry.shardCid,
      representativeRoot: entry.root,
      pieceCid: toPieceCID(entry.pieceCID),
      activeFailedRoots,
      multiRootShards,
    })
  }
}

/**
 * @param {object} args
 * @param {API.SpaceCopyState} args.copyState
 * @param {Map<string, API.ResolvedShard>} args.representativeResolvedShardByCid
 * @param {Set<string>} args.activeFailedRoots
 * @param {Map<string, string[]>} args.multiRootShards
 * @returns {Generator<API.CommitPiece>}
 */
function* iterateSourceCommitPieces({
  copyState,
  representativeResolvedShardByCid,
  activeFailedRoots,
  multiRootShards,
}) {
  for (const cid of copyState.pulled) {
    const shard = representativeResolvedShardByCid.get(cid)
    // copyState.pulled can also contain store-path shard CIDs for this copy.
    if (!shard) continue
    yield* iterateRootExpandedCommitPieces({
      copyState,
      shardCid: shard.cid,
      representativeRoot: shard.root,
      pieceCid: toPieceCID(shard.pieceCID),
      activeFailedRoots,
      multiRootShards,
    })
  }
}

/**
 * Expand one prepared shard/piece into one commit piece per actionable root.
 *
 * Source-path and store-path preparation differ, but once a piece is ready to
 * commit the root-aware expansion rule is identical.
 *
 * @param {object} args
 * @param {API.SpaceCopyState} args.copyState
 * @param {string} args.shardCid
 * @param {string} args.representativeRoot
 * @param {API.PieceCID} args.pieceCid
 * @param {Set<string>} args.activeFailedRoots
 * @param {Map<string, string[]>} args.multiRootShards
 * @returns {Generator<API.CommitPiece>}
 */
function* iterateRootExpandedCommitPieces({
  copyState,
  shardCid,
  representativeRoot,
  pieceCid,
  activeFailedRoots,
  multiRootShards,
}) {
  const shardRoots = expandShardRoots(
    shardCid,
    representativeRoot,
    multiRootShards
  )
  const actionableRoots = getActionableRootsForRun(
    copyState,
    shardCid,
    shardRoots,
    activeFailedRoots
  )

  for (const root of actionableRoots) {
    yield {
      pieceCid,
      pieceMetadata: { ipfsRootCID: root },
      shardCid,
    }
  }
}

/**
 * @param {object} args
 * @param {API.SpaceCopyState} args.copyState
 * @param {Iterable<API.CommitEntry>} args.storeEntries
 */
function hasPreparedOrCommittedCopyWork({ copyState, storeEntries }) {
  if (copyState.pulled.size > 0 || copyState.committed.size > 0) return true

  for (const _entry of storeEntries) {
    return true
  }

  return false
}

/**
 * @param {object} args
 * @param {API.SpaceCopyState} args.copyState
 * @param {Map<string, API.ResolvedShard>} args.representativeResolvedShardByCid
 * @param {Map<string, string[]>} args.multiRootShards
 */
function hasPreparedOrCommittedSourceWork({
  copyState,
  representativeResolvedShardByCid,
  multiRootShards,
}) {
  for (const shard of representativeResolvedShardByCid.values()) {
    const shardRoots = expandShardRoots(shard.cid, shard.root, multiRootShards)
    if (
      copyState.pulled.has(shard.cid) ||
      hasAnyCommittedRootForShard(copyState, shard.cid, shardRoots)
    ) {
      return true
    }
  }

  return false
}

/**
 * Resolve the ordered [copy0, copy1] state/cost pairs for a space.
 *
 * @param {object} args
 * @param {API.SpaceState} args.space
 * @param {API.PerSpaceCost} args.perSpaceCost
 */
function resolveSpaceCopyPairs({ space, perSpaceCost }) {
  const [copy0State, copy1State] =
    space.copies[0]?.copyIndex === PRIMARY_COPY_INDEX
      ? [space.copies[0], space.copies[1]]
      : [space.copies[1], space.copies[0]]

  const [copy0Cost, copy1Cost] =
    perSpaceCost.copies[0]?.copyIndex === PRIMARY_COPY_INDEX
      ? [perSpaceCost.copies[0], perSpaceCost.copies[1]]
      : [perSpaceCost.copies[1], perSpaceCost.copies[0]]

  return { copy0State, copy1State, copy0Cost, copy1Cost }
}

/**
 * Build the per-space execution context in one pass over `shards` and one pass
 * over `shardsToStore`, instead of rebuilding duplicate-root tracking
 * separately.
 *
 * @param {API.SpaceInventory} inventory
 */
function buildSpaceShardExecutionContext(inventory) {
  /** @type {Map<string, API.ResolvedShard>} */
  const representativeResolvedShardByCid = new Map()
  /** @type {Map<string, API.StoreShard>} */
  const representativeStoreShardByCid = new Map()
  /** @type {Map<string, Set<string>>} */
  const rootsByShardCid = new Map()

  for (const shard of inventory.shards) {
    if (!representativeResolvedShardByCid.has(shard.cid)) {
      representativeResolvedShardByCid.set(shard.cid, shard)
    }

    let roots = rootsByShardCid.get(shard.cid)
    if (!roots) {
      roots = new Set()
      rootsByShardCid.set(shard.cid, roots)
    }
    roots.add(shard.root)
  }

  for (const shard of inventory.shardsToStore) {
    if (!representativeStoreShardByCid.has(shard.cid)) {
      representativeStoreShardByCid.set(shard.cid, shard)
    }

    let roots = rootsByShardCid.get(shard.cid)
    if (!roots) {
      roots = new Set()
      rootsByShardCid.set(shard.cid, roots)
    }
    roots.add(shard.root)
  }

  /** @type {Map<string, string[]>} */
  const multiRootShards = new Map()
  for (const [shardCid, roots] of rootsByShardCid) {
    if (roots.size <= 1) continue
    multiRootShards.set(shardCid, [...roots])
  }

  return {
    representativeResolvedShardByCid,
    representativeStoreShardByCid,
    multiRootShards,
  }
}

/**
 * @param {API.SpaceDID} spaceDID
 * @param {number} copyIndex
 * @param {boolean} completed
 * @returns {API.MigrationEvent}
 */
function emitCopyComplete(spaceDID, copyIndex, completed) {
  return {
    type: 'migration:copy:complete',
    spaceDID,
    copyIndex,
    completed,
  }
}

/**
 * @param {API.SpaceDID} spaceDID
 * @param {number} copyIndex
 * @param {API.MigrationExecutionPhase} phase
 * @param {{ itemCount?: number, batchCount?: number }} [counts]
 * @returns {API.MigrationEvent}
 */
function emitPhaseStart(spaceDID, copyIndex, phase, counts = {}) {
  return {
    type: 'migration:phase:start',
    spaceDID,
    copyIndex,
    phase,
    ...counts,
  }
}

/**
 * @param {API.SpaceDID} spaceDID
 * @param {number} copyIndex
 * @param {API.MigrationExecutionPhase} phase
 * @param {boolean} completed
 * @returns {API.MigrationEvent}
 */
function emitPhaseComplete(spaceDID, copyIndex, phase, completed) {
  return {
    type: 'migration:phase:complete',
    spaceDID,
    copyIndex,
    phase,
    completed,
  }
}

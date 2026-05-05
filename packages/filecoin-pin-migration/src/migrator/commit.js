import { CommitFailedFailure } from '../errors.js'
import {
  MAX_ADD_PIECES_COMMIT_BATCH_PIECES,
  MAX_COMMIT_EXTRADATA_BYTES,
  MAX_CREATE_DATASET_COMMIT_BATCH_PIECES,
} from '../constants.js'
import { runConcurrentTasks } from './concurrent.js'
import { recordCommit, recordFailedUpload } from '../state.js'
import { toPieceCID } from '../utils.js'

/**
 * @import * as API from '../api.js'
 */

const STRING_ENCODER = new TextEncoder()
const IPFS_ROOT_CID_KEY = 'ipfsRootCID'

const ADD_PIECES_BASE_BYTES = 320
// abi.encode(uint256, string[][], string[][], bytes) fixed overhead

const ADD_PIECE_FIXED_BYTES = 288
// 128 piece structural bytes +
// 128 single metadata entry bytes +
// 32 padded bytes for the fixed "ipfsRootCID" key

const CREATE_AND_ADD_WRAPPER_BYTES = 128
// abi.encode(bytes, bytes) wrapper used by signCreateDataSetAndAddPieces

const CREATE_DATASET_BASE_BYTES = 928
// 352 fixed create-dataset overhead +
// 3 metadata entries * 128 structural bytes +
// padded keys: "source", "withIPFSIndexing", "space-did" => 3 * 32 +
// padded values: "storacha-migration" => 32, "" => 0, ed25519 did:key => 64

const CREATE_DATASET_SPACE_NAME_FIXED_BYTES = 160
// 128 single metadata entry bytes +
// 32 padded bytes for the fixed "space-name" key

/**
 * Lazily convert commit entries into commit pieces so callers can stream them
 * into the batch packer without building a second array.
 *
 * @param {Iterable<API.CommitEntry>} entries
 * @param {(entry: API.CommitEntry) => boolean} [include]
 * @returns {Generator<API.CommitPiece>}
 */
export function* iterateCommitPieces(entries, include) {
  for (const entry of entries) {
    if (include && !include(entry)) continue

    yield {
      pieceCid: toPieceCID(entry.pieceCID),
      pieceMetadata: { [IPFS_ROOT_CID_KEY]: entry.root },
      shardCid: entry.shardCid,
    }
  }
}

/**
 * Commit pieces in two phases.
 *
 * Phase 1 runs sequentially until a successful commit establishes a
 * `dataSetId` on the storage context. The first batch typically carries the
 * dataset-creation payload and must complete before later batches can safely
 * use add-pieces signing in parallel.
 *
 * Phase 2 packs the remaining add-pieces batches lazily through the shared
 * iterator and commits them concurrently up to `commitConcurrency`. Once the
 * wave settles, two passes walk the completed results:
 *   - Pass A persists durable successes, yields one checkpoint for the settled
 *     success wave, then emits succeeded `migration:commit:settled` events
 *     before any retry interaction.
 *   - Pass B handles only the failed batches, driving interactive retry and
 *     emitting their final settled / batch-failed events.
 *
 * @param {object} args
 * @param {Iterable<API.CommitPiece>} args.commitPieceIterable
 * @param {API.StorageContext} args.context
 * @param {API.MigrationState} args.state
 * @param {API.SpaceDID} args.spaceDID
 * @param {number} args.copyIndex
 * @param {number} args.maxCommitRetries
 * @param {number} args.commitRetryTimeout
 * @param {number} args.commitConcurrency
 * @param {AbortSignal | undefined} args.signal
 * @param {Set<string>} [args.activeFailedRoots]
 * @returns {AsyncGenerator<API.MigrationEvent>}
 */
export async function* commitPieceBatches({
  commitPieceIterable,
  context,
  state,
  spaceDID,
  copyIndex,
  maxCommitRetries,
  commitRetryTimeout,
  commitConcurrency,
  signal,
  activeFailedRoots,
}) {
  const iterator = commitPieceIterable[Symbol.iterator]()
  /** @type {IteratorResult<API.CommitPiece> | undefined} */
  let pending
  let datasetMetadata = context.dataSetId ? undefined : context.dataSetMetadata
  let commitIndex = 1

  // Phase 1 — sequential until the dataset exists.
  while (datasetMetadata !== undefined) {
    if (signal?.aborted) return

    const batch = takeNextCommitBatch({
      iterator,
      pending,
      datasetMetadata,
      activeFailedRoots,
    })
    pending = batch.pending

    if (batch.commitPieces.length === 0) return

    const result = await commitPreparedBatch({
      context,
      commitPieces: batch.commitPieces,
    })

    yield* finalizeCommitBatchResult({
      result,
      context,
      state,
      spaceDID,
      copyIndex,
      commitIndex,
      maxCommitRetries,
      commitRetryTimeout,
      signal,
    })

    applyActiveFailedRoots(activeFailedRoots, result.failedUploads)

    if ((result.dataSetId ?? context.dataSetId) !== undefined) {
      datasetMetadata = undefined
    }

    commitIndex++
  }

  // Phase 2 — pack and settle concurrent waves without buffering the whole
  // remainder of the copy before persisting known-good work.
  const phase2Concurrency = Math.max(1, commitConcurrency)

  while (true) {
    const wave = takeNextCommitWave({
      iterator,
      pending,
      size: phase2Concurrency,
      activeFailedRoots,
    })
    pending = wave.pending

    if (wave.commitBatches.length === 0) return

    const { aborted, results } = await runConcurrentTasks({
      items: wave.commitBatches,
      concurrency: phase2Concurrency,
      signal,
      run: (commitPieces) => commitPreparedBatch({ context, commitPieces }),
    })

    if (results.length > 0) {
      commitIndex = yield* finalizeConcurrentCommitWave({
        results,
        context,
        state,
        spaceDID,
        copyIndex,
        commitIndexStart: commitIndex,
        maxCommitRetries,
        commitRetryTimeout,
        signal,
        activeFailedRoots,
      })
    }

    if (aborted) return
  }
}

/**
 * @param {Set<string> | undefined} activeFailedRoots
 * @param {Set<string>} failedUploads
 */
function applyActiveFailedRoots(activeFailedRoots, failedUploads) {
  if (!activeFailedRoots || failedUploads.size === 0) return
  for (const root of failedUploads) {
    activeFailedRoots.add(root)
  }
}

/**
 * @param {object} args
 * @param {Iterator<API.CommitPiece>} args.iterator
 * @param {IteratorResult<API.CommitPiece> | undefined} args.pending
 * @param {number} args.size
 * @param {Set<string> | undefined} args.activeFailedRoots
 * @returns {{ commitBatches: API.CommitPiece[][], pending: IteratorResult<API.CommitPiece> | undefined }}
 */
function takeNextCommitWave({ iterator, pending, size, activeFailedRoots }) {
  /** @type {API.CommitPiece[][]} */
  const commitBatches = []
  let nextPending = pending

  while (commitBatches.length < size) {
    const batch = takeNextCommitBatch({
      iterator,
      pending: nextPending,
      datasetMetadata: undefined,
      activeFailedRoots,
    })
    nextPending = batch.pending

    if (batch.commitPieces.length === 0) {
      return { commitBatches, pending: nextPending }
    }

    commitBatches.push(batch.commitPieces)
  }

  return { commitBatches, pending: nextPending }
}

/**
 * Finalize one settled Phase 2 wave.
 *
 * Pass A persists all durable successes from the wave and emits a single
 * checkpoint before any retry interaction. Pass B then retries/finalizes only
 * the failed batches from that same settled wave.
 *
 * @param {object} args
 * @param {API.BatchResult[]} args.results
 * @param {API.StorageContext} args.context
 * @param {API.MigrationState} args.state
 * @param {API.SpaceDID} args.spaceDID
 * @param {number} args.copyIndex
 * @param {number} args.commitIndexStart
 * @param {number} args.maxCommitRetries
 * @param {number} args.commitRetryTimeout
 * @param {AbortSignal | undefined} args.signal
 * @param {Set<string> | undefined} args.activeFailedRoots
 * @returns {AsyncGenerator<API.MigrationEvent, number, void>}
 */
async function* finalizeConcurrentCommitWave({
  results,
  context,
  state,
  spaceDID,
  copyIndex,
  commitIndexStart,
  maxCommitRetries,
  commitRetryTimeout,
  signal,
  activeFailedRoots,
}) {
  /** @type {Array<{ commitIndex: number, result: API.BatchResult }>} */
  const failedCommits = []
  /** @type {Array<{ commitIndex: number, result: API.BatchResult }>} */
  const successfulCommits = []
  let commitIndex = commitIndexStart

  // Pass A — persist durable successes before any retry interaction.
  for (const result of results) {
    const dataSetId = result.dataSetId ?? context.dataSetId
    if (
      result.failedUploads.size === 0 &&
      result.committed.length > 0 &&
      dataSetId !== undefined
    ) {
      for (const entry of result.committed) {
        recordCommit(state, spaceDID, copyIndex, entry.shardCid, dataSetId)
      }
      successfulCommits.push({ commitIndex, result })
    } else {
      failedCommits.push({ commitIndex, result })
    }
    commitIndex++
  }

  if (successfulCommits.length > 0) {
    yield /** @type {API.MigrationEvent} */ ({
      type: 'state:checkpoint',
      state,
    })
  }

  for (const success of successfulCommits) {
    yield /** @type {API.MigrationEvent} */ ({
      type: 'migration:commit:settled',
      spaceDID,
      copyIndex,
      commitIndex: success.commitIndex,
      pieceCount: getBatchPieceCount(success.result),
      status: 'succeeded',
      txHash: success.result.txHash,
      error: undefined,
      roots: [],
    })
  }

  // Pass B — retry and finalize only the failed batches.
  for (const failedCommit of failedCommits) {
    yield* finalizeCommitBatchResult({
      result: failedCommit.result,
      context,
      state,
      spaceDID,
      copyIndex,
      commitIndex: failedCommit.commitIndex,
      maxCommitRetries,
      commitRetryTimeout,
      signal,
    })
    applyActiveFailedRoots(activeFailedRoots, failedCommit.result.failedUploads)
  }

  return commitIndex
}

/**
 * @param {object} args
 * @param {API.StorageContext} args.context
 * @param {API.CommitPiece[]} args.commitPieces
 * @returns {Promise<API.BatchResult>}
 */
async function commitPreparedBatch({ context, commitPieces }) {
  try {
    const result = await attemptCommitBatch(context, commitPieces)
    return {
      dataSetId: result.dataSetId,
      txHash: result.txHash,
      committed: result.committed,
      failedUploads: new Set(),
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return {
      dataSetId: undefined,
      committed: [],
      failedUploads: new Set(
        commitPieces.map((piece) => piece.pieceMetadata[IPFS_ROOT_CID_KEY])
      ),
      error: new CommitFailedFailure(msg),
      stage: 'commit',
      commitPieces,
    }
  }
}

/**
 * Finalize a commit batch result. This is used for:
 * - Phase 1 sequential batches, where the batch is handled immediately
 * - Phase 2 failed batches after the success wave was already persisted in Pass A
 *
 * @param {object} args
 * @param {API.BatchResult} args.result
 * @param {API.StorageContext} args.context
 * @param {API.MigrationState} args.state
 * @param {API.SpaceDID} args.spaceDID
 * @param {number} args.copyIndex
 * @param {number} args.commitIndex
 * @param {number} args.maxCommitRetries
 * @param {number} args.commitRetryTimeout
 * @param {AbortSignal | undefined} args.signal
 * @returns {AsyncGenerator<API.MigrationEvent>}
 */
async function* finalizeCommitBatchResult({
  result,
  context,
  state,
  spaceDID,
  copyIndex,
  commitIndex,
  maxCommitRetries,
  commitRetryTimeout,
  signal,
}) {
  if (
    !signal?.aborted &&
    result.stage === 'commit' &&
    result.commitPieces &&
    maxCommitRetries > 0
  ) {
    yield* retryCommitInteractively(
      result,
      context,
      spaceDID,
      copyIndex,
      commitIndex,
      maxCommitRetries,
      commitRetryTimeout,
      signal
    )
  }

  yield /** @type {API.MigrationEvent} */ ({
    type: 'migration:commit:settled',
    spaceDID,
    copyIndex,
    commitIndex,
    pieceCount: getBatchPieceCount(result),
    status: result.failedUploads.size > 0 ? 'failed' : 'succeeded',
    txHash: result.txHash,
    error: result.error,
    roots: [...result.failedUploads],
  })

  if (result.failedUploads.size > 0) {
    for (const root of result.failedUploads) {
      recordFailedUpload(state, spaceDID, copyIndex, root)
    }

    yield /** @type {API.MigrationEvent} */ ({
      type: 'migration:batch:failed',
      spaceDID,
      copyIndex,
      stage: 'commit',
      error: /** @type {Error} */ (result.error),
      roots: [...result.failedUploads],
    })
  }

  const dataSetId = result.dataSetId ?? context.dataSetId
  if (result.committed.length > 0) {
    if (dataSetId !== undefined) {
      for (const entry of result.committed) {
        recordCommit(state, spaceDID, copyIndex, entry.shardCid, dataSetId)
      }

      yield /** @type {API.MigrationEvent} */ ({
        type: 'state:checkpoint',
        state,
      })
    }
  }
}

/**
/**
 * Interactive commit retry loop. Yields `migration:commit:failed` events so the
 * consumer can call `retry()` or `skip()`, then re-presigns and retries up to
 * `maxRetries` times. Mutates `result` in place on success so the caller's
 * existing bookkeeping stays consistent.
 *
 * @param {API.BatchResult} result
 * @param {API.StorageContext} context
 * @param {API.SpaceDID} spaceDID
 * @param {number} copyIndex
 * @param {number} commitIndex
 * @param {number} maxRetries
 * @param {number} retryTimeout
 * @param {AbortSignal | undefined} signal
 * @returns {AsyncGenerator<API.MigrationEvent>}
 */
async function* retryCommitInteractively(
  result,
  context,
  spaceDID,
  copyIndex,
  commitIndex,
  maxRetries,
  retryTimeout,
  signal
) {
  const piecesToRetry = /** @type {API.CommitPiece[]} */ (result.commitPieces)
  let attempt = 1

  while (attempt <= maxRetries) {
    if (signal?.aborted) break

    const decision = createDecision(retryTimeout)

    yield /** @type {API.MigrationEvent} */ ({
      type: 'migration:commit:failed',
      spaceDID,
      copyIndex,
      commitIndex,
      pieceCount: piecesToRetry.length,
      error: /** @type {Error} */ (result.error),
      roots: [...result.failedUploads],
      attempt,
      retry: decision.retry,
      skip: decision.skip,
    })

    const choice = await decision.promise
    if (signal?.aborted) break
    if (choice !== 'retry') break

    try {
      const commitResult = await attemptCommitBatch(context, piecesToRetry)

      result.dataSetId = commitResult.dataSetId
      result.txHash = commitResult.txHash
      result.committed = commitResult.committed
      for (const piece of piecesToRetry) {
        result.failedUploads.delete(piece.pieceMetadata[IPFS_ROOT_CID_KEY])
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

/**
 * @param {object} args
 * @param {Iterator<API.CommitPiece>} args.iterator
 * @param {IteratorResult<API.CommitPiece> | undefined} args.pending
 * @param {Record<string, string> | undefined} args.datasetMetadata
 * @param {Set<string> | undefined} args.activeFailedRoots
 * @returns {{ commitPieces: API.CommitPiece[]; pending: IteratorResult<API.CommitPiece> | undefined }}
 */
function takeNextCommitBatch({
  iterator,
  pending,
  datasetMetadata,
  activeFailedRoots,
}) {
  /** @type {API.CommitPiece[]} */
  const commitPieces = []
  const batchMode = resolveBatchMode(datasetMetadata)
  let batchRootValuePaddedBytes = 0
  let next = pending
  let hasMore = true

  while (hasMore) {
    next = next ?? iterator.next()
    if (next.done) {
      return { commitPieces, pending: undefined }
    }

    const root = next.value.pieceMetadata[IPFS_ROOT_CID_KEY]
    if (activeFailedRoots?.has(root)) {
      next = undefined
      continue
    }

    if (batchMode.kind === 'extraData') {
      const rootValuePaddedBytes = paddedAbiStringBytes(root)

      // The first piece in a batch must bypass the byte check; otherwise an
      // oversized first piece would produce an empty batch and stall batching.
      const shouldApplyExtraDataLimit = commitPieces.length > 0
      const projectedSize = projectedCommitExtraDataBytes(
        commitPieces.length,
        batchRootValuePaddedBytes,
        rootValuePaddedBytes,
        batchMode.createDataSetOverheadBytes
      )

      if (
        shouldApplyExtraDataLimit &&
        projectedSize > MAX_COMMIT_EXTRADATA_BYTES
      ) {
        return { commitPieces, pending: next }
      }

      batchRootValuePaddedBytes += rootValuePaddedBytes
    }

    commitPieces.push(next.value)
    next = undefined

    if (
      batchMode.kind === 'count' &&
      commitPieces.length >= batchMode.countLimit
    ) {
      return { commitPieces, pending: undefined }
    }
  }

  return { commitPieces, pending: undefined }
}

/**
 * @param {Record<string, string> | undefined} datasetMetadata
 */
function resolveBatchMode(datasetMetadata) {
  const countLimit = datasetMetadata
    ? MAX_CREATE_DATASET_COMMIT_BATCH_PIECES
    : MAX_ADD_PIECES_COMMIT_BATCH_PIECES

  if (countLimit > 0) {
    return {
      kind: /** @type {'count'} */ ('count'),
      countLimit,
      createDataSetOverheadBytes: 0,
    }
  }

  if (MAX_COMMIT_EXTRADATA_BYTES > 0) {
    return {
      kind: /** @type {'extraData'} */ ('extraData'),
      countLimit: 0,
      createDataSetOverheadBytes:
        datasetMetadata != null
          ? createDataSetExtraDataBytes(datasetMetadata)
          : 0,
    }
  }

  return {
    kind: /** @type {'none'} */ ('none'),
    countLimit: 0,
    createDataSetOverheadBytes: 0,
  }
}

/**
 * @param {number} currentPieceCount
 * @param {number} currentBatchRootValuePaddedBytes
 * @param {number} nextRootValuePaddedBytes
 * @param {number} createDataSetOverheadBytes
 */
function projectedCommitExtraDataBytes(
  currentPieceCount,
  currentBatchRootValuePaddedBytes,
  nextRootValuePaddedBytes,
  createDataSetOverheadBytes
) {
  const addPiecesBytes = addPiecesExtraDataBytes(
    currentPieceCount + 1,
    currentBatchRootValuePaddedBytes + nextRootValuePaddedBytes
  )
  if (createDataSetOverheadBytes === 0) return addPiecesBytes

  return (
    CREATE_AND_ADD_WRAPPER_BYTES + createDataSetOverheadBytes + addPiecesBytes
  )
}

/**
 * ABI size for signAddPieces extraData when piece metadata is always:
 *   { ipfsRootCID: <CIDv1 base32> }
 *
 * @param {number} pieceCount
 * @param {number} rootValuePaddedBytes
 */
function addPiecesExtraDataBytes(pieceCount, rootValuePaddedBytes) {
  return (
    ADD_PIECES_BASE_BYTES +
    ADD_PIECE_FIXED_BYTES * pieceCount +
    rootValuePaddedBytes
  )
}

/**
 * @param {API.StorageContext} context
 * @param {API.CommitPiece[]} commitPieces
 * @returns {Promise<{ dataSetId: bigint, txHash: string, committed: API.CommittedEntry[] }>}
 */
async function attemptCommitBatch(context, commitPieces) {
  const extraData = await context.presignForCommit(commitPieces)
  const result = await context.commit({
    pieces: commitPieces,
    extraData,
  })

  return {
    dataSetId: result.dataSetId,
    txHash: result.txHash,
    committed: toCommittedEntries(commitPieces),
  }
}

/**
 * @param {API.BatchResult} result
 */
function getBatchPieceCount(result) {
  if (result.committed.length > 0) return result.committed.length
  if (result.commitPieces) return result.commitPieces.length
  return 0
}

/**
 * ABI size for signCreateDataSet extraData when dataset metadata is always:
 *   {
 *     source: 'storacha-migration',
 *     withIPFSIndexing: '',
 *     'space-did': <ed25519 did:key>,
 *     'space-name'?: <dynamic>
 *   }
 *
 * Only "space-name" changes the encoded size.
 *
 * @param {Record<string, string>} datasetMetadata
 */
function createDataSetExtraDataBytes(datasetMetadata) {
  const spaceName = datasetMetadata['space-name']
  if (!spaceName) return CREATE_DATASET_BASE_BYTES

  return (
    CREATE_DATASET_BASE_BYTES +
    CREATE_DATASET_SPACE_NAME_FIXED_BYTES +
    paddedAbiStringBytes(spaceName)
  )
}

/**
 * @param {string} value
 */
function paddedAbiStringBytes(value) {
  return roundUpToWord(STRING_ENCODER.encode(value).byteLength)
}

/**
 * @param {number} value
 */
function roundUpToWord(value) {
  return Math.ceil(value / 32) * 32
}

/**
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
    resolve('skip')
  } else {
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        resolve('skip')
      }
    }, timeoutMs)
    if (typeof timer === 'object' && 'unref' in timer) timer.unref()
    void promise.then(() => clearTimeout(timer))
  }

  return { promise, retry, skip }
}

/**
 * @param {API.CommitPiece[]} commitPieces
 * @returns {API.CommittedEntry[]}
 */
function toCommittedEntries(commitPieces) {
  return commitPieces.map((piece) => ({
    shardCid: piece.shardCid,
    pieceCID: String(piece.pieceCid),
    root: piece.pieceMetadata[IPFS_ROOT_CID_KEY],
  }))
}

import { CommitFailedFailure } from './errors.js'
import {
  MAX_ADD_PIECES_COMMIT_BATCH_PIECES,
  MAX_COMMIT_EXTRADATA_BYTES,
  MAX_CREATE_DATASET_COMMIT_BATCH_PIECES,
} from './constants.js'
import { recordCommit, recordFailedUpload } from './state.js'
import { toPieceCID } from './utils.js'

/**
 * @import * as API from './api.js'
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
 * Commit pieces sequentially in internal batches.
 *
 * Count mode takes precedence when its internal cap is greater than zero.
 * Otherwise the byte limit is used when configured. With both caps disabled,
 * all pieces are committed in one call.
 *
 * @param {object} args
 * @param {Iterable<API.CommitPiece>} args.commitPieceIterable
 * @param {API.StorageContext} args.context
 * @param {API.MigrationState} args.state
 * @param {API.SpaceDID} args.spaceDID
 * @param {number} args.copyIndex
 * @param {number} args.maxCommitRetries
 * @param {number} args.commitRetryTimeout
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
  activeFailedRoots,
}) {
  /** @type {IteratorResult<API.CommitPiece> | undefined} */
  let pending
  let datasetMetadata = context.dataSetId ? undefined : context.dataSetMetadata
  const iterator = commitPieceIterable[Symbol.iterator]()

  while (true) {
    const batch = takeNextCommitBatch({
      iterator,
      pending,
      datasetMetadata,
      activeFailedRoots,
    })
    pending = batch.pending

    if (batch.commitPieces.length === 0) break

    const result = await commitPreparedBatch({
      context,
      commitPieces: batch.commitPieces,
    })

    yield* handleCommitBatchResult({
      result,
      context,
      state,
      spaceDID,
      copyIndex,
      maxCommitRetries,
      commitRetryTimeout,
    })

    if (activeFailedRoots && result.failedUploads.size > 0) {
      for (const root of result.failedUploads) {
        activeFailedRoots.add(root)
      }
    }

    if (result.dataSetId !== undefined) {
      datasetMetadata = undefined
    }
  }
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
 * @param {object} args
 * @param {API.BatchResult} args.result
 * @param {API.StorageContext} args.context
 * @param {API.MigrationState} args.state
 * @param {API.SpaceDID} args.spaceDID
 * @param {number} args.copyIndex
 * @param {number} args.maxCommitRetries
 * @param {number} args.commitRetryTimeout
 * @returns {AsyncGenerator<API.MigrationEvent>}
 */
async function* handleCommitBatchResult({
  result,
  context,
  state,
  spaceDID,
  copyIndex,
  maxCommitRetries,
  commitRetryTimeout,
}) {
  if (
    result.stage === 'commit' &&
    result.commitPieces &&
    maxCommitRetries > 0
  ) {
    yield* retryCommitInteractively(
      result,
      context,
      spaceDID,
      copyIndex,
      maxCommitRetries,
      commitRetryTimeout
    )
  }

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

  if (result.committed.length > 0 && result.dataSetId !== undefined) {
    for (const entry of result.committed) {
      recordCommit(state, spaceDID, copyIndex, entry.shardCid, result.dataSetId)
    }

    yield /** @type {API.MigrationEvent} */ ({
      type: 'state:checkpoint',
      state,
    })
  }
}

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
 * @param {number} maxRetries
 * @param {number} retryTimeout
 * @returns {AsyncGenerator<API.MigrationEvent>}
 */
async function* retryCommitInteractively(
  result,
  context,
  spaceDID,
  copyIndex,
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
      copyIndex,
      error: /** @type {Error} */ (result.error),
      roots: [...result.failedUploads],
      attempt,
      retry: decision.retry,
      skip: decision.skip,
    })

    const choice = await decision.promise
    if (choice !== 'retry') break

    try {
      const commitResult = await attemptCommitBatch(context, piecesToRetry)

      result.dataSetId = commitResult.dataSetId
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

  while (true) {
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

      if (shouldApplyExtraDataLimit && projectedSize > MAX_COMMIT_EXTRADATA_BYTES) {
        return { commitPieces, pending: next }
      }

      batchRootValuePaddedBytes += rootValuePaddedBytes
    }

    commitPieces.push(next.value)
    next = undefined

    if (batchMode.kind === 'count' && commitPieces.length >= batchMode.countLimit) {
      return { commitPieces, pending: undefined }
    }
  }
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

  return CREATE_AND_ADD_WRAPPER_BYTES + createDataSetOverheadBytes + addPiecesBytes
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
 * @returns {Promise<{ dataSetId: bigint, committed: API.CommittedEntry[] }>}
 */
async function attemptCommitBatch(context, commitPieces) {
  const extraData = await context.presignForCommit(commitPieces)
  const result = await context.commit({
    pieces: commitPieces,
    extraData,
  })

  return {
    dataSetId: result.dataSetId,
    committed: toCommittedEntries(commitPieces),
  }
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

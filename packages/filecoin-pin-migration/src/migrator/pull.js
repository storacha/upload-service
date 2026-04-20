import pRetry from 'p-retry'
import { PresignFailedFailure, PullFailedFailure } from '../errors.js'
import { DEFAULT_PULL_RETRIES } from '../constants.js'
import { toPieceCID } from '../utils.js'

/**
 * Shared presign + pull flow for both source-URL and store-to-store pulls.
 *
 * Returns the original batch entries for successful pulls so callers can keep
 * their existing post-processing logic.
 *
 * @template T
 * @param {object} args
 * @param {T[]} args.batch
 * @param {import('../api.js').StorageContext} args.context
 * @param {(entry: T) => string} args.getPieceCID
 * @param {(entry: T) => string} args.getRoot
 * @param {(entry: T, pieceCid: import('../api.js').PieceCID) => string} args.getSourceURL
 * @param {AbortSignal | undefined} args.signal
 * @returns {Promise<import('../api.js').PullResult<T>>}
 */
export async function presignAndPullBatch({
  batch,
  context,
  getPieceCID,
  getRoot,
  getSourceURL,
  signal,
}) {
  /** @type {import('../api.js').PieceCID[]} */
  const pieces = []
  /** @type {Array<{ pieceCid: import('../api.js').PieceCID; pieceMetadata: { ipfsRootCID: string } }>} */
  const presignPayload = []
  const allRoots = new Set()
  const pieceToEntry = new Map()

  /**
   * @param {'presign' | 'pull'} stage
   * @param {unknown} error
   * @returns {{ pulledCandidates: T[], failedUploads: Set<string>, failureKind: 'operational', stage: import('../api.js').MigratorPhase, error: Error }}
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

  for (const entry of batch) {
    const pieceCID = getPieceCID(entry)
    const pieceCid = toPieceCID(pieceCID)
    const root = getRoot(entry)
    pieces.push(pieceCid)
    presignPayload.push({
      pieceCid,
      pieceMetadata: { ipfsRootCID: root },
    })
    pieceToEntry.set(pieceCID, entry)
    allRoots.add(root)
  }

  let extraData
  try {
    extraData = await context.presignForCommit(presignPayload)
  } catch (error) {
    return toOperationalFailure('presign', error)
  }

  let pullResult
  try {
    pullResult = await pRetry(
      () =>
        context.pull({
          pieces,
          from: (pieceCid) => {
            const entry = pieceToEntry.get(String(pieceCid))
            if (!entry) throw new Error(`No entry for pieceCID ${pieceCid}`)
            return getSourceURL(entry, pieceCid)
          },
          extraData,
          signal,
        }),
      { retries: DEFAULT_PULL_RETRIES, signal }
    )
  } catch (error) {
    return toOperationalFailure('pull', error)
  }

  /** @type {T[]} */
  const pulledCandidates = []
  const failedUploadsInBatch = new Set()

  for (const piece of pullResult.pieces) {
    const entry = pieceToEntry.get(String(piece.pieceCid))
    if (!entry) continue

    if (piece.status === 'complete') {
      pulledCandidates.push(entry)
    } else {
      failedUploadsInBatch.add(getRoot(entry))
    }
  }

  const pulledCandidatesFiltered =
    failedUploadsInBatch.size === 0
      ? pulledCandidates
      : pulledCandidates.filter(
          (entry) => !failedUploadsInBatch.has(getRoot(entry))
        )

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

  return baseResult
}

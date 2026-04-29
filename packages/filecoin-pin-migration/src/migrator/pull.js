import { PresignFailedFailure, PullFailedFailure } from '../errors.js'
import {
  DEFAULT_PULL_DIAGNOSTIC_SAMPLE_SIZE,
  DEFAULT_PULL_RETRIES,
} from '../constants.js'
import { isAbortError, toPieceCID } from '../utils.js'
import {
  copyOptionalErrorFlags,
  shouldRetryTransientOperationError,
} from './retry-policy.js'
import { extractRetryDiagnostics, runRetried } from './retried-operation.js'

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
 * @param {'source-pull' | 'secondary-pull'} args.phase
 * @param {AbortSignal | undefined} args.signal
 * @returns {Promise<import('../api.js').PullResult<T>>}
 */
export async function presignAndPullBatch({
  batch,
  context,
  getPieceCID,
  getRoot,
  getSourceURL,
  phase,
  signal,
}) {
  const payload = buildPullPayload(batch, getPieceCID, getRoot)
  const presignResult = await runPresign({
    context,
    presignPayload: payload.presignPayload,
    allRoots: payload.allRoots,
    phase,
    signal,
  })
  if (presignResult.failure) return presignResult.failure

  const pullResult = await runPullWithRetries({
    context,
    payload,
    extraData: presignResult.extraData,
    getRoot,
    getSourceURL,
    phase,
    signal,
  })
  if (pullResult.failure) return pullResult.failure

  return reconcilePullResult({
    pullResult: pullResult.value,
    pieceToEntry: payload.pieceToEntry,
    getRoot,
    phase,
  })
}

/**
 * @template T
 * @param {T[]} batch
 * @param {(entry: T) => string} getPieceCID
 * @param {(entry: T) => string} getRoot
 */
function buildPullPayload(batch, getPieceCID, getRoot) {
  /** @type {import('../api.js').PieceCID[]} */
  const pieces = []
  /** @type {Array<{ pieceCid: import('../api.js').PieceCID; pieceMetadata: { ipfsRootCID: string } }>} */
  const presignPayload = []
  const allRoots = new Set()
  const pieceToEntry = new Map()

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

  return { pieces, presignPayload, allRoots, pieceToEntry }
}

/**
 * @param {object} args
 * @param {import('../api.js').StorageContext} args.context
 * @param {Array<{ pieceCid: import('../api.js').PieceCID; pieceMetadata: { ipfsRootCID: string } }>} args.presignPayload
 * @param {Set<string>} args.allRoots
 * @param {import('../api.js').MigrationExecutionPhase} args.phase
 * @param {AbortSignal | undefined} args.signal
 * @returns {Promise<
 *   | { extraData: Awaited<ReturnType<import('../api.js').StorageContext['presignForCommit']>>, failure?: undefined }
 *   | { failure: import('../api.js').PullResult<never>, extraData?: undefined }
 * >}
 */
async function runPresign({
  context,
  presignPayload,
  allRoots,
  phase,
  signal,
}) {
  try {
    return {
      extraData: await context.presignForCommit(presignPayload),
    }
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) {
      throw error
    }

    return {
      failure: toPullOperationalFailure(
        allRoots,
        phase,
        new PresignFailedFailure(
          error instanceof Error ? error.message : String(error)
        )
      ),
    }
  }
}

/**
 * @template T
 * @param {object} args
 * @param {import('../api.js').StorageContext} args.context
 * @param {{ pieces: import('../api.js').PieceCID[], presignPayload: Array<{ pieceCid: import('../api.js').PieceCID; pieceMetadata: { ipfsRootCID: string } }>, allRoots: Set<string>, pieceToEntry: Map<string, T> }} args.payload
 * @param {Awaited<ReturnType<import('../api.js').StorageContext['presignForCommit']>>} args.extraData
 * @param {(entry: T) => string} args.getRoot
 * @param {(entry: T, pieceCid: import('../api.js').PieceCID) => string} args.getSourceURL
 * @param {import('../api.js').MigrationExecutionPhase} args.phase
 * @param {AbortSignal | undefined} args.signal
 * @returns {Promise<
 *   | { value: Awaited<ReturnType<import('../api.js').StorageContext['pull']>>, failure?: undefined }
 *   | { failure: import('../api.js').PullResult<T>, value?: undefined }
 * >}
 */
async function runPullWithRetries({
  context,
  payload,
  extraData,
  getRoot,
  getSourceURL,
  phase,
  signal,
}) {
  try {
    return {
      value: await runRetried({
        retries: DEFAULT_PULL_RETRIES,
        signal,
        shouldRetry: shouldRetryTransientOperationError,
        attempt: async () =>
          context.pull({
            pieces: payload.pieces,
            from: (pieceCid) => {
              const entry = payload.pieceToEntry.get(String(pieceCid))
              if (!entry) throw new Error(`No entry for pieceCID ${pieceCid}`)
              return getSourceURL(entry, pieceCid)
            },
            extraData,
            signal,
          }),
      }),
    }
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) {
      throw error
    }

    return {
      failure: toPullOperationalFailure(
        payload.allRoots,
        phase,
        createPullDiagnosticError({
          error,
          payload,
          getRoot,
          getSourceURL,
          phase,
        })
      ),
    }
  }
}

/**
 * @template T
 * @param {object} args
 * @param {{ pieces: Array<{ pieceCid: import('../api.js').PieceCID; status: string }> }} args.pullResult
 * @param {Map<string, T>} args.pieceToEntry
 * @param {(entry: T) => string} args.getRoot
 * @param {import('../api.js').MigrationExecutionPhase} args.phase
 * @returns {import('../api.js').PullResult<T>}
 */
function reconcilePullResult({ pullResult, pieceToEntry, getRoot, phase }) {
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
      stage: phase,
      error: new PullFailedFailure('All pieces in batch failed to pull'),
    }
  }

  if (failedUploadsInBatch.size > 0) {
    return {
      ...baseResult,
      failureKind: 'upload',
      stage: phase,
      error: new PullFailedFailure(
        `${failedUploadsInBatch.size} upload(s) had pieces that failed to pull`
      ),
    }
  }

  return baseResult
}

/**
 * @param {Set<string>} allRoots
 * @param {import('../api.js').MigrationExecutionPhase} phase
 * @param {Error} error
 * @returns {import('../api.js').PullResult<never>}
 */
function toPullOperationalFailure(allRoots, phase, error) {
  return {
    pulledCandidates: [],
    failedUploads: allRoots,
    failureKind: 'operational',
    stage: phase,
    error,
  }
}

/**
 * @template T
 * @param {object} args
 * @param {unknown} args.error
 * @param {{ pieces: import('../api.js').PieceCID[], presignPayload: Array<{ pieceCid: import('../api.js').PieceCID; pieceMetadata: { ipfsRootCID: string } }>, allRoots: Set<string>, pieceToEntry: Map<string, T> }} args.payload
 * @param {(entry: T) => string} args.getRoot
 * @param {(entry: T, pieceCid: import('../api.js').PieceCID) => string} args.getSourceURL
 * @param {import('../api.js').MigrationExecutionPhase} args.phase
 * @returns {Error}
 */
function createPullDiagnosticError({
  error,
  payload,
  phase,
  getRoot,
  getSourceURL,
}) {
  const { baseError, attempts, retriesConfigured, elapsedMs } =
    extractRetryDiagnostics(error, DEFAULT_PULL_RETRIES)
  const samples = buildPullSamples({
    payload,
    getRoot,
    getSourceURL,
  })
  const message = getPullErrorMessage(baseError)

  /** @type {import('../api.js').PullDiagnosticError} */
  const diagnosticError =
    /** @type {import('../api.js').PullDiagnosticError} */ (
      /** @type {unknown} */ (
        new PullFailedFailure(
          `${message} (phase=${phase}, failureStep=pull, pieceCount=${payload.pieces.length}, rootCount=${payload.allRoots.size}, attempts=${attempts}, retriesConfigured=${retriesConfigured}, elapsedMs=${elapsedMs})`
        )
      )
    )

  diagnosticError.cause = baseError
  diagnosticError.phase = phase
  diagnosticError.failureStep = 'pull'
  diagnosticError.pieceCount = payload.pieces.length
  diagnosticError.rootCount = payload.allRoots.size
  diagnosticError.rootsSample = samples.rootsSample
  diagnosticError.pieceCIDsSample = samples.pieceCIDsSample
  diagnosticError.sourceURLsSample = samples.sourceURLsSample
  diagnosticError.attempts = attempts
  diagnosticError.retriesConfigured = retriesConfigured
  diagnosticError.elapsedMs = elapsedMs
  copyOptionalErrorFlags(diagnosticError, baseError)

  return diagnosticError
}

/**
 * @template T
 * @param {object} args
 * @param {{ presignPayload: Array<{ pieceCid: import('../api.js').PieceCID; pieceMetadata: { ipfsRootCID: string } }>, pieceToEntry: Map<string, T> }} args.payload
 * @param {(entry: T) => string} args.getRoot
 * @param {(entry: T, pieceCid: import('../api.js').PieceCID) => string} args.getSourceURL
 */
function buildPullSamples({ payload, getRoot, getSourceURL }) {
  /** @type {string[]} */
  const rootsSample = []
  /** @type {string[]} */
  const pieceCIDsSample = []
  /** @type {string[]} */
  const sourceURLsSample = []

  for (const { pieceCid } of payload.presignPayload.slice(
    0,
    DEFAULT_PULL_DIAGNOSTIC_SAMPLE_SIZE
  )) {
    const pieceCID = String(pieceCid)
    const entry = payload.pieceToEntry.get(pieceCID)
    if (!entry) continue

    pieceCIDsSample.push(pieceCID)
    rootsSample.push(getRoot(entry))
    try {
      sourceURLsSample.push(getSourceURL(entry, pieceCid))
    } catch {
      sourceURLsSample.push('<unavailable>')
    }
  }

  return { rootsSample, pieceCIDsSample, sourceURLsSample }
}

/**
 * @param {unknown} error
 */
function getPullErrorMessage(error) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

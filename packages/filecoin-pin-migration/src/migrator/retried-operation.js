import {
  DEFAULT_RETRY_BACKOFF_FACTOR,
  DEFAULT_RETRY_MAX_TIMEOUT,
  DEFAULT_RETRY_MIN_TIMEOUT,
  DEFAULT_RETRY_RANDOMIZE,
} from '../constants.js'
import { isAbortError } from '../utils.js'

class RetriedOperationError extends Error {
  /**
   * @param {unknown} lastError
   * @param {object} details
   * @param {number} details.attempts
   * @param {number} details.retriesConfigured
   * @param {number} details.elapsedMs
   */
  constructor(lastError, { attempts, retriesConfigured, elapsedMs }) {
    super(lastError instanceof Error ? lastError.message : String(lastError))
    this.name = 'RetriedOperationError'
    this.cause = lastError
    /** @type {unknown} */
    this.lastError = lastError
    /** @type {number} */
    this.attempts = attempts
    /** @type {number} */
    this.retriesConfigured = retriesConfigured
    /** @type {number} */
    this.elapsedMs = elapsedMs
  }
}

/**
 * Retry helper used by migrator operations that must preserve a settled
 * success even if the outer run aborts concurrently. Abort is honored before
 * a new attempt starts and during backoff, but a completed attempt result is
 * never replaced by a later abort signal.
 *
 * Do not replace this with `p-retry` plus its `signal` option. That wiring can
 * race a concurrent abort against an already-settled attempt result, which is
 * exactly the invariant this helper exists to avoid.
 *
 * @template TResult
 * @param {object} args
 * @param {number} args.retries
 * @param {AbortSignal | undefined} args.signal
 * @param {(error: unknown) => boolean | Promise<boolean>} args.shouldRetry
 * @param {(attemptNumber: number) => Promise<TResult>} args.attempt
 * @returns {Promise<TResult>}
 */
export async function runRetried({ retries, signal, shouldRetry, attempt }) {
  const startedAt = Date.now()

  for (let attemptNumber = 1; ; attemptNumber += 1) {
    throwIfAborted(signal)

    try {
      return await attempt(attemptNumber)
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) {
        throw error
      }

      const attempts = attemptNumber
      const exhausted = attempts > retries
      const retryable = !exhausted && (await shouldRetry(error))

      if (!retryable) {
        throw new RetriedOperationError(error, {
          attempts,
          retriesConfigured: retries,
          elapsedMs: Date.now() - startedAt,
        })
      }

      await sleep(getBackoffDelay(attemptNumber), signal)
    }
  }
}

/**
 * @param {unknown} error
 * @returns {error is {
 *   lastError: unknown
 *   attempts: number
 *   retriesConfigured: number
 *   elapsedMs: number
 * }}
 */
export function isRetriedOperationError(error) {
  return error instanceof RetriedOperationError
}

/**
 * @param {unknown} error
 * @param {number} retriesConfigured
 */
export function extractRetryDiagnostics(error, retriesConfigured) {
  if (isRetriedOperationError(error)) {
    return {
      baseError: error.lastError,
      attempts: error.attempts,
      retriesConfigured: error.retriesConfigured,
      elapsedMs: error.elapsedMs,
    }
  }

  return {
    baseError: error,
    attempts: 1,
    retriesConfigured,
    elapsedMs: 0,
  }
}

/**
 * @param {number} attemptNumber
 */
function getBackoffDelay(attemptNumber) {
  const exponentialDelay =
    DEFAULT_RETRY_MIN_TIMEOUT *
    Math.pow(DEFAULT_RETRY_BACKOFF_FACTOR, attemptNumber - 1)
  const randomizedDelay = DEFAULT_RETRY_RANDOMIZE
    ? exponentialDelay * Math.random()
    : exponentialDelay

  return Math.min(DEFAULT_RETRY_MAX_TIMEOUT, Math.round(randomizedDelay))
}

/**
 * @param {number} delayMs
 * @param {AbortSignal | undefined} signal
 */
async function sleep(delayMs, signal) {
  throwIfAborted(signal)

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve(undefined)
    }, delayMs)

    function onAbort() {
      clearTimeout(timeout)
      // Needed when we invoke onAbort() manually after attaching to an already-
      // aborted signal; { once: true } only handles the real event path.
      signal?.removeEventListener('abort', onAbort)
      reject(getAbortReason(signal))
    }

    signal?.addEventListener('abort', onAbort, { once: true })
    if (signal?.aborted) onAbort()
  })
}

/**
 * @param {AbortSignal | undefined} signal
 */
function throwIfAborted(signal) {
  if (!signal?.aborted) return
  throw getAbortReason(signal)
}

/**
 * @param {AbortSignal | undefined} signal
 */
function getAbortReason(signal) {
  const reason = signal?.reason
  if (reason instanceof Error) {
    return reason
  }

  const abortError = new Error('This operation was aborted')
  abortError.name = 'AbortError'
  return abortError
}

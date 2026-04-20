import { isAbortError } from '../utils.js'

export class RetryableStoreError extends Error {
  /**
   * @param {string} message
   * @param {boolean} retryable
   * @param {number | undefined} [status]
   */
  constructor(message, retryable, status) {
    super(message)
    this.name = 'RetryableStoreError'
    /** @type {boolean} */
    this.retryable = retryable
    /** @type {number | undefined} */
    this.status = status
  }
}

/**
 * @param {string} message
 * @param {boolean} retryable
 * @param {number} [status]
 */
export function createRetryableError(message, retryable, status) {
  return new RetryableStoreError(message, retryable, status)
}

/**
 * @param {unknown} error
 */
export function shouldRetryFetchError(error) {
  if (isAbortError(error)) return false

  const retryable = getRetryableFlag(error)
  if (retryable != null) return retryable

  const status = getErrorStatus(error)
  if (status != null) return isRetryableHttpStatus(status)

  return true
}

/**
 * @param {unknown} error
 */
export function shouldRetryStoreOperationError(error) {
  if (!shouldRetryFetchError(error)) return false

  const status = getErrorStatus(error)
  if (status != null) return isRetryableHttpStatus(status)

  const message = getErrorMessage(error).toLowerCase()
  return (
    /timeout|timed out|econnreset|econnrefused|socket hang up|connection reset|temporary|temporarily|network|unavailable|429|500|502|503|504|too many requests|fetch failed|stream/i.test(
      message
    ) || getRetryableFlag(error) === true
  )
}

/**
 * @param {number} status
 */
export function isRetryableHttpStatus(status) {
  return status === 408 || status === 429 || status >= 500
}

/**
 * @param {unknown} error
 */
function getRetryableFlag(error) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'retryable' in error &&
    typeof error.retryable === 'boolean'
  ) {
    return error.retryable
  }
}

/**
 * @param {unknown} error
 */
function getErrorStatus(error) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number'
  ) {
    return error.status
  }
}

/**
 * @param {unknown} error
 */
function getErrorMessage(error) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message
  }

  return String(error)
}

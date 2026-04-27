import {
  DEFAULT_COMMIT_CONCURRENCY,
  DEFAULT_MAX_COMMIT_RETRIES,
  DEFAULT_COMMIT_RETRY_TIMEOUT,
  DEFAULT_PULL_BATCH_SIZE,
  DEFAULT_PULL_CONCURRENCY,
  DEFAULT_STORE_CONCURRENCY,
} from '../constants.js'

/**
 * Resolve the normalized execution config shared by both public migrator
 * entrypoints.
 *
 * The fetcher is only required when the caller passes a validation message.
 * This keeps source-pull-only migrations working in environments without
 * `globalThis.fetch`.
 *
 * @param {object} input
 * @param {number | undefined} input.batchSize
 * @param {number | undefined} input.maxCommitRetries
 * @param {number | undefined} input.commitRetryTimeout
 * @param {number | undefined} input.pullConcurrency
 * @param {number | undefined} input.storeConcurrency
 * @param {number | undefined} input.commitConcurrency
 * @param {typeof fetch | undefined} input.fetcher
 * @param {AbortSignal | undefined} input.signal
 * @param {string | undefined} input.fetcherErrorMessage
 */
export function createExecutionConfig({
  batchSize,
  maxCommitRetries,
  commitRetryTimeout,
  pullConcurrency,
  storeConcurrency,
  commitConcurrency,
  fetcher,
  signal,
  fetcherErrorMessage,
}) {
  const resolvedFetcher = fetcher ?? globalThis.fetch

  if (fetcherErrorMessage && typeof resolvedFetcher !== 'function') {
    throw new TypeError(fetcherErrorMessage)
  }

  return {
    fetcher: /** @type {typeof fetch | undefined} */ (resolvedFetcher),
    batchSize: batchSize ?? DEFAULT_PULL_BATCH_SIZE,
    maxCommitRetries: maxCommitRetries ?? DEFAULT_MAX_COMMIT_RETRIES,
    commitRetryTimeout: commitRetryTimeout ?? DEFAULT_COMMIT_RETRY_TIMEOUT,
    pullConcurrency: pullConcurrency ?? DEFAULT_PULL_CONCURRENCY,
    storeConcurrency: storeConcurrency ?? DEFAULT_STORE_CONCURRENCY,
    commitConcurrency: commitConcurrency ?? DEFAULT_COMMIT_CONCURRENCY,
    signal,
  }
}

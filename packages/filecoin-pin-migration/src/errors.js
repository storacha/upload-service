import * as Server from '@ucanto/server'

export const MissingPieceCIDFailureName = /** @type {const} */ (
  'MissingPieceCID'
)
export class MissingPieceCIDFailure extends Server.Failure {
  get reason() {
    return this.message
  }
  get name() {
    return MissingPieceCIDFailureName
  }
  describe() {
    return `Missing piece CID: ${this.message}`
  }
}

export const InsufficientFundsFailureName = /** @type {const} */ (
  'InsufficientFunds'
)
export class InsufficientFundsFailure extends Server.Failure {
  get reason() {
    return this.message
  }
  get name() {
    return InsufficientFundsFailureName
  }
  describe() {
    return `Insufficient USDFC funds: ${this.message}`
  }
}

export const PresignFailedFailureName = /** @type {const} */ ('PresignFailed')
export class PresignFailedFailure extends Server.Failure {
  get reason() {
    return this.message
  }
  get name() {
    return PresignFailedFailureName
  }
  describe() {
    return `EIP-712 pre-sign failed: ${this.message}`
  }
}

export const PullFailedFailureName = /** @type {const} */ ('PullFailed')
export class PullFailedFailure extends Server.Failure {
  get reason() {
    return this.message
  }
  get name() {
    return PullFailedFailureName
  }
  describe() {
    return `SP pull failed: ${this.message}`
  }
}

export const CommitFailedFailureName = /** @type {const} */ ('CommitFailed')
export class CommitFailedFailure extends Server.Failure {
  get reason() {
    return this.message
  }
  get name() {
    return CommitFailedFailureName
  }
  describe() {
    return `Commit failed: ${this.message}`
  }
}

export const MissingLocationURLFailureName = /** @type {const} */ (
  'MissingLocationURL'
)
export class MissingLocationURLFailure extends Server.Failure {
  get reason() {
    return this.message
  }
  get name() {
    return MissingLocationURLFailureName
  }
  describe() {
    return `Missing location URL: ${this.message}`
  }
}

export const FundingFailedFailureName = /** @type {const} */ ('FundingFailed')
export class FundingFailedFailure extends Server.Failure {
  get reason() {
    return this.message
  }
  get name() {
    return FundingFailedFailureName
  }
  describe() {
    return `Funding failed: ${this.message}`
  }
}

export const IncompatibleStateVersionErrorName = /** @type {const} */ (
  'IncompatibleStateVersionError'
)
export class IncompatibleStateVersionError extends Error {
  get name() {
    return IncompatibleStateVersionErrorName
  }
}

export const ResumeBindingDriftErrorName = /** @type {const} */ (
  'ResumeBindingDriftError'
)
export class ResumeBindingDriftError extends Error {
  get name() {
    return ResumeBindingDriftErrorName
  }
}

export const StoreClosedErrorName = /** @type {const} */ ('StoreClosedError')
/**
 * Thrown when a {@link import('./api.js').MigrationStore} method is called
 * after `close()` / `closeSync()` has begun (lifecycle outside `'open'`).
 *
 * This is a programmer / lifecycle invariant violation, not a domain failure —
 * it does not flow through `Result<T,X>` and is not a `@ucanto/server` Failure.
 */
export class StoreClosedError extends Error {
  /** @param {string} method */
  constructor(method) {
    super(`MigrationStore has been closed; cannot call ${method}()`)
  }
  get name() {
    return StoreClosedErrorName
  }
}

/**
 * Abort is cooperative control flow, not a migration failure.
 *
 * @param {unknown} error
 * @param {AbortSignal | undefined} [signal]
 * @returns {boolean}
 */
export function isAbortError(error, signal) {
  return (
    signal?.aborted === true ||
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

/**
 * @param {AbortSignal | undefined} signal
 */
export function throwIfAborted(signal) {
  if (!signal?.aborted) return
  throw new DOMException('The operation was aborted.', 'AbortError')
}

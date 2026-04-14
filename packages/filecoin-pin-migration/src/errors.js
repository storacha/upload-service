import * as Server from '@ucanto/server'

export const MissingPieceCIDFailureName = /** @type {const} */ ('MissingPieceCID')
export class MissingPieceCIDFailure extends Server.Failure {
  get reason() { return this.message }
  get name() { return MissingPieceCIDFailureName }
  describe() { return `Missing piece CID: ${this.message}` }
}

export const InsufficientFundsFailureName = /** @type {const} */ ('InsufficientFunds')
export class InsufficientFundsFailure extends Server.Failure {
  get reason() { return this.message }
  get name() { return InsufficientFundsFailureName }
  describe() { return `Insufficient USDFC funds: ${this.message}` }
}

export const PresignFailedFailureName = /** @type {const} */ ('PresignFailed')
export class PresignFailedFailure extends Server.Failure {
  get reason() { return this.message }
  get name() { return PresignFailedFailureName }
  describe() { return `EIP-712 pre-sign failed: ${this.message}` }
}

export const PullFailedFailureName = /** @type {const} */ ('PullFailed')
export class PullFailedFailure extends Server.Failure {
  get reason() { return this.message }
  get name() { return PullFailedFailureName }
  describe() { return `SP pull failed: ${this.message}` }
}

export const CommitFailedFailureName = /** @type {const} */ ('CommitFailed')
export class CommitFailedFailure extends Server.Failure {
  get reason() { return this.message }
  get name() { return CommitFailedFailureName }
  describe() { return `Commit failed: ${this.message}` }
}

export const MissingLocationURLFailureName = /** @type {const} */ ('MissingLocationURL')
export class MissingLocationURLFailure extends Server.Failure {
  get reason() { return this.message }
  get name() { return MissingLocationURLFailureName }
  describe() { return `Missing location URL: ${this.message}` }
}

export const FundingFailedFailureName = /** @type {const} */ ('FundingFailed')
export class FundingFailedFailure extends Server.Failure {
  get reason() { return this.message }
  get name() { return FundingFailedFailureName }
  describe() { return `Funding failed: ${this.message}` }
}


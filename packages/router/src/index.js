import { Failure } from '@ucanto/core'

export * from './types.js'

export class CandidateUnavailableError extends Failure {
  static name = /** @type {const} */ ('CandidateUnavailable')

  get name() {
    return CandidateUnavailableError.name
  }

  /** @param {string} [reason] */
  constructor(reason) {
    super()
    this.reason = reason
  }

  describe() {
    return this.reason ?? 'no candidates available for blob allocation'
  }
}

export class ProofUnavailableError extends Failure {
  static name = 'ProofUnavailable'

  get name() {
    return ProofUnavailableError.name
  }

  /** @param {string} [reason] */
  constructor(reason) {
    super()
    this.reason = reason
  }

  describe() {
    return this.reason ?? 'proof unavailable'
  }
}

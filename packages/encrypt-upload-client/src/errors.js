import { Failure } from '@ucanto/core'

export class UnknownFormat extends Failure {
  #reason

  /** @param {string} [reason] */
  constructor(reason) {
    super()
    this.name = /** @type {const} */ ('UnknownFormat')
    this.#reason = reason
  }

  describe() {
    return this.#reason ?? 'unknown format'
  }
}

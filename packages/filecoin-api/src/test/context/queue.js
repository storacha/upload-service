import * as API from '../../types.js'

import { QueueOperationFailed } from '../../errors.js'

/**
 * @template T
 * @implements {API.Queue<T>}
 */
export class Queue {
  /**
   * @param {object} [options]
   * @param {(message: T) => void} [options.onMessage]
   */
  constructor(options = {}) {
    /** @type {Set<T>} */
    this.items = new Set()

    this.onMessage = options.onMessage || (() => {})
  }

  /**
   * @param {T} record
   */
  async add(record) {
    this.items.add(record)

    this.onMessage(record)
    return Promise.resolve({
      ok: {},
    })
  }
}

/**
 * @template T
 * @implements {API.Queue<T>}
 */
export class FailingQueue {
  /**
   * @param {T} record
   */
  async add(record) {
    return Promise.resolve({
      error: new QueueOperationFailed('failed to add to queue'),
    })
  }
}

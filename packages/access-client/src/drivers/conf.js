import Conf from 'conf'
import * as JSON from '../utils/json.js'

/**
 * @template T
 * @typedef {import('./types.js').Driver<T>} Driver
 */

/**
 * Driver implementation with "[conf](https://github.com/sindresorhus/conf)"
 *
 * Usage:
 *
 * ```js
 * import { ConfDriver } from '@storacha/access/drivers/conf'
 * ```
 *
 * @template {Record<string, any>} T
 * @implements {Driver<T>}
 */
export class ConfDriver {
  /**
   * @type {Conf<T>}
   */
  #config

  /**
   * @param {{ profile: string }} opts
   */
  constructor(opts) {
    this.#config = new Conf({
      projectName: 'w3access',
      projectSuffix: '',
      configName: opts.profile,
      serialize: (v) => JSON.stringify(v),
      deserialize: (v) => JSON.parse(v),
    })
    this.path = this.#config.path
  }

  async open() {}

  async close() {}

  async reset() {
    this.#config.clear()
  }

  /** @param {T} data */
  async save(data) {
    if (containsNonExtractableEd25519CryptoKey(data)) {
      throw new TypeError(
        'Conf store cannot persist CryptoKey values. Use an extractable signer for Node/Conf storage.'
      )
    }

    if (typeof data === 'object') {
      data = { ...data }
      for (const [k, v] of Object.entries(data)) {
        if (v === undefined) {
          delete data[k]
        }
      }
    }
    this.#config.set(data)
  }

  /** @returns {Promise<T|undefined>} */
  async load() {
    const data = this.#config.store ?? {}
    if (Object.keys(data).length === 0) return
    return data
  }
}

/**
 * @param {unknown} value
 * @param {Set<object>} [seen]
 * @returns {boolean}
 */
const containsNonExtractableEd25519CryptoKey = (value, seen = new Set()) => {
  if (!value || typeof value !== 'object') {
    return false
  }
  if (seen.has(value)) {
    return false
  }
  seen.add(value)
  const key = /** @type {any} */ (value)

  if (
    ((typeof CryptoKey !== 'undefined' && value instanceof CryptoKey) ||
      (typeof key.type === 'string' &&
        key.algorithm &&
        typeof key.algorithm.name === 'string' &&
        Array.isArray(key.usages) &&
        typeof key.extractable === 'boolean')) &&
    key.algorithm &&
    key.algorithm.name === 'Ed25519' &&
    key.extractable === false
  ) {
    return true
  }

  if (Array.isArray(value)) {
    return value.some((item) =>
      containsNonExtractableEd25519CryptoKey(item, seen)
    )
  }

  if (value instanceof Map) {
    for (const [key, item] of value) {
      if (
        containsNonExtractableEd25519CryptoKey(key, seen) ||
        containsNonExtractableEd25519CryptoKey(item, seen)
      ) {
        return true
      }
    }
    return false
  }

  for (const item of Object.values(value)) {
    if (containsNonExtractableEd25519CryptoKey(item, seen)) {
      return true
    }
  }

  return false
}

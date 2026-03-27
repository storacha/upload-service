import { ConfDriver } from '../drivers/conf.js'

/**
 * Store implementation with "[conf](https://github.com/sindresorhus/conf)"
 *
 * Usage:
 *
 * ```js
 * import { StoreConf } from '@storacha/access/stores/store-conf'
 * ```
 *
 * @extends {ConfDriver<import('../types.js').AgentDataExport>}
 */
export class StoreConf extends ConfDriver {
  /** @param {import('../types.js').AgentDataExport} data */
  async save(data) {
    if (hasCryptoKeyPrincipalKey(data)) {
      throw new TypeError(
        'Conf store cannot persist CryptoKey values. Use an extractable signer for Node/Conf storage.'
      )
    }
    return await super.save(data)
  }
}

/**
 * Conf storage can only persist serialized principal keys (bytes), not native CryptoKey objects.
 *
 * @param {import('../types.js').AgentDataExport} data
 */
const hasCryptoKeyPrincipalKey = (data) => {
  const keys = data?.principal?.keys
  if (!keys || typeof keys !== 'object') return false

  for (const keyValue of Object.values(keys)) {
    if (isNonExtractableEd25519CryptoKey(keyValue)) {
      return true
    }
  }
  return false
}

/**
 * @param {unknown} value
 */
const isNonExtractableEd25519CryptoKey = (value) => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const isCryptoKey =
    (typeof CryptoKey !== 'undefined' && value instanceof CryptoKey) ||
    Object.prototype.toString.call(value) === '[object CryptoKey]'
  if (!isCryptoKey) return false

  const key = /** @type {CryptoKey} */ (value)
  return (
    key.algorithm?.name === 'Ed25519' &&
    key.type === 'private' &&
    key.extractable === false
  )
}

import * as API from './types.js'

/**
 * Known valid provider/algorithm combinations
 *
 * @type {Record<string, string[]>}
 */
const VALID_COMBINATIONS = {
  'google-kms': ['RSA_DECRYPT_OAEP_3072_SHA256'],
  // Add more providers and algorithms here as needed
}

/**
 * Space access utilities and validation
 */
export class SpaceAccess {
  /**
   * Creates and validates a space access configuration
   *
   * @template {API.SpaceAccessType} T
   * @param {T} [access] - The access configuration to validate
   * @returns {T}
   * @throws {Error} When access configuration is invalid
   */
  static from(access) {
    if (!access || access.type === 'public') {
      return /** @type {T} */ ({ type: 'public' })
    }

    if (access.type === 'private') {
      if (!access.encryption) {
        throw new Error('Private access type requires encryption configuration')
      }

      const { provider, algorithm } = access.encryption

      if (!VALID_COMBINATIONS[provider]) {
        throw new Error(`unknown encryption provider: ${provider}`)
      }

      if (!VALID_COMBINATIONS[provider].includes(algorithm)) {
        throw new Error(
          `unknown encryption algorithm: ${algorithm} for provider: ${provider}`
        )
      }

      return /** @type {T} */ (access)
    }

    throw new Error(`unknown access type: ${/** @type {any} */ (access).type}`)
  }

  /**
   * Creates a public space access configuration
   *
   * @returns {API.PublicAccess}
   */
  static public() {
    return { type: 'public' }
  }

  /**
   * Creates a private space access configuration with encryption provider
   *
   * @param {string} [provider] - The encryption provider. Defaults to `google-kms`.
   * @param {string} [algorithm] - The encryption algorithm. Defaults to `RSA_DECRYPT_OAEP_3072_SHA256`.
   * @returns {API.PrivateAccess<API.EncryptionProvider>}
   * @throws {Error} When provider/algorithm combination is invalid
   */
  static private(
    provider = 'google-kms',
    algorithm = 'RSA_DECRYPT_OAEP_3072_SHA256'
  ) {
    if (!VALID_COMBINATIONS[provider]) {
      throw new Error(`unknown encryption provider: ${provider}`)
    }

    if (!VALID_COMBINATIONS[provider].includes(algorithm)) {
      throw new Error(
        `unknown encryption algorithm: ${algorithm} for provider: ${provider}`
      )
    }

    return {
      type: 'private',
      encryption: { provider, algorithm },
    }
  }
}

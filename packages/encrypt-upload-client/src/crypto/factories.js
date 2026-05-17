import { GenericAesCtrStreamingCrypto } from './symmetric/generic-aes-ctr-streaming-crypto.js'
import { KMSCryptoAdapter } from './adapters/kms-crypto-adapter.js'
import { LitCryptoAdapter } from './adapters/lit-crypto-adapter.js'
import * as Type from '../types.js'

/**
 * Create a KMS crypto adapter
 * Uses the generic AES-CTR streaming crypto implementation
 * Works in browser and Node.js environments
 *
 * @param {URL|string} keyManagerServiceURL
 * @param {string} keyManagerServiceDID
 * @param {object} [options] - Optional configuration
 * @param {boolean} [options.allowInsecureHttp] - Allow HTTP for testing (NOT for production)
 */
export function createGenericKMSAdapter(
  keyManagerServiceURL,
  keyManagerServiceDID,
  options = {}
) {
  const symmetricCrypto = new GenericAesCtrStreamingCrypto()
  return new KMSCryptoAdapter(
    symmetricCrypto,
    keyManagerServiceURL,
    /** @type {`did:${string}:${string}`} */ (keyManagerServiceDID),
    options
  )
}

/**
 * Create a Lit crypto adapter
 * Uses the generic AES-CTR streaming crypto.
 * Works in Node.js & browser environments.
 *
 * @param {import('@lit-protocol/lit-client').LitClientType} litClient
 * @param {Type.AuthManager} authManager - The Lit Auth Manager instance
 */
export function createGenericLitAdapter(litClient, authManager) {
  const symmetricCrypto = new GenericAesCtrStreamingCrypto()
  return new LitCryptoAdapter(symmetricCrypto, litClient, authManager)
}

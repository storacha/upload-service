import { GenericAesCtrStreamingCrypto } from './symmetric/generic-aes-ctr-streaming-crypto.js'
import { KMSCryptoAdapter } from './adapters/kms-crypto-adapter.js'

/**
 * Create a KMS crypto adapter for browser environments
 * Uses the generic AES-CTR streaming crypto implementation
 * Works in browser and Node.js environments
 *
 * @param {URL|string} keyManagerServiceURL
 * @param {string} keyManagerServiceDID
 */
export function createGenericKMSAdapter(
  keyManagerServiceURL,
  keyManagerServiceDID
) {
  const symmetricCrypto = new GenericAesCtrStreamingCrypto()
  return new KMSCryptoAdapter(
    symmetricCrypto,
    keyManagerServiceURL,
    /** @type {`did:${string}:${string}`} */ (keyManagerServiceDID)
  )
}

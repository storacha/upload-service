import { GenericAesCtrStreamingCrypto } from './symmetric/generic-aes-ctr-streaming-crypto.js'
import { LitCryptoAdapter } from './adapters/lit-crypto-adapter.js'
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

/**
 * Create a Lit crypto adapter for browser environments
 * Uses the generic AES-CTR streaming crypto implementation
 * Works in browser and Node.js environments
 *
 * @param {import('@lit-protocol/lit-node-client').LitNodeClient} litClient
 */
export function createGenericLitAdapter(litClient) {
  const symmetricCrypto = new GenericAesCtrStreamingCrypto()
  return new LitCryptoAdapter(symmetricCrypto, litClient)
}

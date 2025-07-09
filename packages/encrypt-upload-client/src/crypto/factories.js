import { GenericAesCtrStreamingCrypto } from './symmetric/generic-aes-ctr-streaming-crypto.js'
import { NodeAesCbcCrypto } from './symmetric/node-aes-cbc-crypto.js'
import { LitCryptoAdapter } from './adapters/lit-crypto-adapter.js'
import { KMSCryptoAdapter } from './adapters/kms-crypto-adapter.js'

/**
 * Create a Lit crypto adapter for Node.js environments
 * Uses the legacy AES-CBC crypto implementation for compatibility
 *
 * @deprecated Use createGenericLitAdapter instead for new uploads
 * @param {import('@lit-protocol/lit-node-client').LitNodeClient} litClient
 * @returns {LitCryptoAdapter}
 */
export function createLegacyLitAdapter(litClient) {
  const symmetricCrypto = new NodeAesCbcCrypto()
  return new LitCryptoAdapter(symmetricCrypto, litClient)
}

/**
 * Create a Lit crypto adapter with generic AES-CTR streaming crypto
 * Works in both browser and Node.js environments
 *
 * @param {import('@lit-protocol/lit-node-client').LitNodeClient} litClient
 * @returns {LitCryptoAdapter}
 */
export function createGenericLitAdapter(litClient) {
  const symmetricCrypto = new GenericAesCtrStreamingCrypto()
  return new LitCryptoAdapter(symmetricCrypto, litClient)
}

/**
 * Create a KMS crypto adapter with generic AES-CTR streaming crypto
 * Works in both browser and Node.js environments
 * It can handle large files (>1GB) with bounded memory
 *
 * @param {URL|string} privateGatewayURL
 * @param {string} privateGatewayDID
 * @returns {KMSCryptoAdapter}
 */
export function createGenericKMSAdapter(privateGatewayURL, privateGatewayDID) {
  const symmetricCrypto = new GenericAesCtrStreamingCrypto()
  return new KMSCryptoAdapter(
    symmetricCrypto,
    privateGatewayURL,
    /** @type {`did:${string}:${string}`} */ (privateGatewayDID)
  )
}

/**
 * Create a KMS crypto adapter for Node.js environments
 * Uses the legacy AES-CBC crypto implementation for compatibility
 *
 * @deprecated Use createGenericKMSAdapter instead for new uploads
 * @param {URL|string} privateGatewayURL
 * @param {string} privateGatewayDID
 * @returns {KMSCryptoAdapter}
 */
export function createNodeKMSAdapter(privateGatewayURL, privateGatewayDID) {
  const symmetricCrypto = new NodeAesCbcCrypto()
  return new KMSCryptoAdapter(
    symmetricCrypto,
    privateGatewayURL,
    /** @type {`did:${string}:${string}`} */ (privateGatewayDID)
  )
}

/**
 * Create a Lit crypto adapter with generic AES-CTR streaming crypto
 * Works in both browser and Node.js environments
 *
 * @alias createGenericLitAdapter
 * @param {import('@lit-protocol/lit-node-client').LitNodeClient} litClient
 * @returns {LitCryptoAdapter}
 */
export function createCrossEnvLitAdapter(litClient) {
  return createGenericLitAdapter(litClient)
}

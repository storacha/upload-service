import { BrowserAesCtrCrypto } from './symmetric/browser-aes-ctr-crypto.js'
import { NodeAesCbcCrypto } from './symmetric/node-aes-cbc-crypto.js'
import { LitCryptoAdapter } from './adapters/lit-crypto-adapter.js'
import { KMSCryptoAdapter } from './adapters/kms-crypto-adapter.js'

/**
 * Create a Lit crypto adapter for browser environments
 *
 * @param {import('@lit-protocol/lit-node-client').LitNodeClient} litClient
 * @returns {LitCryptoAdapter}
 */
export function createBrowserLitAdapter(litClient) {
  const symmetricCrypto = new BrowserAesCtrCrypto()
  return new LitCryptoAdapter(symmetricCrypto, litClient)
}

/**
 * Create a Lit crypto adapter for Node.js environments
 *
 * @param {import('@lit-protocol/lit-node-client').LitNodeClient} litClient
 * @returns {LitCryptoAdapter}
 */
export function createNodeLitAdapter(litClient) {
  const symmetricCrypto = new NodeAesCbcCrypto()
  return new LitCryptoAdapter(symmetricCrypto, litClient)
}

/**
 * Create a KMS crypto adapter for browser environments
 *
 * @param {URL|string} privateGatewayURL
 * @param {`did:${string}:${string}`} privateGatewayDID
 * @returns {KMSCryptoAdapter}
 */
export function createBrowserKMSAdapter(privateGatewayURL, privateGatewayDID) {
  const symmetricCrypto = new BrowserAesCtrCrypto()
  return new KMSCryptoAdapter(
    symmetricCrypto,
    privateGatewayURL,
    privateGatewayDID
  )
}

/**
 * Create a KMS crypto adapter for Node.js environments
 *
 * @param {URL|string} privateGatewayURL
 * @param {string} [privateGatewayDID]
 * @returns {KMSCryptoAdapter}
 */
export function createNodeKMSAdapter(privateGatewayURL, privateGatewayDID) {
  const symmetricCrypto = new NodeAesCbcCrypto()
  const gatewayDID = privateGatewayDID || 'did:web:freeway.dag.haus'
  return new KMSCryptoAdapter(
    symmetricCrypto,
    privateGatewayURL,
    /** @type {`did:${string}:${string}`} */ (gatewayDID)
  )
}

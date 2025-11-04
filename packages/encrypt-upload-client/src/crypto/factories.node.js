import { GenericAesCtrStreamingCrypto } from './symmetric/generic-aes-ctr-streaming-crypto.js'
import { KMSCryptoAdapter } from './adapters/kms-crypto-adapter.js'
import { LitCryptoAdapter } from './adapters/lit-crypto-adapter.js'
import * as Type from '../types.js'

/**
 * Create a KMS crypto adapter for Node.js using the generic AES-CTR streaming crypto.
 * Works in Node.js & browser environments.
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

// TODO: remove
// /**
//  * Create a Lit crypto adapter for Node.js using AES-CBC (legacy).
//  * Compatible with previous versions of the library.
//  *
//  * @deprecated Use createGenericLitAdapter instead for new uploads.
//  * @param {import('@lit-protocol/lit-node-client').LitNodeClient} litClient
//  */
// export function createNodeLitAdapter(litClient) {
//   const symmetricCrypto = new NodeAesCbcCrypto()
//   return new LitCryptoAdapter(symmetricCrypto, litClient)
// }

/**
 * Create a Lit crypto adapter for Node.js using the generic AES-CTR streaming crypto.
 * Works in Node.js & browser environments.
 *
 * @param {import('@lit-protocol/lit-client').LitClientType} litClient
 * @param {Type.AuthManager} authManager - The Lit Auth Manager instance
 */
export function createGenericLitAdapter(litClient, authManager) {
  const symmetricCrypto = new GenericAesCtrStreamingCrypto()
  return new LitCryptoAdapter(symmetricCrypto, litClient, authManager)
}

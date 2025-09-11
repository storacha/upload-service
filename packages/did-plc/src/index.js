import { universalFetch } from './utils.js'
import * as ed25519 from '@noble/ed25519'
import base64url from 'base64url'
import { base58btc } from 'multiformats/bases/base58'

/**
 * PLC Directory Client for did:plc operations.
 */
export class PlcClient {
  /**
   * @param {Object} [opts]
   * @param {string} [opts.directoryUrl] - Base URL for PLC directory
   */
  constructor(opts = {}) {
    this.directoryUrl = opts.directoryUrl || 'https://plc.directory'
  }

  /**
   * Resolve a did:plc to its DID Document.
   * 
   * @param {import('./types.js').DidPlc} did
   * @returns {Promise<import('./types.js').PlcDocument>}
   * @throws {Error} If the DID cannot be resolved
   */
  async getDocument(did) {
    const res = await universalFetch(`${this.directoryUrl}/${encodeURIComponent(did)}`)
    if (!res.ok) throw new Error(`Failed to resolve ${did}`)
    return await res.json()
  }

  /**
   * Verifies that a message was signed by the current owner of the did:plc.
   * It verifies all the verification methods in the DID Document to find at
   * least one that matches the signature.
   * 
   * @param {import('./types.js').DidPlc} did - The did:plc identifier.
   * @param {Uint8Array|string} message - The message that was signed.
   * @param {string} signature - The signature to verify (base64url string).
   * @returns {Promise<boolean>} True if valid, false otherwise.
   */
  async verifyOwnership(did, message, signature) {
    try {
      const doc = await this.getDocument(did)
      const vms = doc.verificationMethod || []
      const sigBytes = base64url.default.toBuffer(signature)
      const msgBytes = typeof message === 'string' ? new TextEncoder().encode(message) : message

      for (const vm of vms) {
        if (!vm.publicKeyMultibase) continue
        let pubKey
        try {
          pubKey = base58btc.decode(vm.publicKeyMultibase)
        } catch {
          continue
        }
        if (await ed25519.verify(sigBytes, msgBytes, pubKey)) {
          return true
        }
      }
      return false
    } catch (e) {
      return false
    }
  }

}

/**
 * Parse a string and ensure it is a valid did:plc.
 * Returns the canonical form (lower-cased).
 * 
 * @param {string} input
 * @returns {import('./types.js').DidPlc}
 */
export function parseDidPlc(input) {
  const m = /^did:plc:([a-z0-9]{32})$/i.exec(input.trim())
  if (!m) throw new Error(`Invalid did:plc: ${input}`)
  return /** @type {const} */ (`did:plc:${m[1].toLowerCase()}`)
}

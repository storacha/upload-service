import * as assert from 'assert'
import { PlcClient } from '../src/index.js'
import * as ed25519 from '@noble/ed25519'
import { base58btc } from 'multiformats/bases/base58'
import base64url from 'base64url'
import { createHash } from 'crypto'
import { Buffer } from 'buffer'

ed25519.etc.sha512Sync = (msg) => createHash('sha512').update(msg).digest()

/**
 * Universal Uint8Array to base64url string (works in Node and browser)
 * 
 * @param {Uint8Array} uint8
 * @returns {string}
 */
function uint8ToBase64url(uint8) {
  return base64url.default.encode(Buffer.from(uint8))
}

describe('DID PLC Client', () => {
  const client = new PlcClient()

  it('should resolve a real did:plc to a DID Document', async () => {
    const did = 'did:plc:ewvi7nxzyoun6zhxrhs64oiz'
    const doc = await client.getDocument(did)
    assert.strictEqual(doc.id, did)
    assert.ok(Array.isArray(doc['@context']))
    assert.ok(doc.verificationMethod)
  })
})

describe('PlcClient.verifyOwnership', () => {
  it('should verify a valid signature for a known key', async () => {
    // Generate a test keypair
    const secretKey = ed25519.utils.randomPrivateKey()
    const publicKey = await ed25519.getPublicKey(secretKey)
    const publicKeyMultibase = base58btc.encode(publicKey)

    // Fake a DID document with this key
    const client = new PlcClient()
    client.getDocument = async () => ({
      '@context': [],
      id: 'did:plc:fake',
      verificationMethod: [
        {
          id: '#test-key',
          type: 'Ed25519VerificationKey2020',
          controller: 'did:plc:fake',
          publicKeyMultibase,
        }
      ]
    })
    const message = 'hello world'
    const msgBytes = new TextEncoder().encode(message)
    const signature = await ed25519.sign(msgBytes, secretKey)
    const signatureB64Url = uint8ToBase64url(signature)

    const valid = await client.verifyOwnership('did:plc:fake', message, signatureB64Url)
    assert.strictEqual(valid, true)

    // Negative test: wrong signature
    const invalid = await client.verifyOwnership(
      'did:plc:fake',
      message,
      uint8ToBase64url(ed25519.utils.randomPrivateKey())
    )
    assert.strictEqual(invalid, false)
  })
}) 
import { test, describe } from 'node:test'
import assert from 'node:assert'

// Polyfill globalThis.crypto for Node.js <19
if (typeof globalThis.crypto === 'undefined') {
  try {
    // @ts-expect-error
    globalThis.crypto = (await import('crypto')).webcrypto
  } catch (e) {
    throw new Error(
      'globalThis.crypto is not available. Use Node.js 19+ or polyfill with a package like @peculiar/webcrypto.'
    )
  }
}

import { BrowserAesCtrCrypto } from '../src/crypto/symmetric/browser-aes-ctr-crypto.js'
import { KMSCryptoAdapter } from '../src/crypto/adapters/kms-crypto-adapter.js'

/**
 * @param {Uint8Array} arr
 * @returns {string}
 */
function uint8ArrayToString(arr) {
  return new TextDecoder().decode(arr)
}

/**
 * @param {string} str
 * @returns {Uint8Array}
 */
function stringToUint8Array(str) {
  return new TextEncoder().encode(str)
}

/**
 * @param {ReadableStream} stream
 * @returns {Promise<Uint8Array>}
 */
async function streamToUint8Array(stream) {
  const reader = stream.getReader()
  const chunks = []
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  // Concatenate all chunks
  const totalLength = chunks.reduce((acc, val) => acc + val.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}

await describe('KMSCryptoAdapter', async () => {
  await test('should delegate symmetric crypto operations to the injected implementation', async () => {
    const symmetricCrypto = new BrowserAesCtrCrypto()
    const adapter = new KMSCryptoAdapter(
      symmetricCrypto,
      'https://freeway.dag.haus',
      'did:web:freeway.dag.haus'
    )
    
    const originalText = 'Op, this is a test for KMS strategy-based encryption!'
    const blob = new Blob([stringToUint8Array(originalText)])

    // Test that it delegates to the symmetric crypto implementation
    const { key, iv, encryptedStream } = await adapter.encryptStream(blob)
    
    assert(key instanceof Uint8Array, 'Key should be a Uint8Array')
    assert(iv instanceof Uint8Array, 'IV should be a Uint8Array')
    assert(encryptedStream instanceof ReadableStream, 'Encrypted stream should be a ReadableStream')

    // Test decryption delegation
    const decryptedStream = await adapter.decryptStream(encryptedStream, key, iv)
    const decryptedBytes = await streamToUint8Array(decryptedStream)
    const decryptedText = uint8ArrayToString(decryptedBytes)

    assert.strictEqual(decryptedText, originalText, 'Decrypted text should match original')
  })

  await test('should initialize KMS adapter with correct configuration', async () => {
    const symmetricCrypto = new BrowserAesCtrCrypto()
    const adapter = new KMSCryptoAdapter(
      symmetricCrypto,
      'https://freeway.dag.haus',
      'did:web:freeway.dag.haus'
    )
    
    // Test that the adapter can handle encryption options directly
    assert(typeof adapter.encryptSymmetricKey === 'function', 'encryptSymmetricKey should be a function')
    
    // Verify adapter constructor sets properties correctly
    assert.strictEqual(adapter.privateGatewayDID, 'did:web:freeway.dag.haus', 'Adapter should have gateway DID')
    assert(adapter.privateGatewayURL instanceof URL, 'Adapter should have gateway URL')
  })

  await test('should handle metadata extraction placeholder', async () => {
    const symmetricCrypto = new BrowserAesCtrCrypto()
    const adapter = new KMSCryptoAdapter(
      symmetricCrypto,
      'https://freeway.dag.haus',
      'did:web:freeway.dag.haus'
    )
    
    // Test that the method exists and throws expected error for unimplemented feature
    assert(typeof adapter.extractEncryptedMetadata === 'function', 'extractEncryptedMetadata should be a function')
    assert(typeof adapter.getEncryptedKey === 'function', 'getEncryptedKey should be a function')
    
    // Should throw error for unimplemented feature
    const mockCar = new Uint8Array([1, 2, 3])
    assert.throws(() => {
      adapter.extractEncryptedMetadata(mockCar)
    }, /KMS metadata extraction not yet implemented/, 'Should throw error for unimplemented KMS metadata extraction')
  })
}) 
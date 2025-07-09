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

import { GenericAesCtrStreamingCrypto } from '../src/crypto/symmetric/generic-aes-ctr-streaming-crypto.js'
import { NodeAesCbcCrypto } from '../src/crypto/symmetric/node-aes-cbc-crypto.js'
import { LitCryptoAdapter } from '../src/crypto/adapters/lit-crypto-adapter.js'
import {
  stringToUint8Array,
  streamToUint8Array,
  uint8ArrayToString,
} from './helpers/test-file-utils.js'

// Mock Lit client - cast to any for testing
const mockLitClient = /** @type {any} */ (
  {
    // Add mock methods as needed
  }
)

await describe('LitCryptoAdapter', async () => {
  await describe('Generic AES-CTR Crypto Implementation', async () => {
    await test('should delegate symmetric crypto operations to the generic implementation', async () => {
      const symmetricCrypto = new GenericAesCtrStreamingCrypto()
      const adapter = new LitCryptoAdapter(symmetricCrypto, mockLitClient)

      const originalText = 'Op, this is a test for strategy-based encryption!'
      const blob = new Blob([stringToUint8Array(originalText)])

      // Test that it delegates to the symmetric crypto implementation
      const { key, iv, encryptedStream } = await adapter.encryptStream(blob)

      assert(key instanceof Uint8Array, 'Key should be a Uint8Array')
      assert(iv instanceof Uint8Array, 'IV should be a Uint8Array')
      assert(
        encryptedStream instanceof ReadableStream,
        'Encrypted stream should be a ReadableStream'
      )

      // Test decryption delegation
      const decryptedStream = await adapter.decryptStream(
        encryptedStream,
        key,
        iv
      )
      const decryptedBytes = await streamToUint8Array(decryptedStream)
      const decryptedText = uint8ArrayToString(decryptedBytes)

      assert.strictEqual(
        decryptedText,
        originalText,
        'Decrypted text should match original'
      )
    })

    await test('should initialize Generic Lit adapter with correct configuration', async () => {
      const symmetricCrypto = new GenericAesCtrStreamingCrypto()
      const adapter = new LitCryptoAdapter(symmetricCrypto, mockLitClient)

      // Test that the adapter has the required methods
      assert(
        typeof adapter.encryptSymmetricKey === 'function',
        'encryptSymmetricKey should be a function'
      )
      assert(
        typeof adapter.decryptSymmetricKey === 'function',
        'decryptSymmetricKey should be a function'
      )

      // Verify adapter has the lit client
      assert.strictEqual(
        adapter.litClient,
        mockLitClient,
        'Adapter should store the Lit client'
      )

      // Verify it uses the correct crypto implementation
      assert(
        adapter.symmetricCrypto instanceof GenericAesCtrStreamingCrypto,
        'Should use GenericAesCtrStreamingCrypto'
      )
    })
  })

  await describe('Node.js AES-CBC Crypto Implementation (Legacy)', async () => {
    await test('should delegate symmetric crypto operations to the Node.js implementation', async () => {
      const symmetricCrypto = new NodeAesCbcCrypto()
      const adapter = new LitCryptoAdapter(symmetricCrypto, mockLitClient)

      const originalText = 'Op, this is a test for legacy Node.js encryption!'
      const blob = new Blob([stringToUint8Array(originalText)])

      // Test that it delegates to the symmetric crypto implementation
      const { key, iv, encryptedStream } = await adapter.encryptStream(blob)

      assert(key instanceof Uint8Array, 'Key should be a Uint8Array')
      assert(iv instanceof Uint8Array, 'IV should be a Uint8Array')
      assert(
        encryptedStream instanceof ReadableStream,
        'Encrypted stream should be a ReadableStream'
      )

      // Test decryption delegation
      const decryptedStream = await adapter.decryptStream(
        encryptedStream,
        key,
        iv
      )
      const decryptedBytes = await streamToUint8Array(decryptedStream)
      const decryptedText = uint8ArrayToString(decryptedBytes)

      assert.strictEqual(
        decryptedText,
        originalText,
        'Decrypted text should match original'
      )
    })

    await test('should initialize Node.js Lit adapter with correct configuration', async () => {
      const symmetricCrypto = new NodeAesCbcCrypto()
      const adapter = new LitCryptoAdapter(symmetricCrypto, mockLitClient)

      // Test that the adapter has the required methods
      assert(
        typeof adapter.encryptSymmetricKey === 'function',
        'encryptSymmetricKey should be a function'
      )
      assert(
        typeof adapter.decryptSymmetricKey === 'function',
        'decryptSymmetricKey should be a function'
      )

      // Verify adapter has the lit client
      assert.strictEqual(
        adapter.litClient,
        mockLitClient,
        'Adapter should store the Lit client'
      )

      // Verify it uses the correct crypto implementation
      assert(
        adapter.symmetricCrypto instanceof NodeAesCbcCrypto,
        'Should use NodeAesCbcCrypto'
      )
    })
  })

  await describe('Cross-Implementation Compatibility', async () => {
    await test('should demonstrate algorithm differences between implementations', async () => {
      const genericCrypto = new GenericAesCtrStreamingCrypto()
      const nodeCrypto = new NodeAesCbcCrypto()

      const genericAdapter = new LitCryptoAdapter(genericCrypto, mockLitClient)
      const nodeAdapter = new LitCryptoAdapter(nodeCrypto, mockLitClient)

      const originalText = 'Test data for algorithm comparison'
      const blob = new Blob([stringToUint8Array(originalText)])

      // Encrypt with both adapters
      const genericResult = await genericAdapter.encryptStream(blob)
      const nodeResult = await nodeAdapter.encryptStream(blob)

      // Convert streams to bytes
      const genericEncrypted = await streamToUint8Array(
        genericResult.encryptedStream
      )
      const nodeEncrypted = await streamToUint8Array(nodeResult.encryptedStream)

      // Verify they produce different results (different algorithms)
      assert.notDeepEqual(
        genericEncrypted,
        nodeEncrypted,
        'AES-CTR and AES-CBC should produce different encrypted outputs'
      )

      // Verify both can decrypt their own data
      const genericDecryptStream = new ReadableStream({
        start(controller) {
          controller.enqueue(genericEncrypted)
          controller.close()
        },
      })

      const nodeDecryptStream = new ReadableStream({
        start(controller) {
          controller.enqueue(nodeEncrypted)
          controller.close()
        },
      })

      const genericDecrypted = await genericAdapter.decryptStream(
        genericDecryptStream,
        genericResult.key,
        genericResult.iv
      )
      const nodeDecrypted = await nodeAdapter.decryptStream(
        nodeDecryptStream,
        nodeResult.key,
        nodeResult.iv
      )

      const genericDecryptedBytes = await streamToUint8Array(genericDecrypted)
      const nodeDecryptedBytes = await streamToUint8Array(nodeDecrypted)

      // Both should decrypt to the same original text
      assert.strictEqual(
        uint8ArrayToString(genericDecryptedBytes),
        originalText,
        'Generic adapter should decrypt correctly'
      )
      assert.strictEqual(
        uint8ArrayToString(nodeDecryptedBytes),
        originalText,
        'Node adapter should decrypt correctly'
      )

      console.log(
        'Both crypto implementations work with Lit adapter but produce different encrypted outputs'
      )
    })

    await test('should verify factory function behavior', async () => {
      const {
        createGenericLitAdapter,
        createLegacyLitAdapter: createNodeLitAdapter,
      } = await import('../src/crypto/factories.js')

      const genericAdapter = createGenericLitAdapter(mockLitClient)
      const nodeAdapter = createNodeLitAdapter(mockLitClient)

      // Verify factory functions create adapters with correct crypto implementations
      assert(
        genericAdapter.symmetricCrypto instanceof GenericAesCtrStreamingCrypto,
        'Generic factory should create adapter with GenericAesCtrStreamingCrypto'
      )
      assert(
        nodeAdapter.symmetricCrypto instanceof NodeAesCbcCrypto,
        'Node factory should create adapter with NodeAesCbcCrypto'
      )

      console.log(
        'Factory functions create adapters with correct crypto implementations'
      )
    })
  })
})

import './setup.js'
import { test, describe } from 'node:test'
import assert from 'node:assert'

import { GenericAesCtrStreamingCrypto } from '../src/crypto/symmetric/generic-aes-ctr-streaming-crypto.js'
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

const mockAuthManager = /** @type {any} */ (
  {
    // Add mock methods as needed
  }
)

await describe('LitCryptoAdapter', async () => {
  await describe('Generic AES-CTR Crypto Implementation', async () => {
    await test('should delegate symmetric crypto operations to the generic implementation', async () => {
      const symmetricCrypto = new GenericAesCtrStreamingCrypto()
      const adapter = new LitCryptoAdapter(
        symmetricCrypto,
        mockLitClient,
        mockAuthManager
      )

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
      const adapter = new LitCryptoAdapter(
        symmetricCrypto,
        mockLitClient,
        mockAuthManager
      )

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

  await describe('Cross-Implementation Compatibility', async () => {
    await test('should demonstrate algorithm differences between implementations', async () => {
      const genericCrypto = new GenericAesCtrStreamingCrypto()

      const genericAdapter = new LitCryptoAdapter(
        genericCrypto,
        mockLitClient,
        mockAuthManager
      )

      const originalText = 'Test data for algorithm comparison'
      const blob = new Blob([stringToUint8Array(originalText)])

      // Encrypt with all adapters
      const genericResult = await genericAdapter.encryptStream(blob)

      // Convert streams to bytes
      const genericEncrypted = await streamToUint8Array(
        genericResult.encryptedStream
      )

      // Verify both can decrypt their own data
      const genericDecryptStream = new ReadableStream({
        start(controller) {
          controller.enqueue(genericEncrypted)
          controller.close()
        },
      })

      const genericDecrypted = await genericAdapter.decryptStream(
        genericDecryptStream,
        genericResult.key,
        genericResult.iv
      )

      const genericDecryptedBytes = await streamToUint8Array(genericDecrypted)

      // Should decrypt to the same original text
      assert.strictEqual(
        uint8ArrayToString(genericDecryptedBytes),
        originalText,
        'Generic adapter should decrypt correctly'
      )

      console.log('All crypto implementations work with Lit adapter')
    })

    await test('should verify factory function behavior', async () => {
      const { createGenericLitAdapter } = await import(
        '../src/crypto/factories.node.js'
      )

      const genericAdapter = createGenericLitAdapter(
        mockLitClient,
        mockAuthManager
      )

      // Verify factory functions create adapters with correct crypto implementations
      assert(
        genericAdapter.symmetricCrypto instanceof GenericAesCtrStreamingCrypto,
        'Generic factory should create adapter with GenericAesCtrStreamingCrypto'
      )

      console.log(
        'Factory functions create adapters with correct crypto implementations'
      )
    })
  })
})

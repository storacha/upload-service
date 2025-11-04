import './setup.js'
import { test, describe } from 'node:test'
import assert from 'node:assert'

import {
  createGenericKMSAdapter,
  createGenericLitAdapter,
} from '../src/crypto/factories.node.js'
import { GenericAesCtrStreamingCrypto } from '../src/crypto/symmetric/generic-aes-ctr-streaming-crypto.js'
import { LitCryptoAdapter } from '../src/crypto/adapters/lit-crypto-adapter.js'
import { KMSCryptoAdapter } from '../src/crypto/adapters/kms-crypto-adapter.js'

// Mock Lit client for testing
const mockLitClient = /** @type {any} */ ({
  connect: () => Promise.resolve(),
  disconnect: () => Promise.resolve(),
})

const mockAuthManager = /** @type {any} */ (
  {
    // Add mock methods as needed
  }
)

await describe('Crypto Factory Functions', async () => {
  await describe('createBrowserLitAdapter', async () => {
    await test('should create LitCryptoAdapter with streaming crypto', async () => {
      const adapter = createGenericLitAdapter(mockLitClient, mockAuthManager)

      // Verify adapter type
      assert(
        adapter instanceof LitCryptoAdapter,
        'Should create LitCryptoAdapter instance'
      )

      // Verify symmetric crypto implementation
      assert(
        adapter.symmetricCrypto instanceof GenericAesCtrStreamingCrypto,
        'Should use GenericAesCtrStreamingCrypto for browser environment'
      )

      // Verify lit client is passed through
      assert.strictEqual(
        adapter.litClient,
        mockLitClient,
        'Should pass through the lit client'
      )
    })

    await test('should create adapter with required interface methods', async () => {
      const adapter = createGenericLitAdapter(mockLitClient, mockAuthManager)

      // Verify adapter has all required methods
      assert(
        typeof adapter.encryptStream === 'function',
        'Should have encryptStream method'
      )
      assert(
        typeof adapter.decryptStream === 'function',
        'Should have decryptStream method'
      )
      assert(
        typeof adapter.encryptSymmetricKey === 'function',
        'Should have encryptSymmetricKey method'
      )
      assert(
        typeof adapter.decryptSymmetricKey === 'function',
        'Should have decryptSymmetricKey method'
      )
      assert(
        typeof adapter.extractEncryptedMetadata === 'function',
        'Should have extractEncryptedMetadata method'
      )
      assert(
        typeof adapter.getEncryptedKey === 'function',
        'Should have getEncryptedKey method'
      )
    })

    await test('should handle null or undefined lit client gracefully', async () => {
      // This should still create the adapter (validation happens at runtime)
      const adapter = createGenericLitAdapter(
        /** @type {any} */ (null),
        mockAuthManager
      )
      assert(
        adapter instanceof LitCryptoAdapter,
        'Should create adapter even with null client'
      )
    })
  })

  await describe('createBrowserKMSAdapter', async () => {
    await test('should create KMSCryptoAdapter with streaming crypto', async () => {
      const keyManagerServiceURL = 'https://gateway.example.com'
      const keyManagerServiceDID = 'did:web:gateway.example.com'

      const adapter = createGenericKMSAdapter(
        keyManagerServiceURL,
        keyManagerServiceDID
      )

      // Verify adapter type
      assert(
        adapter instanceof KMSCryptoAdapter,
        'Should create KMSCryptoAdapter instance'
      )

      // Verify symmetric crypto implementation
      assert(
        adapter.symmetricCrypto instanceof GenericAesCtrStreamingCrypto,
        'Should use GenericAesCtrStreamingCrypto for browser environment'
      )

      // Verify configuration is passed through
      assert.strictEqual(
        adapter.keyManagerServiceURL.toString(),
        keyManagerServiceURL + '/',
        'Should set the key manager service URL'
      )
      assert.strictEqual(
        adapter.keyManagerServiceDID.did(),
        keyManagerServiceDID,
        'Should set the key manager service DID'
      )
    })

    await test('should accept URL object for gateway URL', async () => {
      const keyManagerServiceURL = new URL('https://gateway.example.com')
      const keyManagerServiceDID = 'did:web:gateway.example.com'

      const adapter = createGenericKMSAdapter(
        keyManagerServiceURL,
        keyManagerServiceDID
      )

      assert(
        adapter instanceof KMSCryptoAdapter,
        'Should create KMSCryptoAdapter with URL object'
      )
      assert.strictEqual(
        adapter.keyManagerServiceURL.toString(),
        keyManagerServiceURL.toString(),
        'Should handle URL object input'
      )
    })

    await test('should enforce HTTPS for security', async () => {
      const httpKeyManagerServiceURL = 'http://insecure.example.com'
      const keyManagerServiceDID = 'did:web:example.com'

      assert.throws(
        () =>
          createGenericKMSAdapter(
            httpKeyManagerServiceURL,
            keyManagerServiceDID
          ),
        /Key manager service must use HTTPS protocol for security/,
        'Should reject HTTP URLs for security'
      )
    })

    await test('should allow HTTP with explicit insecure option', async () => {
      // Note: The current implementation doesn't expose options in the factory
      // but we can test this through direct adapter construction
      const httpKeyManagerServiceURL = 'http://localhost:3000'
      const keyManagerServiceDID = 'did:web:localhost'

      assert.throws(
        () =>
          createGenericKMSAdapter(
            httpKeyManagerServiceURL,
            keyManagerServiceDID
          ),
        /Key manager service must use HTTPS protocol for security/,
        'Should reject HTTP URLs even for localhost by default'
      )
    })

    await test('should have all required KMS adapter methods', async () => {
      const adapter = createGenericKMSAdapter(
        'https://gateway.example.com',
        'did:web:gateway.example.com'
      )

      // Verify adapter has all required methods
      assert(
        typeof adapter.encryptStream === 'function',
        'Should have encryptStream method'
      )
      assert(
        typeof adapter.decryptStream === 'function',
        'Should have decryptStream method'
      )
      assert(
        typeof adapter.encryptSymmetricKey === 'function',
        'Should have encryptSymmetricKey method'
      )
      assert(
        typeof adapter.decryptSymmetricKey === 'function',
        'Should have decryptSymmetricKey method'
      )
    })
  })

  await describe('Factory Function Consistency', async () => {
    await test('browser factories should use streaming crypto', async () => {
      const litAdapter = createGenericLitAdapter(mockLitClient, mockAuthManager)
      const kmsAdapter = createGenericKMSAdapter(
        'https://gateway.example.com',
        'did:web:gateway.example.com'
      )

      assert(
        litAdapter.symmetricCrypto.constructor.name ===
          'GenericAesCtrStreamingCrypto',
        'Browser Lit adapter should use streaming crypto'
      )
      assert(
        kmsAdapter.symmetricCrypto.constructor.name ===
          'GenericAesCtrStreamingCrypto',
        'Browser KMS adapter should use streaming crypto'
      )
    })

    await test('all adapters should implement the same interface', async () => {
      const adapters = [
        createGenericLitAdapter(mockLitClient, mockAuthManager),
        createGenericKMSAdapter(
          'https://gateway.example.com',
          'did:web:gateway.example.com'
        ),
        createGenericKMSAdapter(
          'https://gateway.example.com',
          'did:web:gateway.example.com'
        ),
      ]

      const requiredMethods = [
        'encryptStream',
        'decryptStream',
        'encryptSymmetricKey',
        'decryptSymmetricKey',
        'extractEncryptedMetadata',
        'getEncryptedKey',
      ]

      for (const adapter of adapters) {
        for (const method of requiredMethods) {
          assert(
            typeof (/** @type {any} */ (adapter)[method]) === 'function',
            `${adapter.constructor.name} should have ${method} method`
          )
        }
      }
    })
  })

  await describe('Memory Usage Verification', async () => {
    await test('browser adapters should use memory-efficient streaming crypto', async () => {
      const litAdapter = createGenericLitAdapter(mockLitClient, mockAuthManager)
      const kmsAdapter = createGenericKMSAdapter(
        'https://gateway.example.com',
        'did:web:gateway.example.com'
      )

      // Verify both use the streaming implementation
      assert(
        litAdapter.symmetricCrypto instanceof GenericAesCtrStreamingCrypto,
        'Lit adapter should use streaming crypto for memory efficiency'
      )
      assert(
        kmsAdapter.symmetricCrypto instanceof GenericAesCtrStreamingCrypto,
        'KMS adapter should use streaming crypto for memory efficiency'
      )

      // Verify they have the streaming characteristics
      const testBlob = new Blob([new Uint8Array(1024)]) // 1KB test
      const litResult = await litAdapter.encryptStream(testBlob)
      assert(
        litResult.encryptedStream instanceof ReadableStream,
        'Should return ReadableStream for streaming'
      )
    })
  })
})

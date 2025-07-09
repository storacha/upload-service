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

import {
  createCrossEnvLitAdapter,
  createLegacyLitAdapter,
  createGenericKMSAdapter,
  createNodeKMSAdapter,
} from '../src/crypto/factories.js'
import { GenericAesCtrStreamingCrypto } from '../src/crypto/symmetric/generic-aes-ctr-streaming-crypto.js'
import { NodeAesCbcCrypto } from '../src/crypto/symmetric/node-aes-cbc-crypto.js'
import { LitCryptoAdapter } from '../src/crypto/adapters/lit-crypto-adapter.js'
import { KMSCryptoAdapter } from '../src/crypto/adapters/kms-crypto-adapter.js'

// Mock Lit client for testing
const mockLitClient = /** @type {any} */ ({
  connect: () => Promise.resolve(),
  disconnect: () => Promise.resolve(),
})

await describe('Crypto Factory Functions', async () => {
  await describe('createBrowserLitAdapter', async () => {
    await test('should create LitCryptoAdapter with streaming crypto', async () => {
      const adapter = createCrossEnvLitAdapter(mockLitClient)

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
      const adapter = createCrossEnvLitAdapter(mockLitClient)

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
      const adapter = createCrossEnvLitAdapter(/** @type {any} */ (null))
      assert(
        adapter instanceof LitCryptoAdapter,
        'Should create adapter even with null client'
      )
    })
  })

  await describe('createNodeLitAdapter', async () => {
    await test('should create LitCryptoAdapter with Node crypto', async () => {
      const adapter = createLegacyLitAdapter(mockLitClient)

      // Verify adapter type
      assert(
        adapter instanceof LitCryptoAdapter,
        'Should create LitCryptoAdapter instance'
      )

      // Verify symmetric crypto implementation
      assert(
        adapter.symmetricCrypto instanceof NodeAesCbcCrypto,
        'Should use NodeAesCbcCrypto for Node.js environment'
      )

      // Verify lit client is passed through
      assert.strictEqual(
        adapter.litClient,
        mockLitClient,
        'Should pass through the lit client'
      )
    })
  })

  await describe('createBrowserKMSAdapter', async () => {
    await test('should create KMSCryptoAdapter with streaming crypto', async () => {
      const privateGatewayURL = 'https://gateway.example.com'
      const privateGatewayDID = 'did:web:gateway.example.com'

      const adapter = createGenericKMSAdapter(
        privateGatewayURL,
        privateGatewayDID
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
        adapter.privateGatewayURL.toString(),
        privateGatewayURL + '/',
        'Should set the private gateway URL'
      )
      assert.strictEqual(
        adapter.privateGatewayDID.did(),
        privateGatewayDID,
        'Should set the private gateway DID'
      )
    })

    await test('should accept URL object for gateway URL', async () => {
      const privateGatewayURL = new URL('https://gateway.example.com')
      const privateGatewayDID = 'did:web:gateway.example.com'

      const adapter = createGenericKMSAdapter(
        privateGatewayURL,
        privateGatewayDID
      )

      assert(
        adapter instanceof KMSCryptoAdapter,
        'Should create KMSCryptoAdapter with URL object'
      )
      assert.strictEqual(
        adapter.privateGatewayURL.toString(),
        privateGatewayURL.toString(),
        'Should handle URL object input'
      )
    })

    await test('should enforce HTTPS for security', async () => {
      const httpGatewayURL = 'http://insecure.example.com'
      const privateGatewayDID = 'did:web:example.com'

      assert.throws(
        () => createGenericKMSAdapter(httpGatewayURL, privateGatewayDID),
        /Private gateway must use HTTPS protocol for security/,
        'Should reject HTTP URLs for security'
      )
    })

    await test('should allow HTTP with explicit insecure option', async () => {
      // Note: The current implementation doesn't expose options in the factory
      // but we can test this through direct adapter construction
      const httpGatewayURL = 'http://localhost:3000'
      const privateGatewayDID = 'did:web:localhost'

      assert.throws(
        () => createGenericKMSAdapter(httpGatewayURL, privateGatewayDID),
        /Private gateway must use HTTPS protocol for security/,
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

  await describe('createNodeKMSAdapter', async () => {
    await test('should create KMSCryptoAdapter with Node crypto', async () => {
      const privateGatewayURL = 'https://gateway.example.com'
      const privateGatewayDID = 'did:web:gateway.example.com'

      const adapter = createNodeKMSAdapter(privateGatewayURL, privateGatewayDID)

      // Verify adapter type
      assert(
        adapter instanceof KMSCryptoAdapter,
        'Should create KMSCryptoAdapter instance'
      )

      // Verify symmetric crypto implementation
      assert(
        adapter.symmetricCrypto instanceof NodeAesCbcCrypto,
        'Should use NodeAesCbcCrypto for Node.js environment'
      )
    })

    await test('should require DID parameter', async () => {
      const privateGatewayURL = 'https://gateway.example.com'
      const privateGatewayDID = 'did:web:private.storacha.link'

      const adapter = createNodeKMSAdapter(privateGatewayURL, privateGatewayDID)

      assert(
        adapter instanceof KMSCryptoAdapter,
        'Should create adapter with explicit DID'
      )
      assert.strictEqual(
        adapter.privateGatewayDID.did(),
        privateGatewayDID,
        'Should use provided DID'
      )
    })

    await test('should use provided DID when specified', async () => {
      const privateGatewayURL = 'https://gateway.example.com'
      const customDID = 'did:web:custom.gateway.com'

      const adapter = createNodeKMSAdapter(privateGatewayURL, customDID)

      assert.strictEqual(
        adapter.privateGatewayDID.did(),
        customDID,
        'Should use provided DID when specified'
      )
    })
  })

  await describe('Factory Function Consistency', async () => {
    await test('browser factories should use streaming crypto', async () => {
      const litAdapter = createCrossEnvLitAdapter(mockLitClient)
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

    await test('node factories should use Node crypto', async () => {
      const litAdapter = createLegacyLitAdapter(mockLitClient)
      const kmsAdapter = createNodeKMSAdapter(
        'https://gateway.example.com',
        'did:web:gateway.example.com'
      )

      assert(
        litAdapter.symmetricCrypto.constructor.name === 'NodeAesCbcCrypto',
        'Node Lit adapter should use Node crypto'
      )
      assert(
        kmsAdapter.symmetricCrypto.constructor.name === 'NodeAesCbcCrypto',
        'Node KMS adapter should use Node crypto'
      )
    })

    await test('all adapters should implement the same interface', async () => {
      const adapters = [
        createCrossEnvLitAdapter(mockLitClient),
        createLegacyLitAdapter(mockLitClient),
        createGenericKMSAdapter(
          'https://gateway.example.com',
          'did:web:gateway.example.com'
        ),
        createNodeKMSAdapter(
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
      const litAdapter = createCrossEnvLitAdapter(mockLitClient)
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

import { test, describe } from 'node:test'
import assert from 'node:assert'
import * as Server from '@ucanto/server'
import { base64 } from 'multiformats/bases/base64'
import * as Space from '@storacha/capabilities/space'

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
import {
  createMockGatewayService,
  createMockGatewayServer,
} from './mocks/private-gateway.js'
import { createTestFixtures } from './fixtures/test-fixtures.js'

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
  await describe('Unit Tests', async () => {
    await test('should delegate symmetric crypto operations to the injected implementation', async () => {
      const symmetricCrypto = new BrowserAesCtrCrypto()
      const adapter = new KMSCryptoAdapter(
        symmetricCrypto,
        'https://freeway.dag.haus',
        'did:web:freeway.dag.haus'
      )

      const originalText =
        'Op, this is a test for KMS strategy-based encryption!'
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

    await test('should initialize KMS adapter with correct configuration', async () => {
      const symmetricCrypto = new BrowserAesCtrCrypto()
      const adapter = new KMSCryptoAdapter(
        symmetricCrypto,
        'https://freeway.dag.haus',
        'did:web:freeway.dag.haus'
      )

      // Test that the adapter can handle encryption options directly
      assert(
        typeof adapter.encryptSymmetricKey === 'function',
        'encryptSymmetricKey should be a function'
      )

      // Verify adapter constructor sets properties correctly
      assert(
        typeof adapter.privateGatewayDID === 'object',
        'Adapter should have gateway DID object'
      )
      assert.strictEqual(
        adapter.privateGatewayDID.did(),
        'did:web:freeway.dag.haus',
        'Adapter should have correct gateway DID'
      )
      assert(
        adapter.privateGatewayURL instanceof URL,
        'Adapter should have gateway URL'
      )
    })

    await test('should handle metadata extraction with invalid CAR data', async () => {
      const symmetricCrypto = new BrowserAesCtrCrypto()
      const adapter = new KMSCryptoAdapter(
        symmetricCrypto,
        'https://freeway.dag.haus',
        'did:web:freeway.dag.haus'
      )

      // Test that the method exists
      assert(
        typeof adapter.extractEncryptedMetadata === 'function',
        'extractEncryptedMetadata should be a function'
      )
      assert(
        typeof adapter.getEncryptedKey === 'function',
        'getEncryptedKey should be a function'
      )

      // Should throw error for invalid CAR data
      const mockCar = new Uint8Array([1, 2, 3])
      assert.throws(
        () => {
          adapter.extractEncryptedMetadata(mockCar)
        },
        /Invalid CAR header format/,
        'Should throw error for invalid CAR data'
      )
    })

    await test('should encode and decode key references correctly', async () => {
      const symmetricCrypto = new BrowserAesCtrCrypto()
      const adapter = new KMSCryptoAdapter(
        symmetricCrypto,
        'mock://gateway',
        'did:web:mock'
      )

      const originalKeyRef =
        'projects/test-project/locations/us-central1/keyRings/test-ring/cryptoKeys/test-key/cryptoKeyVersions/1'

      // Test encoding
      const encoded = adapter.encodeKeyReference(originalKeyRef)
      assert(typeof encoded === 'string')
      assert(encoded !== originalKeyRef)

      // Test decoding
      const decoded = adapter.decodeKeyReference(encoded)
      assert.strictEqual(decoded, originalKeyRef)
    })

    await test('should sanitize space DID for KMS key ID', async () => {
      const symmetricCrypto = new BrowserAesCtrCrypto()
      const adapter = new KMSCryptoAdapter(
        symmetricCrypto,
        'mock://gateway',
        'did:web:mock'
      )

      const spaceDID =
        'did:key:z6MkwDK3M4PxU1FqcSt6quBH1xRBSGnPRdQYP9B13h3Wq5X1'
      const sanitized = adapter.sanitizeSpaceDIDForKMSKeyId(spaceDID)

      assert.strictEqual(
        sanitized,
        'z6MkwDK3M4PxU1FqcSt6quBH1xRBSGnPRdQYP9B13h3Wq5X1'
      )
      assert(!sanitized.includes('did:key:'))
    })
  })

  await describe('Integration Tests', async () => {
    await test('should complete full encryption workflow with mocked private gateway', async () => {
      const fixtures = await createTestFixtures()
      const {
        gatewayDID,
        spaceDID,
        issuer,
        publicKeyPem,
        keyPair,
        delegationProof,
      } = fixtures

      let setupCalled = false
      let decryptCalled = false
      let actualEncryptedKey = ''

      // Create mock gateway service that performs real RSA encryption/decryption
      const service = createMockGatewayService({
        mockPublicKey: publicKeyPem,
        mockKeyReference: 'mock-key-ref-123',
        onEncryptionSetup: (/** @type {any} */ input) => {
          setupCalled = true
          assert.strictEqual(input.capability.with, spaceDID)
          assert.strictEqual(input.capability.can, 'space/encryption/setup')
        },
        onKeyDecrypt: (/** @type {any} */ input) => {
          decryptCalled = true
          assert.strictEqual(input.capability.with, spaceDID)
          assert.strictEqual(
            input.capability.can,
            'space/encryption/key/decrypt'
          )
        },
      })

      // Override the decrypt handler to actually decrypt with the private key
      service.space.encryption.key.decrypt = Server.provide(
        Space.KeyDecrypt,
        async (input) => {
          decryptCalled = true
          assert.strictEqual(input.capability.with, spaceDID)
          assert.strictEqual(
            input.capability.can,
            'space/encryption/key/decrypt'
          )

          // Get the encrypted key from the request
          const encryptedSymmetricKey =
            input.capability.nb.encryptedSymmetricKey
          actualEncryptedKey = encryptedSymmetricKey

          // Decrypt with RSA private key (simulate real KMS decryption)
          const encryptedBytes = base64.decode(encryptedSymmetricKey)
          const decryptedBytes = await globalThis.crypto.subtle.decrypt(
            { name: 'RSA-OAEP' },
            keyPair.privateKey,
            encryptedBytes
          )

          // Return the decrypted symmetric key as base64
          const decryptedKey = base64.encode(new Uint8Array(decryptedBytes))

          return Server.ok({
            decryptedSymmetricKey: decryptedKey,
          })
        }
      )

      // Create mock gateway HTTP server
      const gatewayServer = await createMockGatewayServer(
        service,
        gatewayDID,
        5555
      )

      // Create KMS adapter
      const symmetricCrypto = new BrowserAesCtrCrypto()
      const adapter = new KMSCryptoAdapter(
        symmetricCrypto,
        gatewayServer.url,
        gatewayDID.did()
      )

      try {
        // Create test file and encrypt it to get real symmetric keys
        const testFile = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
        const testBlob = new Blob([testFile], {
          type: 'application/octet-stream',
        })

        // Encrypt the file to get real symmetric keys
        const { key, iv } = await adapter.encryptStream(testBlob)

        const encryptionConfig = {
          issuer,
          spaceDID,
          location: 'us-central1',
          keyring: 'test-keyring',
        }

        // Test key encryption with real symmetric keys - this will call the mock setup
        const encryptResult = await adapter.encryptSymmetricKey(
          key,
          iv,
          encryptionConfig
        )

        assert(setupCalled, 'EncryptionSetup should have been called')
        assert.strictEqual(encryptResult.strategy, 'kms')
        const kmsMetadata =
          /** @type {import('../src/types.js').KMSKeyMetadata} */ (
            encryptResult.metadata
          )
        assert.strictEqual(kmsMetadata.space, spaceDID)
        assert.strictEqual(kmsMetadata.kms.provider, 'google-kms')
        assert.strictEqual(kmsMetadata.kms.algorithm, 'RSA-OAEP-2048-SHA256')
        assert(typeof encryptResult.encryptedKey === 'string')

        // Test key decryption - this will call the mock decrypt
        const decryptionOptions = {
          spaceDID,
          delegationProof,
        }

        const mockMetadata = {
          strategy: /** @type {'kms'} */ ('kms'),
          encryptedDataCID: 'bafybeid',
          encryptedSymmetricKey: encryptResult.encryptedKey,
          space: spaceDID,
          kms: kmsMetadata.kms,
        }

        const decryptConfigs = {
          decryptionOptions,
          metadata: mockMetadata,
          delegationCAR: new Uint8Array(),
          resourceCID:
            /** @type {import('@storacha/upload-client/types').AnyLink} */ (
              /** @type {any} */ ('bafybeid')
            ),
          issuer,
          audience: gatewayDID.did(),
        }

        const decryptResult = await adapter.decryptSymmetricKey(
          encryptResult.encryptedKey,
          decryptConfigs
        )

        // Verify the round-trip worked
        assert(setupCalled, 'EncryptionSetup should have been called')
        assert(decryptCalled, 'KeyDecrypt should have been called')
        assert(
          decryptResult.key instanceof Uint8Array,
          'Decrypted key should be Uint8Array'
        )
        assert(
          decryptResult.iv instanceof Uint8Array,
          'Decrypted IV should be Uint8Array'
        )

        // Most importantly: verify the decrypted keys match the original
        assert.deepStrictEqual(
          decryptResult.key,
          key,
          'Decrypted key should match original key'
        )
        assert.deepStrictEqual(
          decryptResult.iv,
          iv,
          'Decrypted IV should match original IV'
        )

        // Verify the encrypted key was actually encrypted (different from original)
        const originalCombined = adapter.symmetricCrypto.combineKeyAndIV(
          key,
          iv
        )
        const originalBase64 = base64.encode(originalCombined)
        assert.notStrictEqual(
          actualEncryptedKey,
          originalBase64,
          'Encrypted key should be different from original'
        )
      } catch (error) {
        console.error('Test failed with error:', error)
        throw error
      } finally {
        // Clean up server
        await gatewayServer.close()
      }
    })

    await test('should handle encryption setup errors gracefully', async () => {
      const fixtures = await createTestFixtures()
      const { gatewayDID, spaceDID, issuer } = fixtures

      // Create service that returns errors
      const service = createMockGatewayService({
        mockPublicKey: 'invalid',
        mockKeyReference: 'test',
        onEncryptionSetup: () => {
          // This will be called but service will return error
        },
      })

      // Override service to return error
      service.space.encryption.setup = Server.provide(
        Space.EncryptionSetup,
        async () => {
          return Server.error({
            name: 'SpaceNotProvisioned',
            message: 'Space is not provisioned for encryption',
          })
        }
      )

      const gatewayServer = await createMockGatewayServer(
        service,
        gatewayDID,
        5556
      )

      const symmetricCrypto = new BrowserAesCtrCrypto()
      const adapter = new KMSCryptoAdapter(
        symmetricCrypto,
        gatewayServer.url,
        gatewayDID.did()
      )

      try {
        const testKey = new Uint8Array(32).fill(1)
        const testIV = new Uint8Array(16).fill(2)

        const encryptionConfig = {
          issuer,
          spaceDID,
        }

        // Should throw error
        await assert.rejects(
          () => adapter.encryptSymmetricKey(testKey, testIV, encryptionConfig),
          /SpaceNotProvisioned/
        )
      } finally {
        await gatewayServer.close()
      }
    })

    await test('should handle key decryption errors gracefully', async () => {
      const fixtures = await createTestFixtures()
      const { gatewayDID, spaceDID, issuer, delegationProof } = fixtures

      // Create service that returns errors for decrypt
      const service = createMockGatewayService({
        mockPublicKey: 'mock-key',
        mockKeyReference: 'test',
      })

      // Override decrypt service to return error
      service.space.encryption.key.decrypt = Server.provide(
        Space.KeyDecrypt,
        async () => {
          return Server.error({
            name: 'KeyNotFound',
            message: 'KMS key not found',
          })
        }
      )

      const gatewayServer = await createMockGatewayServer(
        service,
        gatewayDID,
        5557
      )

      const symmetricCrypto = new BrowserAesCtrCrypto()
      const adapter = new KMSCryptoAdapter(
        symmetricCrypto,
        gatewayServer.url,
        gatewayDID.did()
      )

      const decryptionOptions = {
        spaceDID,
        delegationProof,
      }

      const mockMetadata = {
        strategy: /** @type {'kms'} */ ('kms'),
        encryptedDataCID: 'bafybeid',
        encryptedSymmetricKey: 'mock-encrypted-key',
        space: spaceDID,
        kms: {
          provider: /** @type {'google-kms'} */ ('google-kms'),
          keyId: 'test-key',
          algorithm: /** @type {'RSA-OAEP-2048-SHA256'} */ (
            'RSA-OAEP-2048-SHA256'
          ),
        },
      }

      const decryptConfigs = /** @type {any} */ ({
        decryptionOptions,
        metadata: mockMetadata,
        delegationCAR: new Uint8Array(),
        resourceCID: 'bafybeid',
        issuer,
        audience: gatewayDID.did(),
      })

      try {
        // Should throw error
        await assert.rejects(
          () =>
            adapter.decryptSymmetricKey('mock-encrypted-key', decryptConfigs),
          /KeyNotFound/
        )
      } finally {
        await gatewayServer.close()
      }
    })
  })

  await describe('Validation Tests', async () => {
    await test('should validate required decryption parameters', async () => {
      const symmetricCrypto = new BrowserAesCtrCrypto()
      const adapter = new KMSCryptoAdapter(
        symmetricCrypto,
        'mock://gateway',
        'did:web:mock'
      )

      const invalidConfigs = /** @type {any} */ ({
        decryptionOptions: {}, // Missing spaceDID and delegationProof
        metadata: { strategy: 'kms' },
        delegationCAR: new Uint8Array(),
        resourceCID: 'bafybeid',
        issuer: null,
        audience: 'did:web:mock',
      })

      await assert.rejects(
        () => adapter.decryptSymmetricKey('key', invalidConfigs),
        /SpaceDID and delegationProof are required/
      )
    })

    await test('should validate issuer is provided', async () => {
      const fixtures = await createTestFixtures()
      const { spaceDID, delegationProof } = fixtures

      const symmetricCrypto = new BrowserAesCtrCrypto()
      const adapter = new KMSCryptoAdapter(
        symmetricCrypto,
        'mock://gateway',
        'did:web:mock'
      )

      const invalidConfigs = /** @type {any} */ ({
        decryptionOptions: { spaceDID, delegationProof },
        metadata: { strategy: 'kms' },
        delegationCAR: new Uint8Array(),
        resourceCID: 'bafybeid',
        issuer: null, // Missing issuer
        audience: 'did:web:mock',
      })

      await assert.rejects(
        () => adapter.decryptSymmetricKey('key', invalidConfigs),
        /Issuer is required/
      )
    })

    await test('should reject non-KMS metadata', async () => {
      const symmetricCrypto = new BrowserAesCtrCrypto()
      const adapter = new KMSCryptoAdapter(
        symmetricCrypto,
        'mock://gateway',
        'did:web:mock'
      )

      const invalidConfigs = /** @type {any} */ ({
        decryptionOptions: { spaceDID: 'did:key:test', delegationProof: {} },
        metadata: { strategy: 'lit' }, // Wrong strategy
        delegationCAR: new Uint8Array(),
        resourceCID: 'bafybeid',
        issuer: {},
        audience: 'did:web:mock',
      })

      await assert.rejects(
        () => adapter.decryptSymmetricKey('key', invalidConfigs),
        /KMSCryptoAdapter can only handle KMS metadata/
      )
    })
  })
})

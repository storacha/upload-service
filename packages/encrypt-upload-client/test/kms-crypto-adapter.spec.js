import './setup.js'
import { test, describe } from 'node:test'
import assert from 'node:assert'
import * as Server from '@ucanto/server'
import { base64 } from 'multiformats/bases/base64'
import * as Space from '@storacha/capabilities/space'

import { GenericAesCtrStreamingCrypto } from '../src/crypto/symmetric/generic-aes-ctr-streaming-crypto.js'
import { KMSCryptoAdapter } from '../src/crypto/adapters/kms-crypto-adapter.js'
import {
  createMockKeyManagerService,
  createMockKeyManagerServer,
} from './mocks/key-manager.js'
import { createTestFixtures } from './fixtures/test-fixtures.js'
import {
  stringToUint8Array,
  streamToUint8Array,
  uint8ArrayToString,
} from './helpers/test-file-utils.js'

await describe('KMSCryptoAdapter', async () => {
  await describe('Unit Tests', async () => {
    await test('should delegate symmetric crypto operations to the injected implementation', async () => {
      const symmetricCrypto = new GenericAesCtrStreamingCrypto()
      const adapter = new KMSCryptoAdapter(
        symmetricCrypto,
        'https://private.storacha.link',
        'did:web:private.storacha.link'
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
      const symmetricCrypto = new GenericAesCtrStreamingCrypto()
      const adapter = new KMSCryptoAdapter(
        symmetricCrypto,
        'https://private.storacha.link',
        'did:web:private.storacha.link'
      )

      // Test that the adapter can handle encryption options directly
      assert(
        typeof adapter.encryptSymmetricKey === 'function',
        'encryptSymmetricKey should be a function'
      )

      // Verify adapter constructor sets properties correctly
      assert(
        typeof adapter.keyManagerServiceDID === 'object',
        'Adapter should have gateway DID object'
      )
      assert.strictEqual(
        adapter.keyManagerServiceDID.did(),
        'did:web:private.storacha.link',
        'Adapter should have correct gateway DID'
      )
      assert(
        adapter.keyManagerServiceURL instanceof URL,
        'Adapter should have gateway URL'
      )
    })

    await test('should handle metadata extraction with invalid CAR data', async () => {
      const symmetricCrypto = new GenericAesCtrStreamingCrypto()
      const adapter = new KMSCryptoAdapter(
        symmetricCrypto,
        'https://private.storacha.link',
        'did:web:private.storacha.link'
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

    await test('should sanitize space DID for KMS key ID', async () => {
      const symmetricCrypto = new GenericAesCtrStreamingCrypto()
      const adapter = new KMSCryptoAdapter(
        symmetricCrypto,
        'https://mock-gateway.example.com',
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
        keyManagerServiceDID,
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
      const service = createMockKeyManagerService({
        mockPublicKey: publicKeyPem,
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
        Space.EncryptionKeyDecrypt,
        async (input) => {
          decryptCalled = true
          assert.strictEqual(input.capability.with, spaceDID)
          assert.strictEqual(
            input.capability.can,
            'space/encryption/key/decrypt'
          )

          // Get the encrypted key from the request
          const encryptedKeyBytes = input.capability.nb.key
          const encryptedSymmetricKey = base64.encode(encryptedKeyBytes)
          actualEncryptedKey = encryptedSymmetricKey

          // Decrypt with RSA private key (simulate real KMS decryption)
          const encryptedBytes = encryptedKeyBytes
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

      // Create mock gateway server (HTTPS by default)
      const keyManagerServiceServer = await createMockKeyManagerServer(
        service,
        keyManagerServiceDID,
        5555
      )

      // Create KMS adapter with HTTP allowed for testing
      const symmetricCrypto = new GenericAesCtrStreamingCrypto()
      const adapter = new KMSCryptoAdapter(
        symmetricCrypto,
        keyManagerServiceServer.url,
        keyManagerServiceDID.did(),
        { allowInsecureHttp: true } // Allow HTTP for testing
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
        const decryptionConfig = {
          spaceDID,
          decryptDelegation: delegationProof,
          proofs: [],
        }

        const mockMetadata = {
          strategy: /** @type {'kms'} */ ('kms'),
          encryptedDataCID: 'bafybeid',
          encryptedSymmetricKey: encryptResult.encryptedKey,
          space: spaceDID,
          kms: kmsMetadata.kms,
        }

        const decryptResult = await adapter.decryptSymmetricKey(
          encryptResult.encryptedKey,
          {
            decryptionConfig,
            metadata: mockMetadata,
            resourceCID:
              /** @type {import('@storacha/upload-client/types').AnyLink} */ (
                /** @type {any} */ ('bafybeid')
              ),
            issuer,
            audience: keyManagerServiceDID.did(),
          }
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
        await keyManagerServiceServer.close()
      }
    })

    await test('should handle encryption setup errors gracefully', async () => {
      const fixtures = await createTestFixtures()
      const { keyManagerServiceDID, spaceDID, issuer } = fixtures

      // Create service that returns errors
      const service = createMockKeyManagerService({
        mockPublicKey: 'invalid',
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

      const keyManagerServiceServer = await createMockKeyManagerServer(
        service,
        keyManagerServiceDID,
        5556
      )

      const symmetricCrypto = new GenericAesCtrStreamingCrypto()
      const adapter = new KMSCryptoAdapter(
        symmetricCrypto,
        keyManagerServiceServer.url,
        keyManagerServiceDID.did(),
        { allowInsecureHttp: true } // Allow HTTP for testing
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
          /Space is not provisioned for encryption/
        )
      } finally {
        await keyManagerServiceServer.close()
      }
    })

    await test('should handle key decryption errors gracefully', async () => {
      const fixtures = await createTestFixtures()
      const { keyManagerServiceDID, spaceDID, issuer, delegationProof } =
        fixtures

      // Create service that returns errors for decrypt
      const service = createMockKeyManagerService({
        mockPublicKey: 'mock-key',
      })

      // Override decrypt service to return error
      service.space.encryption.key.decrypt = Server.provide(
        Space.EncryptionKeyDecrypt,
        async () => {
          return Server.error({
            name: 'KeyNotFound',
            message: 'KMS key not found',
          })
        }
      )

      const keyManagerServiceServer = await createMockKeyManagerServer(
        service,
        keyManagerServiceDID,
        5557
      )

      const symmetricCrypto = new GenericAesCtrStreamingCrypto()
      const adapter = new KMSCryptoAdapter(
        symmetricCrypto,
        keyManagerServiceServer.url,
        keyManagerServiceDID.did(),
        { allowInsecureHttp: true } // Allow HTTP for testing
      )

      const decryptionOptions = {
        spaceDID,
        decryptDelegation: delegationProof,
      }

      const mockKey = new Uint8Array([1, 2, 3]) // test value as bytes
      const mockKeyString = base64.encode(mockKey)
      const mockMetadata = {
        strategy: /** @type {'kms'} */ ('kms'),
        encryptedDataCID: 'bafybeid',
        key: mockKey, // use bytes, not string
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
        decryptionConfig: decryptionOptions,
        metadata: mockMetadata,
        delegationCAR: new Uint8Array(),
        resourceCID: 'bafybeid',
        issuer,
        audience: keyManagerServiceDID.did(),
      })

      try {
        // Should throw error
        await assert.rejects(
          () => adapter.decryptSymmetricKey(mockKeyString, decryptConfigs),
          /KMS key not found/
        )
      } finally {
        await keyManagerServiceServer.close()
      }
    })
  })

  await describe('Validation Tests', async () => {
    await test('should validate required decryption parameters', async () => {
      const symmetricCrypto = new GenericAesCtrStreamingCrypto()
      const adapter = new KMSCryptoAdapter(
        symmetricCrypto,
        'https://mock-gateway.example.com',
        'did:web:mock'
      )

      const invalidConfigs = /** @type {any} */ ({
        decryptionConfig: {}, // Missing spaceDID and decryptDelegation
        metadata: { strategy: 'kms' },
        delegationCAR: new Uint8Array(),
        resourceCID: 'bafybeid',
        issuer: null,
        audience: 'did:web:mock',
      })

      await assert.rejects(
        () => adapter.decryptSymmetricKey('key', invalidConfigs),
        /SpaceDID and decryptDelegation are required/
      )
    })

    await test('should validate issuer is provided', async () => {
      const fixtures = await createTestFixtures()
      const { spaceDID, delegationProof } = fixtures

      const symmetricCrypto = new GenericAesCtrStreamingCrypto()
      const adapter = new KMSCryptoAdapter(
        symmetricCrypto,
        'https://mock-gateway.example.com',
        'did:web:mock'
      )

      const invalidConfigs = /** @type {any} */ ({
        decryptionConfig: { spaceDID, decryptDelegation: delegationProof },
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
      const symmetricCrypto = new GenericAesCtrStreamingCrypto()
      const adapter = new KMSCryptoAdapter(
        symmetricCrypto,
        'https://mock-gateway.example.com',
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

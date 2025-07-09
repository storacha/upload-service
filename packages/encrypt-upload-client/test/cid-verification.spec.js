import assert from 'node:assert'
import { describe, test } from 'node:test'
import { getCarFileFromPublicGateway } from '../src/handlers/decrypt-handler.js'
import * as KMSMetadata from '../src/core/metadata/kms-metadata.js'

/**
 * Create a CAR file with KMS metadata content
 *
 * @param {any} content - The KMS metadata content
 * @returns {Promise<{car: Uint8Array, actualRootCID: import('multiformats').UnknownLink}>}
 */
async function createTestCar(content) {
  // Create KMS metadata and archive it to get the CAR
  const kmsMetadata = KMSMetadata.create(content)
  const { cid, bytes } = await kmsMetadata.archiveBlock()

  // Use UCANTO's CAR encoding to create a proper CAR file
  const { CAR } = await import('@ucanto/core')
  const car = CAR.encode({ roots: [{ cid, bytes }] })

  return { car, actualRootCID: cid }
}

await describe('CID Verification', async () => {
  await describe('getCarFileFromPublicGateway', async () => {
    await test('should construct correct gateway URL format', async () => {
      // This is a basic test to verify the function exists and can be called
      // Integration tests with real network calls would test full functionality

      const gatewayURL = new URL('https://example.com')
      const testCID =
        'bafkreih5aznjvttude6c3wbvqeebb6rlx5wkbzyppv7z3aldwdht2oqadq'

      // Mock fetch to avoid network calls in unit tests
      const originalFetch = globalThis.fetch
      let capturedURL = ''

      // @ts-ignore - Mock fetch for testing
      globalThis.fetch = async (url) => {
        capturedURL = url.toString()
        // Return a mock response that looks like a failed fetch
        return {
          ok: false,
          status: 404,
          statusText: 'Not Found',
          arrayBuffer: async () => {
            throw new Error('Mock 404')
          },
        }
      }

      try {
        await getCarFileFromPublicGateway(gatewayURL, testCID)
      } catch (error) {
        // We expect this to fail with our mock, that's fine
      } finally {
        globalThis.fetch = originalFetch
      }

      // Verify the URL was constructed correctly
      const expectedURL = `https://example.com/ipfs/${testCID}?format=car`
      assert.strictEqual(
        capturedURL,
        expectedURL,
        'Should construct correct gateway URL'
      )
    })

    await test('should be exported and callable', async () => {
      // Basic smoke test
      assert.strictEqual(
        typeof getCarFileFromPublicGateway,
        'function',
        'Should be a function'
      )

      // Verify it requires proper parameters
      try {
        // @ts-ignore - intentionally testing invalid input
        await getCarFileFromPublicGateway(null, 'test')
        assert.fail('Should throw error for null gateway URL')
      } catch (error) {
        // Expected to fail - good
        assert(error instanceof Error, 'Should throw an Error')
      }
    })

    await test('should validate CID format', async () => {
      const gatewayURL = new URL('https://example.com')

      // Mock fetch to return valid CAR response
      const originalFetch = globalThis.fetch

      // @ts-ignore - Mock fetch for testing
      globalThis.fetch = async (url) => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () => new ArrayBuffer(100), // Mock CAR data
      })

      try {
        await getCarFileFromPublicGateway(gatewayURL, 'invalid-cid')
        assert.fail('Should throw error for invalid CID')
      } catch (error) {
        // Expected to fail due to invalid CID format
        assert(error instanceof Error, 'Should throw an Error for invalid CID')
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    await test('should accept valid CAR file with matching root CID', async () => {
      const gatewayURL = new URL('https://example.com')

      // Create a valid KMS metadata CAR file
      const testContent = {
        encryptedDataCID:
          'bafkreih5aznjvttude6c3wbvqeebb6rlx5wkbzyppv7z3aldwdht2oqadq',
        encryptedSymmetricKey: 'test-encrypted-key',
        space: 'did:key:z6MkwDK3M4PxU1FqcSt6quBH1xRBSGnPRdQYP9B13h3Wq5X1',
        kms: {
          provider: 'google-kms',
          keyId: 'test-key-id',
          algorithm: 'RSA-OAEP-2048-SHA256',
        },
      }
      const { car, actualRootCID } = await createTestCar(testContent)

      // Mock fetch to return the valid CAR
      const originalFetch = globalThis.fetch
      // @ts-ignore - Mock fetch for testing
      globalThis.fetch = async (url) => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () => car.buffer,
      })

      try {
        const result = await getCarFileFromPublicGateway(
          gatewayURL,
          actualRootCID.toString()
        )
        assert(result instanceof Uint8Array, 'Should return Uint8Array')
        assert.deepStrictEqual(result, car, 'Should return the exact CAR file')
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    await test('should reject CAR file with wrong root CID (tampering detection)', async () => {
      const gatewayURL = new URL('https://example.com')

      // Create a CAR file with content A
      const originalContent = {
        encryptedDataCID:
          'bafkreih5aznjvttude6c3wbvqeebb6rlx5wkbzyppv7z3aldwdht2oqadq',
        encryptedSymmetricKey: 'original-encrypted-key',
        space: 'did:key:z6MkwDK3M4PxU1FqcSt6quBH1xRBSGnPRdQYP9B13h3Wq5X1',
        kms: {
          provider: 'google-kms',
          keyId: 'original-key-id',
          algorithm: 'RSA-OAEP-2048-SHA256',
        },
      }
      const { actualRootCID: originalCID } = await createTestCar(
        originalContent
      )

      // Create a different CAR file with content B
      const tamperedContent = {
        encryptedDataCID:
          'bafkreidb6v6sjfnpnf6lqkh7p4w7zfzqfuzn2lqhp5x6zkojfuzwzlhpny',
        encryptedSymmetricKey: 'tampered-encrypted-key',
        space: 'did:key:z6MkMaliciousSpaceDIDThatShouldNotBeAccepted',
        kms: {
          provider: 'google-kms',
          keyId: 'tampered-key-id',
          algorithm: 'RSA-OAEP-2048-SHA256',
        },
      }
      const { car: tamperedCar } = await createTestCar(tamperedContent)

      // Mock fetch to return the tampered CAR when requesting the original CID
      const originalFetch = globalThis.fetch
      // @ts-ignore - Mock fetch for testing
      globalThis.fetch = async (url) => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () => tamperedCar.buffer, // Return wrong CAR!
      })

      try {
        await getCarFileFromPublicGateway(gatewayURL, originalCID.toString())
        assert.fail('Should throw error for CID verification failure')
      } catch (error) {
        assert(error instanceof Error, 'Should throw an Error')
        assert(
          error.message.includes('CID verification failed'),
          `Should mention CID verification failure. Got: ${error.message}`
        )
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    await test('should detect when malicious gateway serves completely different CAR', async () => {
      const gatewayURL = new URL('https://example.com')

      // CID we're requesting
      const requestedCID =
        'bafkreih5aznjvttude6c3wbvqeebb6rlx5wkbzyppv7z3aldwdht2oqadq'

      // Create a completely different CAR file
      const maliciousContent = {
        encryptedDataCID:
          'bafkreig6h5fimhfvj3wmlsf4fzj2d2ndqxd7qnugcgcmkn6dcqzxcq5zdu',
        encryptedSymmetricKey: 'malicious-encrypted-key',
        space: 'did:key:z6MkMaliciousSpaceDIDControlledByAttacker',
        kms: {
          provider: 'google-kms',
          keyId: 'attacker-controlled-key',
          algorithm: 'RSA-OAEP-2048-SHA256',
        },
      }
      const { car: maliciousCar } = await createTestCar(maliciousContent)

      // Mock fetch to return the malicious CAR
      const originalFetch = globalThis.fetch
      // @ts-ignore - Mock fetch for testing
      globalThis.fetch = async (url) => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () => maliciousCar.buffer,
      })

      try {
        await getCarFileFromPublicGateway(gatewayURL, requestedCID)
        assert.fail('Should throw error when gateway serves wrong CAR')
      } catch (error) {
        assert(error instanceof Error, 'Should throw an Error')
        assert(
          error.message.includes('CID verification failed'),
          `Should mention CID verification failure. Got: ${error.message}`
        )
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    await test('should handle network errors gracefully', async () => {
      const gatewayURL = new URL('https://example.com')
      const testCID =
        'bafkreih5aznjvttude6c3wbvqeebb6rlx5wkbzyppv7z3aldwdht2oqadq'

      // Mock fetch to return network error
      const originalFetch = globalThis.fetch
      // @ts-ignore - Mock fetch for testing
      globalThis.fetch = async (url) => ({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        arrayBuffer: async () => {
          throw new Error('Network error')
        },
      })

      try {
        await getCarFileFromPublicGateway(gatewayURL, testCID)
        assert.fail('Should throw error for network errors')
      } catch (error) {
        assert(error instanceof Error, 'Should throw an Error')
        assert(
          error.message.includes('Failed to fetch'),
          `Should mention fetch failure. Got: ${error.message}`
        )
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })

  await describe('Metadata Tampering Detection', async () => {
    await test('should prevent modification of space DID in metadata', async () => {
      const gatewayURL = new URL('https://example.com')

      // Original metadata with legitimate space DID
      const originalMetadata = {
        encryptedDataCID:
          'bafkreie2hvzhqzj3ixnmjh7h3nkhdyp6qxhqltkq6qxf3wxq7hqxd6nzde',
        encryptedSymmetricKey: 'encrypted-key-data',
        space: 'did:key:z6MkwDK3M4PxU1FqcSt6quBH1xRBSGnPRdQYP9B13h3Wq5X1', // Original space
        kms: {
          provider: 'google-kms',
          keyId: 'test-key-id',
          algorithm: 'RSA-OAEP-2048-SHA256',
        },
      }

      // Tampered metadata with different space DID
      const tamperedMetadata = {
        ...originalMetadata,
        space: 'did:key:z6MkMaliciousSpaceDIDThatShouldNotBeAccepted', // Malicious space!
      }

      // Create CAR files for both
      const { actualRootCID: originalCID } = await createTestCar(
        originalMetadata
      )
      const { car: tamperedCar } = await createTestCar(tamperedMetadata)

      // Mock fetch to return tampered CAR when requesting original CID
      const originalFetch = globalThis.fetch
      // @ts-ignore - Mock fetch for testing
      globalThis.fetch = async (url) => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () => tamperedCar.buffer, // Returns tampered metadata!
      })

      try {
        await getCarFileFromPublicGateway(gatewayURL, originalCID.toString())
        assert.fail('Should detect space DID tampering via CID verification')
      } catch (error) {
        assert(error instanceof Error, 'Should throw an Error')
        assert(
          error.message.includes('CID verification failed'),
          `Should catch tampering via CID verification. Got: ${error.message}`
        )
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    await test('should prevent complete metadata substitution attacks', async () => {
      const gatewayURL = new URL('https://example.com')

      // Original legitimate metadata
      const originalMetadata = {
        encryptedDataCID:
          'bafkreih5aznjvttude6c3wbvqeebb6rlx5wkbzyppv7z3aldwdht2oqadq',
        encryptedSymmetricKey: 'original-encrypted-key',
        space: 'did:key:z6MkwDK3M4PxU1FqcSt6quBH1xRBSGnPRdQYP9B13h3Wq5X1',
        kms: {
          provider: 'google-kms',
          keyId: 'legitimate-key-id',
          algorithm: 'RSA-OAEP-2048-SHA256',
        },
      }

      // Completely different malicious metadata (using same CID but different content)
      const maliciousMetadata = {
        encryptedDataCID:
          'bafkreih5aznjvttude6c3wbvqeebb6rlx5wkbzyppv7z3aldwdht2oqadq',
        encryptedSymmetricKey: 'malicious-encrypted-key',
        space: 'did:key:z6MkMaliciousSpaceDIDControlledByAttacker',
        kms: {
          provider: 'google-kms',
          keyId: 'attacker-controlled-key',
          algorithm: 'RSA-OAEP-2048-SHA256',
        },
      }

      // Create CAR files for both
      const { actualRootCID: originalCID } = await createTestCar(
        originalMetadata
      )
      const { car: maliciousCar } = await createTestCar(maliciousMetadata)

      // Mock fetch to return completely different metadata
      const originalFetch = globalThis.fetch
      // @ts-ignore - Mock fetch for testing
      globalThis.fetch = async (url) => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () => maliciousCar.buffer, // Complete substitution attack!
      })

      try {
        await getCarFileFromPublicGateway(gatewayURL, originalCID.toString())
        assert.fail(
          'Should detect complete metadata substitution via CID verification'
        )
      } catch (error) {
        assert(error instanceof Error, 'Should throw an Error')
        assert(
          error.message.includes('CID verification failed'),
          `Should catch complete substitution via CID verification. Got: ${error.message}`
        )
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })
})

import './setup.js'
import { test, describe } from 'node:test'
import assert from 'node:assert'

import { GenericAesCtrStreamingCrypto } from '../src/crypto/symmetric/generic-aes-ctr-streaming-crypto.js'
import { NodeAesCbcCrypto } from '../src/crypto/symmetric/node-aes-cbc-crypto.js'
import {
  createTestFile,
  streamToUint8Array,
} from './helpers/test-file-utils.js'

/**
 * These tests verify cross-environment compatibility and consistency of crypto implementations.
 */
await describe('Cross-Environment Crypto Compatibility', async () => {
  await test('should work consistently across multiple instances', async () => {
    const crypto1 = new GenericAesCtrStreamingCrypto()
    const crypto2 = new GenericAesCtrStreamingCrypto()

    const testFile = createTestFile(0.01) // 10KB test (ultra-small for memory safety)
    console.log('Testing consistency across instances...')

    // Use SAME key and IV for both instances
    const sharedKey = globalThis.crypto.getRandomValues(new Uint8Array(32))
    const sharedIV = globalThis.crypto.getRandomValues(new Uint8Array(16))

    // Override generateKey to return our shared key
    crypto1.generateKey = async () => sharedKey
    crypto2.generateKey = async () => sharedKey

    // Override IV generation to return our shared IV
    const originalRandomValues = globalThis.crypto.getRandomValues
    let ivCallCount = 0
    // @ts-ignore - Overriding for test purposes
    globalThis.crypto.getRandomValues = (array) => {
      // @ts-ignore - TypeScript is confused about the array type
      if (array && array.length === 16 && ivCallCount < 2) {
        ivCallCount++
        // @ts-ignore - TypeScript is confused about the array type
        array.set(sharedIV)
        return array
      }
      return originalRandomValues.call(globalThis.crypto, array)
    }

    try {
      // Get encryption results from both instances
      const result1 = await crypto1.encryptStream(testFile)
      const result2 = await crypto2.encryptStream(testFile)

      // Verify keys and IVs are identical
      assert.deepStrictEqual(
        result1.key,
        result2.key,
        'Keys should be identical'
      )
      assert.deepStrictEqual(result1.iv, result2.iv, 'IVs should be identical')

      // Convert streams to bytes for comparison
      const encrypted1 = await streamToUint8Array(result1.encryptedStream)
      const encrypted2 = await streamToUint8Array(result2.encryptedStream)

      // Verify encrypted outputs are byte-for-byte identical
      assert.strictEqual(
        encrypted1.length,
        encrypted2.length,
        'Encrypted lengths should match'
      )
      assert.deepStrictEqual(
        encrypted1,
        encrypted2,
        'Encrypted data should be identical'
      )

      console.log('Multiple instances produce identical results')
    } finally {
      // Restore original methods
      globalThis.crypto.getRandomValues = originalRandomValues
    }
  })

  await test('should support cross-instance decrypt', async () => {
    const crypto1 = new GenericAesCtrStreamingCrypto()
    const crypto2 = new GenericAesCtrStreamingCrypto()

    const testFile = createTestFile(0.01) // 10KB test (ultra-small for memory safety)
    console.log('Testing cross-instance decryption...')

    // Encrypt with first instance
    const { key, iv, encryptedStream } = await crypto1.encryptStream(testFile)
    const encryptedBytes = await streamToUint8Array(encryptedStream)

    // Decrypt with second instance
    const encryptedForDecrypt = new ReadableStream({
      start(controller) {
        controller.enqueue(encryptedBytes)
        controller.close()
      },
    })

    const decryptedStream = await crypto2.decryptStream(
      encryptedForDecrypt,
      key,
      iv
    )
    const decryptedBytes = await streamToUint8Array(decryptedStream)

    // Verify decrypted data matches original
    const originalBytes = new Uint8Array(await testFile.arrayBuffer())
    assert.deepStrictEqual(
      decryptedBytes,
      originalBytes,
      'Cross-instance decryption should work'
    )

    console.log('Cross-instance decryption verified')
  })

  await test('should handle edge cases consistently', async () => {
    const crypto = new GenericAesCtrStreamingCrypto()

    console.log('Testing edge case consistency...')

    // Test empty file
    const emptyFile = new Blob([])
    const emptyResult = await crypto.encryptStream(emptyFile)
    const emptyEncrypted = await streamToUint8Array(emptyResult.encryptedStream)
    assert.strictEqual(
      emptyEncrypted.length,
      0,
      'Empty file should encrypt to 0 bytes'
    )

    // Test single byte file
    const singleByteFile = new Blob([new Uint8Array([42])])
    const singleResult = await crypto.encryptStream(singleByteFile)
    const singleEncrypted = await streamToUint8Array(
      singleResult.encryptedStream
    )
    assert.strictEqual(
      singleEncrypted.length,
      1,
      'Single byte file should encrypt to 1 byte'
    )

    // Test round-trip of single byte
    const singleDecryptStream = new ReadableStream({
      start(controller) {
        controller.enqueue(singleEncrypted)
        controller.close()
      },
    })
    const singleDecrypted = await crypto.decryptStream(
      singleDecryptStream,
      singleResult.key,
      singleResult.iv
    )
    const singleDecryptedBytes = await streamToUint8Array(singleDecrypted)
    assert.deepStrictEqual(
      singleDecryptedBytes,
      new Uint8Array([42]),
      'Single byte round-trip should work'
    )

    console.log('Edge cases handled consistently')
  })

  await test('should demonstrate algorithm differences with NodeAesCbcCrypto', async () => {
    const genericCrypto = new GenericAesCtrStreamingCrypto()
    const nodeCrypto = new NodeAesCbcCrypto()

    const testFile = createTestFile(0.01) // 10KB test (ultra-small for memory safety)
    console.log('Testing algorithm differences...')

    // Encrypt with both implementations
    const genericResult = await genericCrypto.encryptStream(testFile)
    const nodeResult = await nodeCrypto.encryptStream(testFile)

    // Convert streams to bytes
    const genericEncrypted = await streamToUint8Array(
      genericResult.encryptedStream
    )
    const nodeEncrypted = await streamToUint8Array(nodeResult.encryptedStream)

    // Verify they produce different results (different algorithms)
    assert.notDeepEqual(
      genericEncrypted,
      nodeEncrypted,
      'AES-CTR and AES-CBC should produce different results'
    )

    // Verify they have different key/IV formats
    assert.strictEqual(
      genericResult.key.length,
      32,
      'Generic crypto should use 32-byte keys'
    )
    assert.strictEqual(
      genericResult.iv.length,
      16,
      'Generic crypto should use 16-byte IVs'
    )
    assert.strictEqual(
      nodeResult.key.length,
      32,
      'Node crypto should use 32-byte keys'
    )
    assert.strictEqual(
      nodeResult.iv.length,
      16,
      'Node crypto should use 16-byte IVs'
    )

    console.log(
      'Algorithm differences confirmed - use consistent crypto for encrypt/decrypt'
    )
  })
})

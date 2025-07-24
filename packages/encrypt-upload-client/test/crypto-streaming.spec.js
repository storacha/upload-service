import './setup.js'
import { test, describe } from 'node:test'
import assert from 'node:assert'

import { GenericAesCtrStreamingCrypto } from '../src/crypto/symmetric/generic-aes-ctr-streaming-crypto.js'
import {
  createTestFile,
  streamToUint8Array,
} from './helpers/test-file-utils.js'

await describe('Streaming Crypto - Core Functionality', async () => {
  await test('should encrypt and decrypt small files correctly', async () => {
    const crypto = new GenericAesCtrStreamingCrypto()
    const testFile = createTestFile(0.01) // 10KB (ultra-small for memory safety)

    // Encrypt
    const { key, iv, encryptedStream } = await crypto.encryptStream(testFile)

    assert(key instanceof Uint8Array, 'Key should be Uint8Array')
    assert.strictEqual(key.length, 32, 'Key should be 32 bytes')
    assert(iv instanceof Uint8Array, 'IV should be Uint8Array')
    assert.strictEqual(iv.length, 16, 'IV should be 16 bytes')

    // Convert stream to bytes
    const encryptedBytes = await streamToUint8Array(encryptedStream)
    assert.strictEqual(
      encryptedBytes.length,
      testFile.size,
      'Encrypted size should match original'
    )

    // Decrypt
    const encryptedForDecrypt = new ReadableStream({
      start(controller) {
        controller.enqueue(encryptedBytes)
        controller.close()
      },
    })

    const decryptedStream = await crypto.decryptStream(
      encryptedForDecrypt,
      key,
      iv
    )
    const decryptedBytes = await streamToUint8Array(decryptedStream)

    // Verify round-trip
    const originalBytes = new Uint8Array(await testFile.arrayBuffer())
    assert.deepStrictEqual(
      decryptedBytes,
      originalBytes,
      'Decrypted should match original'
    )

    console.log(`✓ Successfully encrypted/decrypted ${testFile.size} bytes`)
  })

  await test('should handle edge cases', async () => {
    const crypto = new GenericAesCtrStreamingCrypto()

    // Empty file
    const emptyFile = new Blob([])
    const { encryptedStream: emptyEncrypted } = await crypto.encryptStream(
      emptyFile
    )
    const emptyBytes = await streamToUint8Array(emptyEncrypted)
    assert.strictEqual(
      emptyBytes.length,
      0,
      'Empty file should produce empty encrypted data'
    )

    // Single byte
    const singleByteFile = new Blob([new Uint8Array([42])])
    const { key, iv, encryptedStream } = await crypto.encryptStream(
      singleByteFile
    )
    const encryptedBytes = await streamToUint8Array(encryptedStream)
    assert.strictEqual(
      encryptedBytes.length,
      1,
      'Single byte should produce single encrypted byte'
    )

    // Decrypt single byte
    const encryptedForDecrypt = new ReadableStream({
      start(controller) {
        controller.enqueue(encryptedBytes)
        controller.close()
      },
    })
    const decryptedStream = await crypto.decryptStream(
      encryptedForDecrypt,
      key,
      iv
    )
    const decryptedBytes = await streamToUint8Array(decryptedStream)
    assert.deepStrictEqual(
      decryptedBytes,
      new Uint8Array([42]),
      'Should decrypt to original byte'
    )

    console.log('✓ Edge cases handled correctly')
  })

  await test('should handle medium-sized files without issues', async () => {
    try {
      const crypto = new GenericAesCtrStreamingCrypto()

      // Test with progressively larger files to show streaming works consistently
      // Reduced sizes for CI stability while still testing streaming functionality
      const testSizes = [0.5, 1, 2] // MB

      for (const sizeMB of testSizes) {
        console.log(`Testing ${sizeMB}MB file...`)

        const testFile = createTestFile(sizeMB)
        const { key, iv, encryptedStream } = await crypto.encryptStream(
          testFile
        )

        // Convert encrypted stream to bytes first
        const encryptedBytes = await streamToUint8Array(encryptedStream)

        // Create a new stream from the encrypted bytes for decryption
        const encryptedForDecrypt = new ReadableStream({
          start(controller) {
            controller.enqueue(encryptedBytes)
            controller.close()
          },
        })

        const decryptedStream = await crypto.decryptStream(
          encryptedForDecrypt,
          key,
          iv
        )
        const decryptedBytes = await streamToUint8Array(decryptedStream)
        assert.strictEqual(
          decryptedBytes.length,
          sizeMB * 1024 * 1024,
          `Decrypted file size mismatch for ${sizeMB}MB`
        )
        console.log(`✓ ${sizeMB}MB file encrypted and decrypted successfully`)
      }

      console.log('✓ Medium-sized files handled without issues')
    } catch (err) {
      console.error(
        'Test error (type):',
        typeof err,
        err && err.constructor && err.constructor.name
      )
      console.error('Test error (keys):', err && Object.keys(err))
      console.error('Test error (string):', String(err))
      console.log(err)
      assert.fail('Unable to test medium-sized files')
    }
  })

  await test('should use proper counter arithmetic', async () => {
    const crypto = new GenericAesCtrStreamingCrypto()

    // Test counter increment function directly
    const baseCounter = new Uint8Array([
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ])

    // Increment by 1
    const counter1 = crypto.incrementCounter(baseCounter, 1)
    assert.deepStrictEqual(
      counter1,
      new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
      'Should increment last byte by 1'
    )

    // Increment by 255
    const counter255 = crypto.incrementCounter(baseCounter, 255)
    assert.deepStrictEqual(
      counter255,
      new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255]),
      'Should increment last byte by 255'
    )

    // Increment by 256 (should carry)
    const counter256 = crypto.incrementCounter(baseCounter, 256)
    assert.deepStrictEqual(
      counter256,
      new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0]),
      'Should carry to second-to-last byte'
    )

    console.log('✓ Counter arithmetic works correctly')
  })

  await test('should implement complete interface', async () => {
    const crypto = new GenericAesCtrStreamingCrypto()

    // Check all required methods exist
    assert(
      typeof crypto.generateKey === 'function',
      'Should have generateKey method'
    )
    assert(
      typeof crypto.encryptStream === 'function',
      'Should have encryptStream method'
    )
    assert(
      typeof crypto.decryptStream === 'function',
      'Should have decryptStream method'
    )
    assert(
      typeof crypto.combineKeyAndIV === 'function',
      'Should have combineKeyAndIV method'
    )
    assert(
      typeof crypto.splitKeyAndIV === 'function',
      'Should have splitKeyAndIV method'
    )
    assert(
      typeof crypto.incrementCounter === 'function',
      'Should have incrementCounter method'
    )

    // Test combine/split methods
    const key = await crypto.generateKey()
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(16))

    const combined = crypto.combineKeyAndIV(key, iv)
    assert.strictEqual(
      combined.length,
      48,
      'Combined should be 48 bytes (32 key + 16 IV)'
    )

    const { key: splitKey, iv: splitIV } = crypto.splitKeyAndIV(combined)
    assert.deepStrictEqual(splitKey, key, 'Split key should match original')
    assert.deepStrictEqual(splitIV, iv, 'Split IV should match original')

    console.log('Complete interface implemented correctly')
  })
})

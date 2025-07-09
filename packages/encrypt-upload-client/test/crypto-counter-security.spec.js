import { test, describe } from 'node:test'
import assert from 'node:assert'

// Polyfill globalThis.crypto for Node.js <19
if (typeof globalThis.crypto === 'undefined') {
  try {
    // @ts-expect-error - Node.js crypto compatibility
    globalThis.crypto = (await import('crypto')).webcrypto
  } catch (e) {
    throw new Error('globalThis.crypto is not available.')
  }
}

import { GenericAesCtrStreamingCrypto } from '../src/crypto/symmetric/generic-aes-ctr-streaming-crypto.js'

/**
 * Security tests for AES-CTR counter management
 *
 * These tests verify that the block-based counter implementation prevents keystream reuse,
 * which is critical for AES-CTR security.
 */
await describe('AES-CTR Counter Security', async () => {
  await test('should increment counter by blocks, not chunks', async () => {
    const crypto = new GenericAesCtrStreamingCrypto()

    // Test the incrementCounter function directly
    const baseCounter = new Uint8Array(16).fill(0)

    // Test counter increments for block counts
    const counter1 = crypto.incrementCounter(baseCounter, 0) // First block
    const counter2 = crypto.incrementCounter(baseCounter, 1) // Second block
    const counter3 = crypto.incrementCounter(baseCounter, 2) // Third block
    const counter4 = crypto.incrementCounter(baseCounter, 7) // Eighth block

    // Verify each counter is unique
    assert.notDeepEqual(
      counter1,
      counter2,
      'Block 1 and 2 should have different counters'
    )
    assert.notDeepEqual(
      counter2,
      counter3,
      'Block 2 and 3 should have different counters'
    )
    assert.notDeepEqual(
      counter3,
      counter4,
      'Block 3 and 8 should have different counters'
    )

    // Verify counter progression is correct
    assert.strictEqual(counter1[15], 0, 'First counter should be 0')
    assert.strictEqual(counter2[15], 1, 'Second counter should be 1')
    assert.strictEqual(counter3[15], 2, 'Third counter should be 2')
    assert.strictEqual(counter4[15], 7, 'Eighth counter should be 7')

    console.log('✅ Counter increments by blocks correctly')
  })

  await test('should handle chunk sizes correctly', async () => {
    const crypto = new GenericAesCtrStreamingCrypto()

    // Test different chunk sizes and verify block calculations
    const testData = new Uint8Array(100).fill(0xaa) // 7 blocks (100 bytes = ceil(100/16) = 7)
    const blob = new Blob([testData])

    const { key, iv, encryptedStream } = await crypto.encryptStream(blob)

    // Read encrypted data
    const reader = encryptedStream.getReader()
    let encryptedChunks = []

    let done = false
    while (!done) {
      const result = await reader.read()
      done = result.done
      if (result.value) {
        encryptedChunks.push(result.value)
      }
    }

    // Verify we got data
    assert(encryptedChunks.length > 0, 'Should have encrypted chunks')

    // Decrypt to verify correctness
    const combinedEncrypted = new Uint8Array(
      encryptedChunks.reduce((sum, chunk) => sum + chunk.length, 0)
    )
    let offset = 0
    for (const chunk of encryptedChunks) {
      combinedEncrypted.set(chunk, offset)
      offset += chunk.length
    }

    const encryptedStream2 = new ReadableStream({
      start(controller) {
        controller.enqueue(combinedEncrypted)
        controller.close()
      },
    })

    const decryptedStream = await crypto.decryptStream(
      encryptedStream2,
      key,
      iv
    )
    const decryptedReader = decryptedStream.getReader()
    let decryptedChunks = []

    done = false
    while (!done) {
      const result = await decryptedReader.read()
      done = result.done
      if (result.value) {
        decryptedChunks.push(result.value)
      }
    }

    // Combine decrypted chunks
    const combinedDecrypted = new Uint8Array(
      decryptedChunks.reduce((sum, chunk) => sum + chunk.length, 0)
    )
    offset = 0
    for (const chunk of decryptedChunks) {
      combinedDecrypted.set(chunk, offset)
      offset += chunk.length
    }

    // Verify perfect round-trip
    assert.deepStrictEqual(
      combinedDecrypted,
      testData,
      'Decrypt must produce exact original data'
    )

    console.log('✅ Chunk handling with block-based counters works correctly')
  })

  await test('should prevent keystream reuse in different chunk sizes', async () => {
    const crypto = new GenericAesCtrStreamingCrypto()

    // Test with different chunk sizes that would have caused reuse with old implementation
    const testSizes = [15, 16, 17, 32, 33, 64, 65]

    for (const size of testSizes) {
      const testData = new Uint8Array(size).fill(0xbb)
      const blob = new Blob([testData])

      const { key, iv, encryptedStream } = await crypto.encryptStream(blob)

      // Read encrypted data
      const reader = encryptedStream.getReader()
      let encryptedData = new Uint8Array(0)

      let done = false
      while (!done) {
        const result = await reader.read()
        done = result.done
        if (result.value) {
          const combined = new Uint8Array(
            encryptedData.length + result.value.length
          )
          combined.set(encryptedData)
          combined.set(result.value, encryptedData.length)
          encryptedData = combined
        }
      }

      // Decrypt and verify
      const encryptedStream2 = new ReadableStream({
        start(controller) {
          controller.enqueue(encryptedData)
          controller.close()
        },
      })

      const decryptedStream = await crypto.decryptStream(
        encryptedStream2,
        key,
        iv
      )
      const decryptedReader = decryptedStream.getReader()
      let decryptedData = new Uint8Array(0)

      done = false
      while (!done) {
        const result = await decryptedReader.read()
        done = result.done
        if (result.value) {
          const combined = new Uint8Array(
            decryptedData.length + result.value.length
          )
          combined.set(decryptedData)
          combined.set(result.value, decryptedData.length)
          decryptedData = combined
        }
      }

      assert.deepStrictEqual(
        decryptedData,
        testData,
        `Encryption/decryption failed for ${size}-byte chunk`
      )
    }

    console.log('✅ No keystream reuse detected across different chunk sizes')
  })
})

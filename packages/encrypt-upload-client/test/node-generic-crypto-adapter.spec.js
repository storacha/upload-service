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
import {
  stringToUint8Array,
  streamToUint8Array,
  uint8ArrayToString,
} from './helpers/test-file-utils.js'

await describe('GenericAesCtrStreamingCrypto (Node Environment)', async () => {
  await test('should encrypt and decrypt a Blob and return the original data', async () => {
    const adapter = new GenericAesCtrStreamingCrypto()
    const originalText = 'Op, this is a test for streaming encryption!'
    const blob = new Blob([stringToUint8Array(originalText)])

    // Encrypt
    const { key, iv, encryptedStream } = await adapter.encryptStream(blob)

    // Decrypt
    const decryptedStream = await adapter.decryptStream(
      encryptedStream,
      key,
      iv
    )
    const decryptedBytes = await streamToUint8Array(decryptedStream)
    const decryptedText = uint8ArrayToString(decryptedBytes)

    assert.strictEqual(decryptedText, originalText)
  })

  await test('should handle empty data', async () => {
    const adapter = new GenericAesCtrStreamingCrypto()
    const blob = new Blob([])

    const { key, iv, encryptedStream } = await adapter.encryptStream(blob)
    const decryptedStream = await adapter.decryptStream(
      encryptedStream,
      key,
      iv
    )
    const decryptedBytes = await streamToUint8Array(decryptedStream)

    assert.strictEqual(decryptedBytes.length, 0)
  })

  await test('should combine key and IV correctly', async () => {
    const adapter = new GenericAesCtrStreamingCrypto()
    const key = new Uint8Array(32).fill(1) // 32-byte AES-256 key
    const iv = new Uint8Array(16).fill(2) // 16-byte AES-CTR IV

    const combined = adapter.combineKeyAndIV(key, iv)

    assert.strictEqual(
      combined.length,
      48,
      'Combined length should be 48 bytes (32 + 16)'
    )

    // Verify first 32 bytes are the key
    for (let i = 0; i < 32; i++) {
      assert.strictEqual(combined[i], 1, `Key byte ${i} should match`)
    }

    // Verify last 16 bytes are the IV
    for (let i = 32; i < 48; i++) {
      assert.strictEqual(combined[i], 2, `IV byte ${i - 32} should match`)
    }
  })

  await test('should split combined key and IV correctly', async () => {
    const adapter = new GenericAesCtrStreamingCrypto()
    const originalKey = new Uint8Array(32).fill(42)
    const originalIV = new Uint8Array(16).fill(84)

    const combined = adapter.combineKeyAndIV(originalKey, originalIV)
    const { key, iv } = adapter.splitKeyAndIV(combined)

    assert.strictEqual(key.length, 32, 'Split key should be 32 bytes')
    assert.strictEqual(iv.length, 16, 'Split IV should be 16 bytes')

    // Verify key matches
    for (let i = 0; i < 32; i++) {
      assert.strictEqual(
        key[i],
        originalKey[i],
        `Key byte ${i} should match original`
      )
    }

    // Verify IV matches
    for (let i = 0; i < 16; i++) {
      assert.strictEqual(
        iv[i],
        originalIV[i],
        `IV byte ${i} should match original`
      )
    }
  })

  await test('should roundtrip combine/split correctly', async () => {
    const adapter = new GenericAesCtrStreamingCrypto()
    const originalKey = globalThis.crypto.getRandomValues(new Uint8Array(32))
    const originalIV = globalThis.crypto.getRandomValues(new Uint8Array(16))

    const combined = adapter.combineKeyAndIV(originalKey, originalIV)
    const { key, iv } = adapter.splitKeyAndIV(combined)

    assert.deepStrictEqual(
      key,
      originalKey,
      'Roundtrip key should match original'
    )
    assert.deepStrictEqual(iv, originalIV, 'Roundtrip IV should match original')
  })

  await test('should validate key length in combineKeyAndIV', async () => {
    const adapter = new GenericAesCtrStreamingCrypto()
    const wrongKey = new Uint8Array(31) // Wrong size
    const correctIV = new Uint8Array(16)

    assert.throws(
      () => adapter.combineKeyAndIV(wrongKey, correctIV),
      {
        name: 'Error',
        message: 'AES-256 key must be 32 bytes, got 31',
      },
      'Should throw error for wrong key size'
    )
  })

  await test('should validate IV length in combineKeyAndIV', async () => {
    const adapter = new GenericAesCtrStreamingCrypto()
    const correctKey = new Uint8Array(32)
    const wrongIV = new Uint8Array(15) // Wrong size

    assert.throws(
      () => adapter.combineKeyAndIV(correctKey, wrongIV),
      {
        name: 'Error',
        message: 'AES-CTR IV must be 16 bytes, got 15',
      },
      'Should throw error for wrong IV size'
    )
  })

  await test('should validate combined length in splitKeyAndIV', async () => {
    const adapter = new GenericAesCtrStreamingCrypto()
    const wrongCombined = new Uint8Array(47) // Wrong size

    assert.throws(
      () => adapter.splitKeyAndIV(wrongCombined),
      {
        name: 'Error',
        message: 'AES-256-CTR combined key+IV must be 48 bytes, got 47',
      },
      'Should throw error for wrong combined size'
    )
  })
})

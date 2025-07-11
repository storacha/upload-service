import { test, describe } from 'node:test'
import assert from 'node:assert'
import { NodeAesCbcCrypto } from '../src/crypto/symmetric/node-aes-cbc-crypto.js'
import {
  stringToUint8Array,
  uint8ArrayToString,
  streamToUint8Array,
  createMockBlob,
} from './helpers/test-file-utils.js'

await describe('NodeAesCbcCrypto', async () => {
  await test('should encrypt and decrypt data and return the original data', async () => {
    const adapter = new NodeAesCbcCrypto()
    const originalText = 'Hello, this is a test for Node.js AES-CBC encryption!'
    const mockBlob = createMockBlob(stringToUint8Array(originalText))

    // Encrypt
    const { key, iv, encryptedStream } = await adapter.encryptStream(mockBlob)

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
    const adapter = new NodeAesCbcCrypto()
    const mockBlob = createMockBlob(new Uint8Array(0))

    const { key, iv, encryptedStream } = await adapter.encryptStream(mockBlob)
    const decryptedStream = await adapter.decryptStream(
      encryptedStream,
      key,
      iv
    )
    const decryptedBytes = await streamToUint8Array(decryptedStream)

    assert.strictEqual(decryptedBytes.length, 0)
  })

  await test('should combine key and IV correctly', async () => {
    const adapter = new NodeAesCbcCrypto()
    const key = new Uint8Array(32).fill(3) // 32-byte AES-256 key
    const iv = new Uint8Array(16).fill(6) // 16-byte AES-CBC IV

    const combined = adapter.combineKeyAndIV(key, iv)

    assert.strictEqual(
      combined.length,
      48,
      'Combined length should be 48 bytes (32 + 16)'
    )

    // Verify first 32 bytes are the key
    for (let i = 0; i < 32; i++) {
      assert.strictEqual(combined[i], 3, `Key byte ${i} should match`)
    }

    // Verify last 16 bytes are the IV
    for (let i = 32; i < 48; i++) {
      assert.strictEqual(combined[i], 6, `IV byte ${i - 32} should match`)
    }
  })

  await test('should split combined key and IV correctly', async () => {
    const adapter = new NodeAesCbcCrypto()
    const originalKey = new Uint8Array(32).fill(123)
    const originalIV = new Uint8Array(16).fill(234)

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
    const adapter = new NodeAesCbcCrypto()
    const { randomBytes } = await import('crypto')
    // Convert Buffer to Uint8Array to match the expected types
    const originalKey = new Uint8Array(randomBytes(32))
    const originalIV = new Uint8Array(randomBytes(16))

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
    const adapter = new NodeAesCbcCrypto()
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
    const adapter = new NodeAesCbcCrypto()
    const correctKey = new Uint8Array(32)
    const wrongIV = new Uint8Array(15) // Wrong size

    assert.throws(
      () => adapter.combineKeyAndIV(correctKey, wrongIV),
      {
        name: 'Error',
        message: 'AES-CBC IV must be 16 bytes, got 15',
      },
      'Should throw error for wrong IV size'
    )
  })

  await test('should validate combined length in splitKeyAndIV', async () => {
    const adapter = new NodeAesCbcCrypto()
    const wrongCombined = new Uint8Array(47) // Wrong size

    assert.throws(
      () => adapter.splitKeyAndIV(wrongCombined),
      {
        name: 'Error',
        message: 'AES-256-CBC combined key+IV must be 48 bytes, got 47',
      },
      'Should throw error for wrong combined size'
    )
  })

  await test('should use constants for validation', async () => {
    const adapter = new NodeAesCbcCrypto()

    // Test with different wrong sizes to ensure constants are used
    assert.throws(
      () => adapter.combineKeyAndIV(new Uint8Array(16), new Uint8Array(16)),
      /AES-256 key must be 32 bytes, got 16/,
      'Should use KEY_LENGTH constant in error message'
    )

    assert.throws(
      () => adapter.combineKeyAndIV(new Uint8Array(32), new Uint8Array(8)),
      /AES-CBC IV must be 16 bytes, got 8/,
      'Should use IV_LENGTH constant in error message'
    )

    assert.throws(
      () => adapter.splitKeyAndIV(new Uint8Array(32)),
      /AES-256-CBC combined key\+IV must be 48 bytes, got 32/,
      'Should use calculated expected length in error message'
    )
  })
})

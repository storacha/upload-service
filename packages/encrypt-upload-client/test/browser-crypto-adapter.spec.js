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

import { BrowserCryptoAdapter } from '../src/crypto-adapters/browser-crypto-adapter.js'

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

await describe('BrowserCryptoAdapter', async () => {
  await test('should encrypt and decrypt a Blob and return the original data', async () => {
    const adapter = new BrowserCryptoAdapter()
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
    const adapter = new BrowserCryptoAdapter()
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
})

import * as Type from '../../types.js'

const ENCRYPTION_ALGORITHM = 'AES-CTR'
const KEY_LENGTH = 256 // bits
const IV_LENGTH = 16 // bytes (128 bits, used as counter)
const COUNTER_LENGTH = 64 // bits (Web Crypto API default for AES-CTR)

/**
 * GenericAesCtrStreamingCrypto implements TRUE streaming AES-CTR encryption for any JavaScript environment.
 *
 * This implementation:
 * - Uses Web Crypto API (available in both Node.js 16+ and modern browsers)
 * - Emits encrypted chunks immediately without buffering
 * - Supports files of any size with bounded memory usage
 * - Uses TransformStream for clean, standardized streaming
 * - Provides identical results across Node.js and browser environments
 *
 * Key features:
 * - Memory usage: O(1) - constant memory regardless of file size
 * - Supports unlimited file sizes (1TB+)
 * - Cross-platform compatibility (Node.js 16+ and modern browsers)
 * - Clean streaming implementation with automatic resource management
 * - Built-in error handling via TransformStream
 *
 * @class
 * @implements {Type.SymmetricCrypto}
 */
export class GenericAesCtrStreamingCrypto {
  constructor() {
    if (typeof globalThis.crypto === 'undefined') {
      throw new Error('Web Crypto API is not available.')
    }
  }

  /**
   * Generate a random AES key
   *
   * @returns {Promise<Uint8Array>} A random AES key
   */
  async generateKey() {
    return globalThis.crypto.getRandomValues(new Uint8Array(KEY_LENGTH / 8))
  }

  /**
   * Properly increment AES-CTR counter with 128-bit arithmetic
   *
   * @param {Uint8Array} counter - The base counter (16 bytes)
   * @param {number} increment - The value to add
   * @returns {Uint8Array} - New counter with proper carry propagation
   */
  incrementCounter(counter, increment) {
    const result = new Uint8Array(counter)
    let carry = increment

    // Implement proper 128-bit arithmetic with carry propagation
    // Start from the least significant byte (rightmost) and propagate carry
    for (let i = result.length - 1; i >= 0 && carry > 0; i--) {
      const sum = result[i] + carry
      result[i] = sum & 0xff // Keep only the low 8 bits
      carry = sum >> 8 // Carry the high bits to next position
    }

    // Check for counter overflow (extremely unlikely with 128-bit counter)
    if (carry > 0) {
      throw new Error(
        'Counter overflow: exceeded 128-bit limit. This should never happen in practice.'
      )
    }

    return result
  }

  /**
   * Encrypt a stream of data using AES-CTR with TRUE streaming (no buffering).
   *
   * @param {Blob} data The data to encrypt.
   * @returns {Promise<{ key: Uint8Array, iv: Uint8Array, encryptedStream: ReadableStream }>}
   */
  async encryptStream(data) {
    const key = await this.generateKey()
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LENGTH))

    // Pre-import the crypto key for reuse across chunks
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'raw',
      key,
      { name: ENCRYPTION_ALGORITHM },
      false,
      ['encrypt', 'decrypt']
    )

    // State for AES-CTR counter management
    let counter = new Uint8Array(iv) // Copy the IV for counter
    let totalBlocks = 0 // Track total blocks processed

    // Create TransformStream (inspired by Node.js approach)
    const encryptTransform = new TransformStream({
      transform: async (chunk, controller) => {
        try {
          // SECURITY: Calculate counter based on total blocks, not chunks
          const chunkCounter = this.incrementCounter(counter, totalBlocks)

          // SECURITY: Increment by blocks in this chunk (16 bytes per block)
          const blocksInChunk = Math.ceil(chunk.length / 16)
          totalBlocks += blocksInChunk

          // Encrypt chunk using Web Crypto API
          const encrypted = new Uint8Array(
            await globalThis.crypto.subtle.encrypt(
              {
                name: ENCRYPTION_ALGORITHM,
                counter: chunkCounter,
                length: COUNTER_LENGTH,
              },
              cryptoKey,
              chunk
            )
          )

          controller.enqueue(encrypted)
        } catch (error) {
          controller.error(error)
        }
      },
      // Note: No flush needed for AES-CTR (unlike CBC which needs final padding)
    })

    const encryptedStream = data.stream().pipeThrough(encryptTransform)

    return { key, iv, encryptedStream }
  }

  /**
   * Decrypt a stream of data using AES-CTR with TRUE streaming (no buffering).
   *
   * @param {ReadableStream} encryptedData The encrypted data stream.
   * @param {Uint8Array} key The encryption key.
   * @param {Uint8Array} iv The initialization vector (counter).
   * @returns {Promise<ReadableStream>} A stream of decrypted data.
   */
  async decryptStream(encryptedData, key, iv) {
    // Pre-import the crypto key for reuse across chunks
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'raw',
      key,
      { name: ENCRYPTION_ALGORITHM },
      false,
      ['encrypt', 'decrypt']
    )

    // State for AES-CTR counter management
    let counter = new Uint8Array(iv)
    let totalBlocks = 0 // Track total blocks processed (CRITICAL for security)

    const decryptTransform = new TransformStream({
      transform: async (chunk, controller) => {
        try {
          // SECURITY: Calculate counter based on total blocks, not chunks
          const chunkCounter = this.incrementCounter(counter, totalBlocks)

          // SECURITY: Increment by blocks in this chunk (16 bytes per block)
          const blocksInChunk = Math.ceil(chunk.length / 16)
          totalBlocks += blocksInChunk

          // Decrypt chunk using Web Crypto API
          const decrypted = new Uint8Array(
            await globalThis.crypto.subtle.decrypt(
              {
                name: ENCRYPTION_ALGORITHM,
                counter: chunkCounter,
                length: COUNTER_LENGTH,
              },
              cryptoKey,
              chunk
            )
          )
          controller.enqueue(decrypted)
        } catch (error) {
          controller.error(error)
        }
      },
      // Note: No flush needed for AES-CTR (unlike CBC which needs final padding)
    })

    return encryptedData.pipeThrough(decryptTransform)
  }

  /**
   * Combine key and IV into a single array for AES-CTR
   *
   * @param {Uint8Array} key - The AES key (KEY_LENGTH/8 bytes)
   * @param {Uint8Array} iv - The AES-CTR IV (IV_LENGTH bytes)
   * @returns {Uint8Array} Combined key and IV (KEY_LENGTH/8 + IV_LENGTH bytes)
   */
  combineKeyAndIV(key, iv) {
    const keyBytes = KEY_LENGTH / 8
    if (key.length !== keyBytes) {
      throw new Error(
        `AES-${KEY_LENGTH} key must be ${keyBytes} bytes, got ${key.length}`
      )
    }
    if (iv.length !== IV_LENGTH) {
      throw new Error(`AES-CTR IV must be ${IV_LENGTH} bytes, got ${iv.length}`)
    }
    return new Uint8Array([...key, ...iv])
  }

  /**
   * Split combined key and IV for AES-CTR
   *
   * @param {Uint8Array} combined - Combined key and IV (KEY_LENGTH/8 + IV_LENGTH bytes)
   * @returns {{ key: Uint8Array, iv: Uint8Array }} Separated key and IV
   */
  splitKeyAndIV(combined) {
    const keyBytes = KEY_LENGTH / 8
    const expectedLength = keyBytes + IV_LENGTH
    if (combined.length !== expectedLength) {
      throw new Error(
        `AES-${KEY_LENGTH}-CTR combined key+IV must be ${expectedLength} bytes, got ${combined.length}`
      )
    }
    return {
      key: combined.subarray(0, keyBytes),
      iv: combined.subarray(keyBytes, keyBytes + IV_LENGTH),
    }
  }
}

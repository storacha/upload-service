import * as Type from '../../types.js'

const ENCRYPTION_ALGORITHM = 'AES-CTR'
const KEY_LENGTH = 256 // bits
const IV_LENGTH = 16 // bytes (128 bits, used as counter)
const COUNTER_LENGTH = 64 // bits (Web Crypto API default for AES-CTR)

/**
 * BrowserAesCtrCrypto implements AES-CTR symmetric encryption for browser environments.
 * It uses AES-CTR mode for encryption via the Web Crypto API.
 *
 * Why AES-CTR?
 * - We use AES-CTR with pseudo-streaming (buffering chunks before emitting) for simplicity and streaming support.
 * - AES-CTR allows chunked processing without padding, making it suitable for large files and browser environments.
 * - The Web Crypto API supports AES-CTR natively in all modern browsers and in Node.js 19+ as globalThis.crypto.
 * - For Node.js <19, you must polyfill globalThis.crypto (e.g., with `node --experimental-global-webcrypto` or a package like @peculiar/webcrypto).
 * - This allows for processing large files in chunks with no padding issues found in other libraries such as node-forge.
 *
 * Note: This implementation is currently pseudo-streaming: it buffers all encrypted/decrypted chunks before emitting them as a stream.
 * For true streaming (lower memory usage), we need to refactor it to emit each chunk as soon as it is processed.
 *
 * @class
 * @implements {Type.SymmetricCrypto}
 */
export class BrowserAesCtrCrypto {
  async generateKey() {
    return globalThis.crypto.getRandomValues(new Uint8Array(KEY_LENGTH / 8))
  }

  /**
   * Encrypt a stream of data using AES-CTR (chunked, Web Crypto API).
   *
   * @param {Blob} data The data to encrypt.
   * @returns {Promise<{ key: Uint8Array, iv: Uint8Array, encryptedStream: ReadableStream }>}
   */
  async encryptStream(data) {
    const key = await this.generateKey()
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LENGTH))
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'raw',
      key,
      { name: ENCRYPTION_ALGORITHM },
      false,
      ['encrypt', 'decrypt']
    )

    const reader = data.stream().getReader()
    let counter = new Uint8Array(iv) // Copy the IV for counter
    let chunkIndex = 0
    /** @type {Uint8Array[]} */
    const encryptedChunks = []

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      // Increment counter for each chunk
      const chunkCounter = new Uint8Array(counter)
      // For each chunk, increment the last byte of the counter
      chunkCounter[chunkCounter.length - 1] += chunkIndex
      chunkIndex++
      const encrypted = new Uint8Array(
        await globalThis.crypto.subtle.encrypt(
          {
            name: ENCRYPTION_ALGORITHM,
            counter: chunkCounter,
            length: COUNTER_LENGTH,
          },
          cryptoKey,
          value
        )
      )
      encryptedChunks.push(encrypted)
    }

    const encryptedStream = new ReadableStream({
      start(controller) {
        for (const chunk of encryptedChunks) {
          controller.enqueue(chunk)
        }
        controller.close()
      },
    })

    return { key, iv, encryptedStream }
  }

  /**
   * Decrypt a stream of data using AES-CTR (chunked, Web Crypto API).
   *
   * @param {ReadableStream} encryptedData The encrypted data stream.
   * @param {Uint8Array} key The encryption key.
   * @param {Uint8Array} iv The initialization vector (counter).
   * @returns {Promise<ReadableStream>} A stream of decrypted data.
   */
  async decryptStream(encryptedData, key, iv) {
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'raw',
      key,
      { name: ENCRYPTION_ALGORITHM },
      false,
      ['encrypt', 'decrypt']
    )

    const reader = encryptedData.getReader()
    let counter = new Uint8Array(iv)
    let chunkIndex = 0
    /** @type {Uint8Array[]} */
    const decryptedChunks = []

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunkCounter = new Uint8Array(counter)
      chunkCounter[chunkCounter.length - 1] += chunkIndex
      chunkIndex++
      const decrypted = new Uint8Array(
        await globalThis.crypto.subtle.decrypt(
          {
            name: ENCRYPTION_ALGORITHM,
            counter: chunkCounter,
            length: COUNTER_LENGTH,
          },
          cryptoKey,
          value
        )
      )
      decryptedChunks.push(decrypted)
    }

    return new ReadableStream({
      start(controller) {
        for (const chunk of decryptedChunks) {
          controller.enqueue(chunk)
        }
        controller.close()
      },
    })
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

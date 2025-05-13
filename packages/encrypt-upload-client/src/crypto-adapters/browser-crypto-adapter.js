import * as Type from '../types.js'

const ENCRYPTION_ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256 // bits
const IV_LENGTH = 12 // bytes for GCM

/**
 * BrowserCryptoAdapter is a class for the browser.
 * It is used to encrypt and decrypt data using AES-GCM.
 * 
 * @class
 * @implements {Type.CryptoAdapter}
 */
export class BrowserCryptoAdapter {
  async generateKey() {
    return window.crypto.subtle.generateKey(
      { name: ENCRYPTION_ALGORITHM, length: KEY_LENGTH },
      true,
      ['encrypt', 'decrypt']
    )
  }

  /**
   * Encrypt a stream of data using AES-GCM.
   * 
   * @param {Blob} data
   * @returns {Promise<{ key: Uint8Array, iv: Uint8Array, encryptedStream: ReadableStream }>}
   */
  async encryptStream(data) {
    // Generate key and IV
    const symmetricKey = window.crypto.getRandomValues(
      new Uint8Array(KEY_LENGTH / 8)
    )
    const initializationVector = window.crypto.getRandomValues(
      new Uint8Array(IV_LENGTH)
    )
    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      symmetricKey,
      { name: ENCRYPTION_ALGORITHM },
      false,
      ['encrypt', 'decrypt']
    )

    // Buffer all chunks, then encrypt at the end
    const chunks = /** @type {Uint8Array[]} */ ([])
    const reader = data.stream().getReader()

    const encryptedStream = new ReadableStream({
      async start(controller) {
        let value
        while (!( { value } = await reader.read() ).value === undefined) {
          if (value) chunks.push(value)
        }
        // Concatenate all chunks efficiently
        const totalLength = chunks.reduce((acc, val) => acc + val.length, 0)
        const plain = new Uint8Array(totalLength)
        let offset = 0
        for (const chunk of chunks) {
          plain.set(chunk, offset)
          offset += chunk.length
        }
        // Encrypt
        const encrypted = new Uint8Array(
          await window.crypto.subtle.encrypt(
            { name: ENCRYPTION_ALGORITHM, iv: initializationVector },
            cryptoKey,
            plain
          )
        )
        controller.enqueue(encrypted)
        controller.close()
      },
    })

    return {
      key: symmetricKey,
      iv: initializationVector,
      encryptedStream,
    }
  }

  /**
   * Decrypt a stream of data using AES-GCM.
   * 
   * @param {ReadableStream} encryptedData
   * @param {Uint8Array} key
   * @param {Uint8Array} iv
   * @returns {Promise<ReadableStream>}
   */
  async decryptStream(encryptedData, key, iv) {
    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      key,
      { name: ENCRYPTION_ALGORITHM },
      false,
      ['encrypt', 'decrypt']
    )

    const chunks = /** @type {Uint8Array[]} */ ([])
    const reader = encryptedData.getReader()

    return new ReadableStream({
      async start(controller) {
        let value
        while (!( { value } = await reader.read() ).value === undefined) {
          if (value) chunks.push(value)
        }
        // Concatenate all chunks efficiently
        const totalLength = chunks.reduce((acc, val) => acc + val.length, 0)
        const encrypted = new Uint8Array(totalLength)
        let offset = 0
        for (const chunk of chunks) {
          encrypted.set(chunk, offset)
          offset += chunk.length
        }
        // Decrypt
        const decrypted = new Uint8Array(
          await window.crypto.subtle.decrypt(
            { name: ENCRYPTION_ALGORITHM, iv },
            cryptoKey,
            encrypted
          )
        )
        controller.enqueue(decrypted)
        controller.close()
      },
    })
  }
} 
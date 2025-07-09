import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'
import * as Type from '../../types.js'

const ENCRYPTION_ALGORITHM = 'aes-256-cbc'
const KEY_LENGTH = 256 // bits
const IV_LENGTH = 16 // bytes (128 bits, used as initialization vector)

/**
 * NodeAesCbcCrypto implements AES-CBC symmetric encryption for Node.js environments.
 * It uses AES-CBC mode for encryption via the Node.js crypto module.
 * If you already encrypted a file with this class, you still need to use this class to decrypt it.
 *
 * @deprecated Use GenericAesCtrStreamingCrypto instead for new uploads
 * @class
 * @implements {Type.SymmetricCrypto}
 */
export class NodeAesCbcCrypto {
  /** @param {Type.BlobLike} data  */
  async encryptStream(data) {
    const symmetricKey = randomBytes(KEY_LENGTH / 8) // KEY_LENGTH bits for AES
    const initializationVector = randomBytes(IV_LENGTH) // IV_LENGTH bytes for AES

    const cipher = createCipheriv(
      ENCRYPTION_ALGORITHM,
      symmetricKey,
      initializationVector
    )

    const encryptStream = new TransformStream({
      transform: async (chunk, controller) => {
        const encryptedChunk = cipher.update(chunk)
        if (encryptedChunk.length) {
          controller.enqueue(encryptedChunk)
        }
      },
      flush: (controller) => {
        const final = cipher.final()
        if (final.length) {
          controller.enqueue(final)
        }
      },
    })

    return Promise.resolve({
      key: symmetricKey,
      iv: initializationVector,
      encryptedStream: data.stream().pipeThrough(encryptStream),
    })
  }

  /**
   * @param {ReadableStream} encryptedData
   * @param {Uint8Array} key
   * @param {Uint8Array} iv
   */
  async decryptStream(encryptedData, key, iv) {
    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv)

    const decryptor = new TransformStream({
      async transform(chunk, controller) {
        try {
          const decryptedChunk = decipher.update(chunk)
          if (decryptedChunk.length > 0) {
            controller.enqueue(decryptedChunk)
          }
        } catch (err) {
          controller.error(err)
        }
      },
      flush(controller) {
        try {
          const finalChunk = decipher.final()
          if (finalChunk.length > 0) {
            controller.enqueue(finalChunk)
          }
          controller.terminate()
        } catch (err) {
          controller.error(err)
        }
      },
    })

    return Promise.resolve(encryptedData.pipeThrough(decryptor))
  }

  /**
   * Combine key and IV into a single array for AES-CBC
   *
   * @param {Uint8Array} key - The AES key (KEY_LENGTH/8 bytes)
   * @param {Uint8Array} iv - The AES-CBC IV (IV_LENGTH bytes)
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
      throw new Error(`AES-CBC IV must be ${IV_LENGTH} bytes, got ${iv.length}`)
    }
    return new Uint8Array([...key, ...iv])
  }

  /**
   * Split combined key and IV for AES-CBC
   *
   * @param {Uint8Array} combined - Combined key and IV (KEY_LENGTH/8 + IV_LENGTH bytes)
   * @returns {{ key: Uint8Array, iv: Uint8Array }} Separated key and IV
   */
  splitKeyAndIV(combined) {
    const keyBytes = KEY_LENGTH / 8
    const expectedLength = keyBytes + IV_LENGTH
    if (combined.length !== expectedLength) {
      throw new Error(
        `AES-${KEY_LENGTH}-CBC combined key+IV must be ${expectedLength} bytes, got ${combined.length}`
      )
    }
    return {
      key: combined.subarray(0, keyBytes),
      iv: combined.subarray(keyBytes, keyBytes + IV_LENGTH),
    }
  }
}

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

import * as Type from '../types.js'

const ENCRYPTION_ALGORITHM = 'aes-256-cbc';

/** @implements {Type.CryptoAdapter} */
export class NodeCryptoAdapter {
    
    /** @param {Type.BlobLike} data  */
    encryptStream(data) {
        const symmetricKey = randomBytes(32) // 256 bits for AES-256
        const initializationVector = randomBytes(16) // 16 bytes for AES

        const cipher = createCipheriv(ENCRYPTION_ALGORITHM, symmetricKey, initializationVector)

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
                }
            })

        return {
            key: symmetricKey,
            iv: initializationVector,
            encryptedStream: data.stream().pipeThrough(encryptStream),
        }
    }

    /**
     * @param {ReadableStream} encryptedData 
     * @param {Uint8Array} key 
     * @param {Uint8Array} iv 
     */
    decryptStream(encryptedData, key, iv) {
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
                    const finalChunk = decipher.final();
                    if (finalChunk.length > 0) {
                    controller.enqueue(finalChunk)
                    }
                    controller.terminate()
                } catch (err) {
                    controller.error(err)
                }
            }
        })

        return encryptedData.pipeThrough(decryptor);
    }
}
import { createFileEncoderStream } from '@storacha/upload-client/unixfs'
import * as Type from '../types.js'
import { createFileWithMetadata } from './file-metadata.js'

/**
 * Convert an encrypted payload into a stream of CAR blocks, with the encrypted metadata block appended at the end.
 *
 * @param {Type.EncryptionPayload} encryptedPayload - The encrypted payload
 * @param {Type.CryptoAdapter} cryptoAdapter - The crypto adapter for formatting metadata
 * @returns {ReturnType<typeof createFileEncoderStream>} - The link to the uploaded metadata
 */
export const encryptedBlockStream = (encryptedPayload, cryptoAdapter) => {
  const { encryptedKey, metadata, encryptedBlobLike } = encryptedPayload
  /** @type {any} */
  let root
  return createFileEncoderStream(encryptedBlobLike).pipeThrough(
    new TransformStream({
      transform(block, controller) {
        root = block
        controller.enqueue(block)
      },
      async flush(controller) {
        if (!root) throw new Error('missing root block')

        const { cid, bytes } = await cryptoAdapter.encodeMetadata(
          root.cid.toString(),
          encryptedKey,
          metadata
        )

        controller.enqueue({ cid, bytes })
      },
    })
  )
}

/**
 * Encrypt a file with embedded metadata using the crypto adapter and return the encrypted payload.
 * The encrypted payload contains the encrypted file, the encrypted symmetric key, and the metadata.
 *
 * @param {Type.CryptoAdapter} cryptoAdapter - The crypto adapter responsible for performing
 * encryption and decryption operations.
 * @param {Type.BlobLike} file - The file to encrypt
 * @param {Type.EncryptionConfig} encryptionConfig - The encryption configuration
 * @returns {Promise<Type.EncryptionPayload>} - The encrypted file
 */
export const encryptFile = async (cryptoAdapter, file, encryptionConfig) => {
  // Step 1: Embed metadata in file content if provided
  const fileWithMetadata = createFileWithMetadata(
    file,
    encryptionConfig.fileMetadata
  )

  // Step 2: Encrypt the file (with embedded metadata) using the crypto adapter
  const { key, iv, encryptedStream } = await cryptoAdapter.encryptStream(
    fileWithMetadata
  )

  // Step 3: Use crypto adapter to encrypt the symmetric key
  const keyResult = await cryptoAdapter.encryptSymmetricKey(
    key,
    iv,
    encryptionConfig
  )

  // Step 4: Return the encrypted payload (no separate metadata needed)
  return {
    strategy: keyResult.strategy,
    encryptedKey: keyResult.encryptedKey,
    metadata: keyResult.metadata,
    encryptedBlobLike: { stream: () => encryptedStream },
  }
}

import { CARWriterStream } from 'carstream'
import { createFileEncoderStream } from '@storacha/upload-client/unixfs'

import * as Type from '../types.js'

/**
 * Encrypt and upload a file to the Storacha network
 *
 * @param {import('@storacha/client').Client} storachaClient - The Storacha client
 * @param {Type.CryptoAdapter} cryptoAdapter - The crypto adapter responsible for performing
 * encryption and decryption operations.
 * @param {Type.BlobLike} file - The file to upload
 * @param {Type.EncryptionConfig} encryptionConfig - User-provided encryption configuration
 * @returns {Promise<Type.AnyLink>} - The link to the uploaded file
 */
export const encryptAndUpload = async (
  storachaClient,
  cryptoAdapter,
  file,
  encryptionConfig
) => {
  // Step 1: Validate required configuration
  if (!encryptionConfig.spaceDID) throw new Error('No space selected!')

  // Step 2: Encrypt the file using the crypto adapter
  const encryptedPayload = await encryptFile(
    cryptoAdapter,
    file,
    encryptionConfig
  )

  // Step 3: Build and upload the encrypted metadata to the Storacha network
  const rootCid = await buildAndUploadEncryptedMetadata(
    storachaClient,
    encryptedPayload,
    cryptoAdapter
  )

  // Step 4: Return the root CID of the encrypted metadata
  return rootCid
}

/**
 * Upload encrypted metadata to the Storacha network
 *
 * @param {import('@storacha/client').Client} storachaClient - The Storacha client
 * @param {Type.EncryptedPayload} encryptedPayload - The encrypted payload
 * @param {Type.CryptoAdapter} cryptoAdapter - The crypto adapter for formatting metadata
 * @param {object} [options] - The upload options
 * @param {boolean} [options.publishToFilecoin] - Whether to publish the data to Filecoin
 * @returns {Promise<Type.AnyLink>} - The link to the uploaded metadata
 */
const buildAndUploadEncryptedMetadata = async (
  storachaClient,
  encryptedPayload,
  cryptoAdapter,
  options = {
    publishToFilecoin: false,
  }
) => {
  const { encryptedKey, metadata, encryptedBlobLike } =
    encryptedPayload

  return storachaClient.uploadCAR(
    {
      stream() {
        /** @type {any} */
        let root
        return createFileEncoderStream(encryptedBlobLike)
          .pipeThrough(
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
          .pipeThrough(new CARWriterStream())
      },
    },
    {
      // if publishToFilecoin is false, the data won't be published to Filecoin, so we need to set pieceHasher to undefined
      ...(options.publishToFilecoin === false ? { pieceHasher: undefined } : {}),
    }
  )
}

/**
 * Encrypt a file using the crypto adapter and return the encrypted payload.
 * The encrypted payload contains the encrypted file, the encrypted symmetric key, and the metadata.
 * 
 * @param {Type.CryptoAdapter} cryptoAdapter - The crypto adapter responsible for performing
 * encryption and decryption operations.
 * @param {Type.BlobLike} file - The file to encrypt
 * @param {Type.EncryptionConfig} encryptionConfig - The encryption configuration
 * @returns {Promise<Type.EncryptedPayload>} - The encrypted file
 */
const encryptFile = async (
  cryptoAdapter,
  file,
  encryptionConfig
) => {
  // Step 1: Encrypt the file using the crypto adapter
  const { key, iv, encryptedStream } = await cryptoAdapter.encryptStream(file)

  // Step 2: Use crypto adapter to encrypt the symmetric key
  const keyResult = await cryptoAdapter.encryptSymmetricKey(key, iv, encryptionConfig)

  // Step 3: Return the encrypted payload
  return {
    strategy: keyResult.strategy,
    encryptedKey: keyResult.encryptedKey,
    metadata: keyResult.metadata,
    encryptedBlobLike: { stream: () => encryptedStream },
  }
}

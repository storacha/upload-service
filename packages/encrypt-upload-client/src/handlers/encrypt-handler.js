import { CARWriterStream } from 'carstream'

import * as Type from '../types.js'
import { encryptedBlockStream, encryptFile } from '../utils/encrypt.js'

/**
 * Encrypt and upload a file to the Storacha network
 *
 * @param {import('@storacha/client').Client} storachaClient - The Storacha client
 * @param {Type.CryptoAdapter} cryptoAdapter - The crypto adapter responsible for performing
 * encryption and decryption operations.
 * @param {Type.BlobLike} file - The file to upload
 * @param {Type.EncryptionConfig} encryptionConfig - User-provided encryption configuration
 * @param {Type.UploadOptions} [uploadOptions] - User-provided upload options
 * @returns {Promise<Type.AnyLink>} - The link to the uploaded file
 */
export const encryptAndUpload = async (
  storachaClient,
  cryptoAdapter,
  file,
  encryptionConfig,
  uploadOptions = {}
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
    cryptoAdapter,
    uploadOptions
  )

  // Step 4: Return the root CID of the encrypted metadata
  return rootCid
}

/**
 * Upload encrypted metadata to the Storacha network
 *
 * @param {import('@storacha/client').Client} storachaClient - The Storacha client
 * @param {Type.EncryptionPayload} encryptedPayload - The encrypted payload
 * @param {Type.CryptoAdapter} cryptoAdapter - The crypto adapter for formatting metadata
 * @param {Type.UploadOptions} [uploadOptions] - The upload options
 * @returns {Promise<Type.AnyLink>} - The link to the uploaded metadata
 */
const buildAndUploadEncryptedMetadata = async (
  storachaClient,
  encryptedPayload,
  cryptoAdapter,
  uploadOptions
) => {
  return storachaClient.uploadCAR(
    {
      stream() {
        return encryptedBlockStream(
          encryptedPayload,
          cryptoAdapter
        ).pipeThrough(new CARWriterStream())
      },
    },
    {
      ...uploadOptions,
      // the encrypted data won't be published to Filecoin, so we need to set pieceHasher to undefined
      pieceHasher: undefined,
    }
  )
}

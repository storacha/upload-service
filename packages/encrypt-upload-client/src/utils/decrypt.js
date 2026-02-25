import * as Type from '../types.js'
import { extractFileMetadata } from '../utils/file-metadata.js'
import { CID } from 'multiformats'
import { exporter } from 'ipfs-unixfs-exporter'

/**
 *
 * @param {Type.CryptoAdapter} cryptoAdapter
 * @param {import('@storacha/client').Client} storachaClient
 * @param {Type.ReadableStorage} blockstore
 * @param {Type.AnyLink} cid
 * @param {Type.DecryptionConfig} decryptionConfig
 * @returns {Promise<Type.DecryptionResult>} The decrypted file stream with metadata
 */
export async function decryptFile(
  cryptoAdapter,
  storachaClient,
  blockstore,
  cid,
  decryptionConfig
) {
  const bytes = await blockstore.get(/** @type {CID} */ (cid))
  // Step 2: Extract encrypted metadata from the CAR file
  const metadata = cryptoAdapter.viewEncryptedMetadata({
    root: /** @type {import('multiformats').Block} */ ({ cid, bytes }),
  })

  // Step 3: Get the encrypted data from the CAR file
  const encryptedData = await getEncryptedData(
    blockstore,
    metadata.encryptedDataCID
  )

  // Step 4: Decrypt the encrypted symmetric key
  const encryptedSymmetricKey = cryptoAdapter.getEncryptedKey(metadata)
  const { key, iv } = await cryptoAdapter.decryptSymmetricKey(
    encryptedSymmetricKey,
    {
      decryptionConfig,
      metadata,
      resourceCID: cid,
      issuer: storachaClient.agent.issuer,
      audience: storachaClient.defaultProvider(),
    }
  )

  // Step 5: Decrypt the encrypted file content using the decrypted symmetric key and IV
  const decryptedStreamWithMetadata = await decryptFileWithKey(
    cryptoAdapter,
    key,
    iv,
    encryptedData
  )

  // Step 6: Extract file content and metadata
  const { fileStream, fileMetadata } = await extractFileMetadata(
    decryptedStreamWithMetadata
  )

  return {
    stream: fileStream,
    fileMetadata,
  }
}

/**
 * Decrypt file content using the decrypted symmetric key and IV.
 *
 * @param {Type.CryptoAdapter} cryptoAdapter - The crypto adapter responsible for performing
 * encryption and decryption operations.
 * @param {Uint8Array} key - The symmetric key
 * @param {Uint8Array} iv - The initialization vector
 * @param {AsyncIterable<Uint8Array>|Uint8Array} content - The encrypted file content
 * @returns {Promise<ReadableStream>} The decrypted file stream
 */
export async function decryptFileWithKey(cryptoAdapter, key, iv, content) {
  // Convert content to ReadableStream with true on-demand streaming
  /** @type {AsyncIterator<Uint8Array> | null} */
  let iterator = null
  const contentStream = new ReadableStream({
    start() {
      // Initialize iterator for async iterable (no memory loading here)
      if (!(content instanceof Uint8Array)) {
        iterator = content[Symbol.asyncIterator]()
      }
    },
    async pull(controller) {
      try {
        if (content instanceof Uint8Array) {
          // Handle single Uint8Array (legacy case)
          controller.enqueue(content)
          controller.close()
        } else if (iterator) {
          // Handle async iterable - get next chunk on-demand
          const { value, done } = await iterator.next()
          if (done) {
            controller.close()
          } else {
            controller.enqueue(value) // Only load one chunk at a time
          }
        } else {
          controller.close()
        }
      } catch (error) {
        controller.error(error)
      }
    },
    cancel() {
      // Clean up iterator if stream is cancelled
      if (iterator && typeof iterator.return === 'function') {
        void iterator.return()
      }
    },
  })

  const decryptedStream = await cryptoAdapter.decryptStream(
    contentStream,
    key,
    iv
  )

  return decryptedStream
}

/**
 *
 * @param {Type.ReadableStorage} blockstore
 * @param {*} encryptedDataCID
 * @returns
 */
export const getEncryptedData = async (blockstore, encryptedDataCID) => {
  // Step 4: Get the encrypted data from the CAR file
  const encryptedDataEntry = await exporter(
    CID.parse(encryptedDataCID),
    blockstore
  )

  // Step 5: Return the async iterable for streaming
  return encryptedDataEntry.content()
}

import { CID } from 'multiformats'
import { CarIndexer, CarReader } from '@ipld/car'
import { exporter } from 'ipfs-unixfs-exporter'
import { MemoryBlockstore } from 'blockstore-core'

import * as Type from '../types.js'
import { extractFileMetadata } from '../utils/file-metadata.js'

/**
 * Retrieve and decrypt a file from the IPFS gateway using any supported encryption strategy.
 *
 * @param {import('@storacha/client').Client} storachaClient - The Storacha client
 * @param {Type.CryptoAdapter} cryptoAdapter - The crypto adapter responsible for performing
 * encryption and decryption operations.
 * @param {URL} gatewayURL - The IPFS gateway URL
 * @param {Type.AnyLink} cid - The link to the file to retrieve
 * @param {Type.DecryptionConfig} decryptionConfig - User-provided decryption config
 * @returns {Promise<Type.DecryptionResult>} The decrypted file stream with metadata
 */
export const retrieveAndDecrypt = async (
  storachaClient,
  cryptoAdapter,
  gatewayURL,
  cid,
  decryptionConfig
) => {
  // Step 1: Get the encrypted metadata from the public gateway
  const encryptedMetadataCar = await getCarFileFromPublicGateway(
    gatewayURL,
    cid.toString()
  )

  // Step 2: Extract encrypted metadata from the CAR file
  const metadata = cryptoAdapter.extractEncryptedMetadata(encryptedMetadataCar)

  // Step 3: Get the encrypted data from the CAR file
  const encryptedData = await getEncryptedDataFromCar(
    encryptedMetadataCar,
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
 * Fetch a CAR file from the public IPFS gateway with root CID verification.
 *
 * SECURITY: This function provides metadata integrity protection (P0.2).
 * Verifies the returned CAR matches the requested CID to prevent metadata tampering.
 * Content integrity (P2.2) is handled by existing IPFS tools in getEncryptedDataFromCar.
 *
 * @param {URL} gatewayURL - The IPFS gateway URL
 * @param {string} cid - The CID to fetch
 * @returns {Promise<Uint8Array>} The verified CAR file bytes
 */
export const getCarFileFromPublicGateway = async (gatewayURL, cid) => {
  const url = new URL(`/ipfs/${cid}?format=car`, gatewayURL)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `Failed to fetch: ${response.status} ${response.statusText}`
    )
  }

  const car = new Uint8Array(await response.arrayBuffer())

  // SECURITY: Verify the CAR's root CID matches what we requested
  const reader = await CarReader.fromBytes(car)
  const roots = await reader.getRoots()
  const expectedCID = CID.parse(cid)

  if (roots.length !== 1) {
    throw new Error(
      `CAR file must have exactly one root CID, found ${roots.length}`
    )
  }

  if (!roots[0].equals(expectedCID)) {
    throw new Error(
      `CID verification failed: expected ${expectedCID} but CAR contains ${roots[0]}`
    )
  }

  return car
}

/**
 * Extract encrypted data from a CAR file.
 *
 * @param {Uint8Array} car - The CAR file bytes
 * @param {string} encryptedDataCID - The CID of the encrypted data
 * @returns {Promise<Uint8Array>} The encrypted data bytes
 */
const getEncryptedDataFromCar = async (car, encryptedDataCID) => {
  // Step 1: Index the CAR file for efficient block lookup
  const iterable = await CarIndexer.fromBytes(car)
  const blockIndex = new Map()
  for await (const { cid, blockLength, blockOffset } of iterable) {
    blockIndex.set(cid.toString(), { blockOffset, blockLength })
  }

  // Step 2: Use the index to extract the encrypted data block bytes as needed
  const { blockOffset, blockLength } = blockIndex.get(encryptedDataCID)
  const blockBytes = car.subarray(blockOffset, blockOffset + blockLength)

  // Step 3: Put the block in a blockstore for exporter compatibility
  const blockstore = new MemoryBlockstore()
  await blockstore.put(CID.parse(encryptedDataCID), blockBytes)

  // Step 4: Get the encrypted data from the CAR file
  const encryptedDataEntry = await exporter(
    CID.parse(encryptedDataCID),
    blockstore
  )

  // Step 5: Return the async iterable for streaming
  return encryptedDataEntry.content()
}

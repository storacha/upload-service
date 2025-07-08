import { CID } from 'multiformats'
import { CarIndexer, CarReader } from '@ipld/car'
import { exporter } from 'ipfs-unixfs-exporter'
import { MemoryBlockstore } from 'blockstore-core'

import * as Type from '../types.js'

/**
 * Retrieve and decrypt a file from the IPFS gateway using any supported encryption strategy.
 *
 * @param {import('@storacha/client').Client} storachaClient - The Storacha client
 * @param {Type.CryptoAdapter} cryptoAdapter - The crypto adapter responsible for performing
 * encryption and decryption operations.
 * @param {URL} gatewayURL - The IPFS gateway URL
 * @param {Type.AnyLink} cid - The link to the file to retrieve
 * @param {Uint8Array} delegationCAR - The delegation that gives permission to decrypt (required for both strategies)
 * @param {Type.DecryptionOptions} decryptionOptions - User-provided decryption options
 * @returns {Promise<ReadableStream>} The decrypted file stream
 */
export const retrieveAndDecrypt = async (
  storachaClient,
  cryptoAdapter,
  gatewayURL,
  cid,
  delegationCAR,
  decryptionOptions
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
      decryptionOptions,
      metadata,
      delegationCAR,
      resourceCID: cid,
      issuer: storachaClient.agent.issuer,
      audience: storachaClient.defaultProvider(),
    }
  )

  // Step 5: Decrypt the encrypted file content using the decrypted symmetric key and IV
  return decryptFileWithKey(cryptoAdapter, key, iv, encryptedData)
}

/**
 * Decrypt file content using the decrypted symmetric key and IV.
 *
 * @param {Type.CryptoAdapter} cryptoAdapter - The crypto adapter responsible for performing
 * encryption and decryption operations.
 * @param {Uint8Array} key - The symmetric key
 * @param {Uint8Array} iv - The initialization vector
 * @param {Uint8Array} content - The encrypted file content
 * @returns {Promise<ReadableStream>} The decrypted file stream
 */
export function decryptFileWithKey(cryptoAdapter, key, iv, content) {
  const contentStream = new ReadableStream({
    start(controller) {
      controller.enqueue(content)
      controller.close()
    },
  })

  const decryptedStream = cryptoAdapter.decryptStream(contentStream, key, iv)

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
  // Step 1: Convert CAR to a block store
  const iterable = await CarIndexer.fromBytes(car)
  const blockstore = new MemoryBlockstore()

  for await (const { cid, blockLength, blockOffset } of iterable) {
    const blockBytes = car.slice(blockOffset, blockOffset + blockLength)
    await blockstore.put(cid, blockBytes)
  }

  // Step 2: Get the encrypted data from the CAR file
  const encryptedDataEntry = await exporter(
    CID.parse(encryptedDataCID),
    blockstore
  )
  const encryptedDataBytes = new Uint8Array(Number(encryptedDataEntry.size))
  let offset = 0
  for await (const chunk of encryptedDataEntry.content()) {
    encryptedDataBytes.set(chunk, offset)
    offset += chunk.length
  }

  // Step 3: Return the encrypted data bytes
  return encryptedDataBytes
}

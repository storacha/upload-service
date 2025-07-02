import { CID } from 'multiformats'
import { CarIndexer } from '@ipld/car'
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

  // Step 4: Create complete decryption context (adapter creates everything it needs)
  const decryptionContext = await cryptoAdapter.createDecryptionContext({
    decryptionOptions,
    metadata,
    delegationCAR,
    resourceCID: cid,
    issuer: storachaClient.agent.issuer,
    audience: storachaClient.defaultProvider()
  })
  
  // Step 5: Decrypt the symmetric key using the decryption context
  const { key, iv } = await cryptoAdapter.decryptSymmetricKey(
    cryptoAdapter.getEncryptedKey(metadata),
    decryptionContext
  )
  
  // Step 6: Decrypt the encrypted file content using the decrypted symmetric key and IV
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

  // Create a ReadableStream from the Uint8Array
  const contentStream = new ReadableStream({
    start(controller) {
      controller.enqueue(content)
      controller.close()
    },
  })

  const decryptedStream = cryptoAdapter.decryptStream(
    contentStream,
    key,
    iv
  )

  return decryptedStream
}

/**
 * Fetch a CAR file from the IPFS gateway.
 * 
 * @param {URL} gatewayURL - The IPFS gateway URL
 * @param {string} cid - The CID to fetch
 * @returns {Promise<Uint8Array>} The CAR file bytes
 */
const getCarFileFromPublicGateway = async (gatewayURL, cid) => {
  const url = new URL(`/ipfs/${cid}?format=car`, gatewayURL)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `Failed to fetch: ${response.status} ${response.statusText}`
    )
  }

  const car = new Uint8Array(await response.arrayBuffer())
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
  // NOTE: convert CAR to a block store
  const iterable = await CarIndexer.fromBytes(car)
  const blockstore = new MemoryBlockstore()

  for await (const { cid, blockLength, blockOffset } of iterable) {
    const blockBytes = car.slice(blockOffset, blockOffset + blockLength)
    await blockstore.put(cid, blockBytes)
  }

  // NOTE: get the encrypted Data from the CAR file
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

  return encryptedDataBytes
}

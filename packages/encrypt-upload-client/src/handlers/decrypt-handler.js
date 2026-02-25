import { CID } from 'multiformats'
import { CarIndexer, CarReader } from '@ipld/car'
import { MemoryBlockstore } from 'blockstore-core'

import * as Type from '../types.js'
import { decryptFile } from '../utils/decrypt.js'

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

  const blockstore = await makeBlockstoreForCar(
    encryptedMetadataCar,
    cid.toString()
  )

  return decryptFile(
    cryptoAdapter,
    storachaClient,
    blockstore,
    cid,
    decryptionConfig
  )
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
      `Failed to fetch CAR file for CID ${cid} from gateway ${gatewayURL.origin}: ${response.status} ${response.statusText}`
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
 */
const makeBlockstoreForCar = async (car, encryptedDataCID) => {
  // Step 1: Index the CAR file for efficient block lookup
  const iterable = await CarIndexer.fromBytes(car)
  const blockIndex = new Map()
  for await (const { cid, blockLength, blockOffset } of iterable) {
    blockIndex.set(cid.toString(), { blockOffset, blockLength })
  }

  // Step 2: Use the index to extract the encrypted data block bytes as needed
  const blockInfo = blockIndex.get(encryptedDataCID)
  if (!blockInfo) {
    throw new Error(
      `Encrypted data CID ${encryptedDataCID} not found in CAR file. Available CIDs: ${Array.from(
        blockIndex.keys()
      ).join(', ')}`
    )
  }

  // Step 3: Put ALL blocks from CAR into blockstore (not just root)
  const blockstore = new MemoryBlockstore()
  for (const [cidStr, { blockOffset, blockLength }] of blockIndex.entries()) {
    const bytes = car.subarray(blockOffset, blockOffset + blockLength)
    await blockstore.put(CID.parse(cidStr), bytes)
  }

  return blockstore
}

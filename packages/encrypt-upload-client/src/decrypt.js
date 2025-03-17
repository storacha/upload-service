import { ethers } from 'ethers'
import { CID } from 'multiformats'
import { CarIndexer } from '@ipld/car'
import { createDecipheriv } from 'crypto'
import { ReadableStream } from 'stream/web'
import { exporter } from 'ipfs-unixfs-exporter'
import { MemoryBlockstore } from 'blockstore-core'

import * as Lit from './lit.js'
import * as Type from './types.js'
import * as EncryptedMetadata from './encrypted-metadata.js'
import { ENCRYPTION_ALGORITHM } from './config/constants.js'
import { createDecryptWrappedInvocation } from './capability.js'

/**
  * 
  * @param {import('@storacha/client').Client} storachaClient - The Storacha client
  * @param {import('@lit-protocol/lit-node-client').LitNodeClient} litClient - The Lit client
  * @param {URL} gatewayURL - The IPFS gateway URL
  * @param {ethers.Wallet} wallet - The wallet to use to decrypt the file
  * @param {Type.AnyLink} cid - The link to the file to retrieve
  * @param {Uint8Array} delegationCAR - The delegation that gives permission to decrypt the file
  */
export const retrieveAndDecrypt = async(storachaClient, litClient, gatewayURL, wallet, cid, delegationCAR) => {
    const encryptedMetadataCar = await getCarFileFromGateway(gatewayURL, cid)
    const { encryptedDataCID, identityBoundCiphertext, plaintextKeyHash, accessControlConditions } = extractEncryptedMetadata(encryptedMetadataCar)
    const spaceDID = /** @type {`did:key:${string}`} */ (accessControlConditions[0].parameters[1])
    const encryptedData = await getEncryptedDataFromCar(encryptedMetadataCar, encryptedDataCID)

    /**
     * TODO: check if the wallet has capacity credits, if not get it
     */

    // TODO: store the session signature (https://developer.litprotocol.com/intro/first-request/generating-session-sigs#nodejs)
    const sessionSigs = await Lit.getSessionSigs(litClient, {
        wallet,
        dataToEncryptHash: plaintextKeyHash,
        expiration: new Date(Date.now() + 1000 * 60 * 5).toISOString(), // 5 min
        accessControlConditions: /** @type import('@lit-protocol/types').AccessControlConditions */ (
        /** @type {unknown} */ (accessControlConditions)
        ),
    })

    const wrappedInvocation =  await createDecryptWrappedInvocation({
        delegationCAR, 
        spaceDID, 
        resourceCID: cid, 
        issuer: storachaClient.agent.issuer, 
        audience: storachaClient.defaultProvider(),
        expiration: new Date(Date.now() + 1000 * 60 * 10).getTime() // 10 min
    })

    const decryptKey = await Lit.executeUcanValidatoinAction(litClient, {
        sessionSigs,
        spaceDID,
        identityBoundCiphertext,
        plaintextKeyHash,
        accessControlConditions,
        wrappedInvocation
    })

    return decryptFileWithKey(decryptKey, encryptedData)
 }

 /**
 *
 * @param {string} combinedKey
 * @param {Uint8Array} content
 */
export async function decryptFileWithKey(combinedKey, content) {
    // Split the decrypted data back into key and initializationVector
    const decryptedKeyData = Buffer.from(combinedKey, 'base64')
    const symmetricKey = decryptedKeyData.subarray(0, 32)
    const initializationVector = decryptedKeyData.subarray(32)

    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, symmetricKey, initializationVector)

    // Create a ReadableStream from the Uint8Array
    const contentStream = new ReadableStream({
        start(controller) {
        controller.enqueue(content)
        controller.close()
        },
    })

    // Create a TransformStream to handle decryption
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
        },
    })

    // @ts-ignore
    return contentStream.pipeThrough(decryptor)
}

 /**
  * 
  * @param {URL} gatewayURL 
  * @param {string} cid 
  */
const getCarFileFromGateway = async (gatewayURL, cid) => {
    const url = new URL(`/ipfs/${cid}?format=car`, gatewayURL)
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
    }

    const car = new Uint8Array(await response.arrayBuffer())
    return car
}

 /**
  * 
  * @param {Uint8Array} car 
  */
const extractEncryptedMetadata = (car) => {
    const encryptedContentResult = EncryptedMetadata.extract(car)
    if (encryptedContentResult.error) {
        throw encryptedContentResult.error
    }

    let encryptedContent = encryptedContentResult.ok.toJSON()
    return encryptedContent
}

/**
 * 
 * @param {Uint8Array} car 
 * @param {string} encryptedDataCID 
 */
const getEncryptedDataFromCar = async (car, encryptedDataCID) => {
    // NOTE: convert CAR to a block store
    const iterable = await CarIndexer.fromBytes(car)
    const blockstore = new MemoryBlockstore()

    for await (const { cid, blockLength, blockOffset } of iterable) {
      const blockBytes = car.slice(blockOffset, blockOffset + blockLength)
      blockstore.put(cid, blockBytes)
    }

    // NOTE: get the encrypted Data from the CAR file
    const encryptedDataEntry = await exporter(CID.parse(encryptedDataCID), blockstore)
    const encryptedDataBytes = new Uint8Array(Number(encryptedDataEntry.size))
    let offset = 0
    for await (const chunk of encryptedDataEntry.content()) {
      encryptedDataBytes.set(chunk, offset)
      offset += chunk.length
    }

    return encryptedDataBytes
}

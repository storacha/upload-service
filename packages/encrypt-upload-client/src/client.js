import { ethers } from 'ethers'
import { CARWriterStream } from 'carstream'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { encryptString as litEncryptString } from '@lit-protocol/encryption'
import { createFileEncoderStream } from '@storacha/upload-client/unixfs'

import * as Type from './types.js'
import * as EncryptedMetadata from './encrypted-metadata.js'
import { ENCRYPTION_ALGORITHM, STORACHA_LIT_ACTION_CID } from './constants.js'


/** @implements {Type.EncryptedClient} */
export class EncryptedClient {
    /** 
     * @type {import('@storacha/client').Client} 
     * @protected
     */
    _storachaClient

    /** 
     * @type {import('@lit-protocol/lit-node-client').LitNodeClient} 
     * @protected
     */
    _litClient

    /** 
     * @type {URL} 
     * @protected
     */
    _gatewayURL

    /**
     * 
     * @param {import('@storacha/client').Client} storachaClient 
     * @param {import('@lit-protocol/lit-node-client').LitNodeClient} litClient 
     * @param {URL} gatewayURL 
     */
    constructor(storachaClient, litClient, gatewayURL){
        this._storachaClient = storachaClient
        this._litClient = litClient
        this._gatewayURL = gatewayURL
    }

    /**
     * Upload an encrypted file to the Storacha network
     * @param {Type.BlobLike} file - The file to upload
     * @returns {Promise<Type.AnyLink>} - The link to the uploaded file
     */
    async uploadEncryptedFile(file){
        return encryptAndUpload(this._storachaClient, this._litClient, file)
    }
 
    /**
     * Retrieve and decrypt a file from the Storacha network
     * @param {ethers.Wallet} wallet - The wallet to use to decrypt the file
     * @param {Type.AnyLink} cid - The link to the file to retrieve
     * @returns {Promise<ReadableStream>} - The decrypted file
     */
    async retrieveAndDecryptFile(wallet, cid){
       // fetch the file from the Storacha network
       // extract encrypted metadata
       // transform car to blockstore
       // get the encryptedData bytes
       // get capacity credits
       // get session sigs
       // get delegation from storacha client
       // call lit action
       // decrypt the file
       // return the decrypted file as a stream
        return new ReadableStream()
    }
    
    
 }

 /**
  * Encrypt and upload a file to the Storacha network
  * @param {import('@storacha/client').Client} storachaClient - The Storacha client
  * @param {import('@lit-protocol/lit-node-client').LitNodeClient} litClient - The Lit client
  * @param {Type.BlobLike} file - The file to upload
  * @returns {Promise<Type.AnyLink>} - The link to the uploaded file
  */
 export const encryptAndUpload = async (storachaClient, litClient,file) => {
    const spaceDID =  /** @type {Type.SpaceDID | undefined} */ (storachaClient.agent.currentSpace())
    if(!spaceDID) throw new Error('No space selected!')

    const accessControlConditions = getAccessControlConditions(spaceDID)
    const encryptedPayload = await encryptFile(
        litClient,
        file,
        accessControlConditions
    )

    const rootCid = await uploadEncryptedMetadata(storachaClient, encryptedPayload, accessControlConditions)
    return rootCid
 }

 /**
  * Create access control conditions required to use Lit Protocol.
  * This ensures that the Storacha Lit Action is used to validate decryption permissions for the specified space DID.
  * @param {Type.SpaceDID} spaceDID - The DID of the space
  * @returns {import('@lit-protocol/types').AccessControlConditions} - The access control conditions
  */
 export const getAccessControlConditions = (spaceDID) =>  {
    return  [
        {
        contractAddress: '',
        standardContractType: '',
        chain: 'ethereum',
        method: '',
        parameters: [':currentActionIpfsId', spaceDID],
        returnValueTest: {
            comparator: '=',
            value: STORACHA_LIT_ACTION_CID
        }
        }
    ]
 }

 /**
  * Encrypt a file
  * @param {import('@lit-protocol/lit-node-client').LitNodeClient} litClient - The Lit client
  * @param {Type.BlobLike} file - The file to encrypt
  * @param {import('@lit-protocol/types').AccessControlConditions} accessControlConditions - The access control conditions
  * @returns {Promise<Type.EncryptedPayload>} - The encrypted file
  */
 export const encryptFile = async (litClient, file, accessControlConditions) => {
    const {cipher, dataToEncrypt} = createEncryptKey()

    const { ciphertext, dataToEncryptHash } = await litEncryptString(
        { dataToEncrypt, accessControlConditions },
        litClient
    )

    /** @type {Type.BlobLike} */
    const encryptedBlobLike = {
        stream: () => {
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
            return file.stream().pipeThrough(encryptStream)
        }
    }
  
    return {
        identityBoundCiphertext: ciphertext,
        plaintextKeyHash: dataToEncryptHash,
        encryptedBlobLike
    }
 }

 export const createEncryptKey = () => {
    // Generate a random symmetric key and initialization vector
  const symmetricKey = randomBytes(32) // 256 bits for AES-256
  const initializationVector = randomBytes(16) // 16 bytes for AES

  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, symmetricKey, initializationVector)

  // Combine key and initializationVector for Lit encryption
  const dataToEncrypt = Buffer.concat([symmetricKey, initializationVector]).toString('base64')

  return {cipher, dataToEncrypt}
 }

 /**
  * Upload encrypted metadata to the Storacha network
  * @param {import('@storacha/client').Client} storachaClient - The Storacha client
  * @param {Type.EncryptedPayload} encryptedPayload - The encrypted payload
  * @param {import('@lit-protocol/types').AccessControlConditions} accessControlConditions - The access control conditions
  * @returns {Promise<Type.AnyLink>} - The link to the uploaded metadata
  */
 const uploadEncryptedMetadata = async (storachaClient, encryptedPayload, accessControlConditions) => {
    const {identityBoundCiphertext, plaintextKeyHash, encryptedBlobLike} = encryptedPayload

    return  storachaClient.uploadCAR({
        stream () {
          /** @type {any} */
          let root
          return createFileEncoderStream(encryptedBlobLike)
            .pipeThrough(new TransformStream({
              transform (block, controller) {
                root = block
                controller.enqueue(block)
              },
              async flush (controller) {
                if (!root) throw new Error('missing root block')
    
                  /** @type {Type.EncryptedMetadataInput} */
                const uploadData = {
                  encryptedDataCID: root.cid.toString(),
                  identityBoundCiphertext,
                  plaintextKeyHash,
                  accessControlConditions: /** @type {[Record<string, any>]} */ (
                    /** @type {unknown} */ (accessControlConditions)
                  )
                }
    
                const encryptedMetadata = EncryptedMetadata.create(uploadData)
                const { cid, bytes } = await encryptedMetadata.archiveBlock()
                controller.enqueue({ cid, bytes })
              }
            }))
            .pipeThrough(new CARWriterStream())
        }
      })
}
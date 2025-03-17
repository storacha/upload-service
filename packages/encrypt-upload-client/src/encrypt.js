import { CARWriterStream } from 'carstream'
import { createCipheriv, randomBytes } from 'crypto'
import { createFileEncoderStream } from '@storacha/upload-client/unixfs'

import * as Lit from './lit.js'
import * as Type from './types.js'
import * as EncryptedMetadata from './encrypted-metadata.js'
import { ENCRYPTION_ALGORITHM } from './config/constants.js'


/**
  * Encrypt and upload a file to the Storacha network
  * @param {import('@storacha/client').Client} storachaClient - The Storacha client
  * @param {import('@lit-protocol/lit-node-client').LitNodeClient} litClient - The Lit client
  * @param {Type.BlobLike} file - The file to upload
  * @returns {Promise<Type.AnyLink>} - The link to the uploaded file
  */
export const encryptAndUpload = async (storachaClient, litClient, file) => {
    const spaceDID =  /** @type {Type.SpaceDID | undefined} */ (storachaClient.agent.currentSpace())
    if(!spaceDID) throw new Error('No space selected!')

    const accessControlConditions = Lit.getAccessControlConditions(spaceDID)
    const encryptedPayload = await encryptFile(
        litClient,
        file,
        accessControlConditions
    )

    const rootCid = await uploadEncryptedMetadata(storachaClient, encryptedPayload, accessControlConditions)
    return rootCid
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

/**
 * Encrypt a file
 * @param {import('@lit-protocol/lit-node-client').LitNodeClient} litClient - The Lit client
 * @param {Type.BlobLike} file - The file to encrypt
 * @param {import('@lit-protocol/types').AccessControlConditions} accessControlConditions - The access control conditions
 * @returns {Promise<Type.EncryptedPayload>} - The encrypted file
 */
const encryptFile = async (litClient, file, accessControlConditions) => {
    const {cipher, dataToEncrypt} = createEncryptKey()

    const { ciphertext, dataToEncryptHash } = await Lit.encryptString(
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

const createEncryptKey = () => {
    // Generate a random symmetric key and initialization vector
  const symmetricKey = randomBytes(32) // 256 bits for AES-256
  const initializationVector = randomBytes(16) // 16 bytes for AES

  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, symmetricKey, initializationVector)

  // Combine key and initializationVector for Lit encryption
  const dataToEncrypt = Buffer.concat([symmetricKey, initializationVector]).toString('base64')

  /**
   * TODO: use web crypto API. 
   * ISSUE: web crypto does not support streaming encryption. We can hack it using the 'AES-CBC', but this also adds a security risk. We need to evaluate the risk.
   * 
   *   // Generate a random symmetric key and initialization vector
   *   const symmetricKey = crypto.getRandomValues(new Uint8Array(32)) // 256 bits for AES-256
   *   const initializationVector = crypto.getRandomValues(new Uint8Array(16)) // 16 bytes for AES
   * 
   *    const algorithm = { name: 'AES-CBC', length: 256, iv: initializationVector };
   *
   *    const cipher = await crypto.subtle.importKey(
   *        'raw',
   *        symmetricKey,
   *        algorithm,
   *        false, // is extractable ?
   *        ['encrypt', 'decrypt']
   *    );
   * 
   *    // Combine key and initializationVector for Lit encryption
   *    const dataToEncrypt = base64.encode(new Uint8Array([...symmetricKey, ...initializationVector]))
   */

  return {cipher, dataToEncrypt}
}
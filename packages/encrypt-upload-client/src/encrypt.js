import { CARWriterStream } from 'carstream'
import { base64 } from "multiformats/bases/base64"
import { createFileEncoderStream } from '@storacha/upload-client/unixfs'

import * as Lit from './lit.js'
import * as Type from './types.js'
import * as EncryptedMetadata from './encrypted-metadata.js'

/**
  * Encrypt and upload a file to the Storacha network
  * @param {import('@storacha/client').Client} storachaClient - The Storacha client
  * @param {import('@lit-protocol/lit-node-client').LitNodeClient} litClient - The Lit client
  * @param {Type.CryptoAdapter} cryptoAdapter - The crypto adapter responsible for performing
 * encryption and decryption operations.
  * @param {Type.BlobLike} file - The file to upload
  * @returns {Promise<Type.AnyLink>} - The link to the uploaded file
  */
export const encryptAndUpload = async (storachaClient, litClient, cryptoAdapter, file) => {
    const spaceDID =  /** @type {Type.SpaceDID | undefined} */ (storachaClient.agent.currentSpace())
    if(!spaceDID) throw new Error('No space selected!')

    const accessControlConditions = Lit.getAccessControlConditions(spaceDID)

    const encryptedPayload = await encryptFile(
      litClient,
      cryptoAdapter,
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
 * @param {Type.CryptoAdapter} cryptoAdapter - The crypto adapter responsible for performing
 * encryption and decryption operations.
 * @param {Type.BlobLike} file - The file to encrypt
 * @param {import('@lit-protocol/types').AccessControlConditions} accessControlConditions - The access control conditions
 * @returns {Promise<Type.EncryptedPayload>} - The encrypted file
 */
const encryptFile = async (litClient, cryptoAdapter, file, accessControlConditions) => {
    const {key, iv, encryptedStream } = cryptoAdapter.encryptStream(file)

    // Combine key and initializationVector for Lit encryption
    const dataToEncrypt = base64.encode(new Uint8Array([...key, ...iv]))

    const { ciphertext, dataToEncryptHash } = await Lit.encryptString(
      { dataToEncrypt, accessControlConditions },
      litClient
    )

    return {
      identityBoundCiphertext: ciphertext,
      plaintextKeyHash: dataToEncryptHash,
      encryptedBlobLike: {stream: () => encryptedStream}
    }
}

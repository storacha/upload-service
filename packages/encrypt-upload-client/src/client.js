import { ethers } from 'ethers'
import { ReadableStream } from 'stream/web'

import * as Type from './types.js'
import { encryptAndUpload } from './encrypt.js'
import { retrieveAndDecrypt } from './decrypt.js'

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
     * @param {Uint8Array} delegationCAR - The delegation that gives permission to decrypt the file
     * @returns {Promise<ReadableStream>} - The decrypted file
     */
    async retrieveAndDecryptFile(wallet, cid, delegationCAR){
      return retrieveAndDecrypt(this._storachaClient, this._litClient, this._gatewayURL, wallet, cid, delegationCAR)
    }
 }

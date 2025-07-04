import * as Type from '../types.js'
import { GATEWAY_URL } from '../config/constants.js'
import { encryptAndUpload } from '../handlers/encrypt-handler.js'
import { retrieveAndDecrypt } from '../handlers/decrypt-handler.js'

/** @implements {Type.EncryptedClient} */
export class EncryptedClient {
  /**
   * @type {Type.CryptoAdapter}
   * @protected
   */
  _cryptoAdapter

  /**
   * @type {import('@storacha/client').Client}
   * @protected
   */
  _storachaClient

  /**
   * @type {URL}
   * @protected
   */
  _gatewayURL

  /**
   * @param {import('@storacha/client').Client} storachaClient
   * @param {Type.CryptoAdapter} cryptoAdapter
   * @param {URL} gatewayURL
   */
  constructor(storachaClient, cryptoAdapter, gatewayURL) {
    this._storachaClient = storachaClient
    this._cryptoAdapter = cryptoAdapter
    this._gatewayURL = gatewayURL
  }

  /**
   * Encrypt and upload a file to the Storacha network
   *
   * @param {Type.BlobLike} file - The file to upload
   * @param {Type.EncryptionConfig} encryptionConfig - User-provided encryption configuration
   * @returns {Promise<Type.AnyLink>} - The link to the uploaded file
   */
  async encryptAndUploadFile(file, encryptionConfig) {
    return encryptAndUpload(
      this._storachaClient,
      this._cryptoAdapter,
      file,
      encryptionConfig
    )
  }

  /**
   * Retrieve and decrypt a file from the Storacha network
   *
   * @param {Type.AnyLink} cid - The link to the file to retrieve
   * @param {Uint8Array} delegationCAR - The delegation that gives permission to decrypt (required for both strategies)
   * @param {Type.DecryptionOptions} decryptionOptions - User-provided decryption options
   * @returns {Promise<ReadableStream>} - The decrypted file
   */
  async retrieveAndDecryptFile(cid, delegationCAR, decryptionOptions) {
    return retrieveAndDecrypt(
      this._storachaClient,
      this._cryptoAdapter,
      this._gatewayURL,
      cid,
      delegationCAR,
      decryptionOptions
    )
  }
}

/**
 * Creates a new EncryptedClient.
 *
 * If no Gateway URL is provided, the default value of 'https://w3s.link' will be used.
 *
 * @param {Type.EncryptedClientOptions} options
 */
export const create = async (options) => {
  const cryptoAdapter = options.cryptoAdapter
  const gatewayURL = options.gatewayURL ?? GATEWAY_URL
  const storachaClient = options.storachaClient

  return new EncryptedClient(storachaClient, cryptoAdapter, gatewayURL)
}

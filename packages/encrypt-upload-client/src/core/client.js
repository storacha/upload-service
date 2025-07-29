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
   * @param {Type.UploadOptions} [uploadOptions] - User-provided upload options
   * @returns {Promise<Type.AnyLink>} - The link to the uploaded file
   */
  async encryptAndUploadFile(file, encryptionConfig, uploadOptions = {}) {
    return encryptAndUpload(
      this._storachaClient,
      this._cryptoAdapter,
      file,
      encryptionConfig,
      uploadOptions
    )
  }

  /**
   * Retrieve and decrypt a file from the Storacha network
   *
   * @param {Type.AnyLink} cid - The link to the file to retrieve
   * @param {Type.DecryptionConfig} decryptionConfig - User-provided decryption config
   * @returns {Promise<Type.DecryptionResult>} - The decrypted file with metadata
   */
  async retrieveAndDecryptFile(cid, decryptionConfig) {
    return retrieveAndDecrypt(
      this._storachaClient,
      this._cryptoAdapter,
      this._gatewayURL,
      cid,
      decryptionConfig
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

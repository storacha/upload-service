import * as Type from '../types.js'
import { getLitClient } from '../protocols/lit.js'
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
   * @param {import('@storacha/client').Client} storachaClient
   * @param {Type.CryptoAdapter} cryptoAdapter
   * @param {import('@lit-protocol/lit-node-client').LitNodeClient} litClient
   * @param {URL} gatewayURL
   */
  constructor(storachaClient, cryptoAdapter, litClient, gatewayURL) {
    this._storachaClient = storachaClient
    this._cryptoAdapter = cryptoAdapter
    this._litClient = litClient
    this._gatewayURL = gatewayURL
  }

  /**
   * Upload an encrypted file to the Storacha network
   *
   * @param {Type.BlobLike} file - The file to upload
   * @returns {Promise<Type.AnyLink>} - The link to the uploaded file
   */
  async uploadEncryptedFile(file) {
    return encryptAndUpload(
      this._storachaClient,
      this._litClient,
      this._cryptoAdapter,
      file
    )
  }

  /**
   * Retrieve and decrypt a file from the Storacha network
   *
   * @param {Type.LitWalletSigner | Type.LitPkpSigner} signer - The wallet or PKP key signer to decrypt the file
   * @param {Type.AnyLink} cid - The link to the file to retrieve
   * @param {Uint8Array} delegationCAR - The delegation that gives permission to decrypt the file
   * @returns {Promise<ReadableStream>} - The decrypted file
   */
  async retrieveAndDecryptFile(signer, cid, delegationCAR) {
    return retrieveAndDecrypt(
      this._storachaClient,
      this._litClient,
      this._cryptoAdapter,
      this._gatewayURL,
      signer,
      cid,
      delegationCAR
    )
  }
}

/**
 * Creates a new EncryptClient.
 *
 * If no Lit Client is provided, one will be created based on the LIT_NETWORK environment variable, defaulting to "DatilTest" if not set.
 *
 * If no Gateway URL is provided, the default value of 'https://w3s.link' will be used.
 *
 * @param {Type.EncryptedClientOptions} options
 */
export const create = async (options) => {
  const litClient = options.litClient ?? (await getLitClient())
  const cryptoAdapter = options.cryptoAdapter
  const gatewayURL = options.gatewayURL ?? GATEWAY_URL
  const storachaClient = options.storachaClient

  return new EncryptedClient(
    storachaClient,
    cryptoAdapter,
    litClient,
    gatewayURL
  )
}

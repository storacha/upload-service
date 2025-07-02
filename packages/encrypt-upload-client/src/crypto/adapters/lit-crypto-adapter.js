import { base64 } from 'multiformats/bases/base64'
import * as Lit from '../../protocols/lit.js'
import * as EncryptedMetadata from '../../core/encrypted-metadata.js'
import * as Type from '../../types.js'

/**
 * LitCryptoAdapter implements the complete CryptoAdapter interface using Lit Protocol.
 * It uses composition with a SymmetricCrypto implementation for file encryption/decryption
 * and Lit Protocol for key management operations.
 *
 * @class
 * @implements {Type.CryptoAdapter}
 */
export class LitCryptoAdapter {
  /**
   * Create a new Lit crypto adapter
   * 
   * @param {Type.SymmetricCrypto} symmetricCrypto - The symmetric crypto implementation (browser or node)
   * @param {import('@lit-protocol/lit-node-client').LitNodeClient} litClient - The Lit client instance
   */
  constructor(symmetricCrypto, litClient) {
    this.symmetricCrypto = symmetricCrypto
    this.litClient = litClient
  }

  /**
   * Encrypt a stream of data using the symmetric crypto implementation
   * 
   * @param {Type.BlobLike} data - The data to encrypt
   * @returns {Promise<Type.EncryptOutput>} - The encrypted data
   */
  async encryptStream(data) {
    return this.symmetricCrypto.encryptStream(data)
  }

  /**
   * Decrypt a stream of data using the symmetric crypto implementation
   * 
   * @param {ReadableStream} encryptedData - The encrypted data to decrypt
   * @param {Uint8Array} key - The key to use for decryption
   * @param {Uint8Array} iv - The initialization vector to use for decryption
   * @returns {Promise<ReadableStream>} - The decrypted data
   */
  async decryptStream(encryptedData, key, iv) {
    return this.symmetricCrypto.decryptStream(encryptedData, key, iv)
  }

  /**
   * Create an encryption context for the Lit crypto adapter
   * 
   * @param {Type.EncryptionOptions} encryptionOptions - The encryption options
   * @returns {Promise<Type.EncryptionContext>} - The encryption context
   */
  async createEncryptionContext(encryptionOptions) {
    const { spaceDID, spaceAccessProof } = encryptionOptions
    const accessControlConditions = Lit.getAccessControlConditions(spaceDID)
    return {
      spaceDID,
      accessControlConditions,
      litClient: this.litClient,
      spaceAccessProof,
      // Include any other adapter-created context as needed
    }
  }

  /**
   * Create a decryption context for the Lit crypto adapter
   * 
   * @param {Type.DecryptionOptions} decryptionOptions - The decryption options
   * @returns {Promise<Type.DecryptionContext>} - The decryption context
   */
  async createDecryptionContext(decryptionOptions) {
    return {
      litClient: this.litClient,
      sessionSigs: decryptionOptions.sessionSigs,
      // Include any other adapter-created context as needed
    }
  }

  /**
   * Encrypt a symmetric key using the Lit crypto adapter
   * 
   * @param {Uint8Array} combinedKeyAndIV - The key and initialization vector to encrypt
   * @param {Type.EncryptionContext} encryptionContext - The encryption context
   * @returns {Promise<Type.EncryptedKeyResult>} - The encrypted key result
   */
  async encryptSymmetricKey(combinedKeyAndIV, encryptionContext) {
    const dataToEncrypt = base64.encode(combinedKeyAndIV)

    const { ciphertext, dataToEncryptHash } = await Lit.encryptString({
      dataToEncrypt,
      accessControlConditions: encryptionContext.accessControlConditions,
    }, this.litClient)

    return {
      strategy: /** @type {'lit'} */ ('lit'),
      encryptedKey: ciphertext,
      metadata: {
        plaintextKeyHash: dataToEncryptHash,
        accessControlConditions: /** @type {Type.GenericAccessControlCondition} */ (encryptionContext.accessControlConditions),
      },
    }
  }

  /**
   * Decrypt a symmetric key using the Lit crypto adapter
   * 
   * @param {string} encryptedKey - The encrypted key to decrypt
   * @param {Type.DecryptionContext} decryptionContext - The decryption context
   * @returns {Promise<Uint8Array>} - The decrypted key
   */
  async decryptSymmetricKey(
    encryptedKey,
    { wallet, sessionSigs, delegationCAR }
  ) {
    // CLIENT-SIDE: Decrypt locally with Lit
    const decryptedString = await Lit.decryptString({
      ciphertext: encryptedKey,
      sessionSigs,
      litClient: this.litClient,
    })

    // Lit returns a base64-encoded string, so decode it to Uint8Array
    return base64.decode(decryptedString)
  }

  /**
   * Extract encrypted metadata from a CAR file
   * 
   * @param {Uint8Array} car - The CAR file to extract metadata from
   * @returns {Type.ExtractedMetadata} - The extracted metadata
   */
  extractEncryptedMetadata(car) {
    const encryptedContentResult = EncryptedMetadata.extract(car)
    if (encryptedContentResult.error) {
      throw encryptedContentResult.error
    }

    const encryptedContent = encryptedContentResult.ok.toJSON()
    
    // Validate it's Lit format
    if (!encryptedContent.identityBoundCiphertext || !encryptedContent.accessControlConditions) {
      throw new Error('Invalid Lit Protocol metadata format - missing identityBoundCiphertext or accessControlConditions')
    }
    
    // Return with strategy identifier
    return {
      strategy: /** @type {'lit'} */ ('lit'),
      encryptedDataCID: encryptedContent.encryptedDataCID,
      identityBoundCiphertext: encryptedContent.identityBoundCiphertext,
      plaintextKeyHash: encryptedContent.plaintextKeyHash,
      accessControlConditions: encryptedContent.accessControlConditions,
    }
  }

  /**
   * Get the encrypted key from the metadata
   * 
   * @param {Type.ExtractedMetadata} metadata - The metadata to get the encrypted key from
   * @returns {string} - The encrypted key
   */
  getEncryptedKey(metadata) {
    return metadata.identityBoundCiphertext
  }

  /**
   * Encode metadata for upload
   * 
   * @param {string} encryptedDataCID - The CID of the encrypted data
   * @param {string} encryptedKey - The encrypted key
   * @param {Type.LitKeyMetadata} metadata - The metadata to encode
   * @returns {Promise<{ cid: import('@storacha/upload-client/types').AnyLink, bytes: Uint8Array }>} - The encoded metadata
   */
  async encodeMetadata(encryptedDataCID, encryptedKey, metadata) {
    const litMetadata = /** @type {Type.LitKeyMetadata} */ (metadata)
    
    /** @type {Type.EncryptedMetadataInput} */
    const uploadData = {
      encryptedDataCID,
      identityBoundCiphertext: encryptedKey,
      plaintextKeyHash: litMetadata.plaintextKeyHash,
      accessControlConditions: 
        /** @type import('@lit-protocol/types').AccessControlConditions */ (
          /** @type {unknown} */ (litMetadata.accessControlConditions)
        ),
    }

    const encryptedMetadata = EncryptedMetadata.create(uploadData)
    return await encryptedMetadata.archiveBlock()
  }
} 
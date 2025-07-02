import { base64 } from 'multiformats/bases/base64'
import * as Lit from '../../protocols/lit.js'
import * as EncryptedMetadata from '../../core/encrypted-metadata.js'
import { createDecryptWrappedInvocation } from '../../utils.js'
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
   * @param {object} params - The decryption parameters
   * @param {Type.DecryptionOptions} params.decryptionOptions - The decryption options
   * @param {Type.ExtractedMetadata} params.metadata - The extracted metadata
   * @param {Uint8Array} params.delegationCAR - The delegation CAR
   * @param {Type.AnyLink} params.resourceCID - The resource CID
   * @param {import('@storacha/client/types').Signer<import('@storacha/client/types').DID, import('@storacha/client/types').SigAlg>} params.issuer - The issuer
   * @param {import('@storacha/client/types').DID} params.audience - The audience
   * @returns {Promise<Type.DecryptionContext>} - The decryption context
   */
  async createDecryptionContext(params) {
    const {
      decryptionOptions,
      metadata,
      delegationCAR,
      resourceCID,
      issuer,
      audience
    } = params

    // Validate Lit metadata
    if (metadata.strategy !== 'lit') {
      throw new Error('LitCryptoAdapter can only handle Lit metadata')
    }

    const { plaintextKeyHash, accessControlConditions } = metadata
    
    // Extract spaceDID from access control conditions (following original implementation)
    const spaceDID = /** @type {Type.SpaceDID} */ (
      accessControlConditions[0].parameters[1]
    )

    // Create session signatures if not provided
    let sessionSigs = decryptionOptions.sessionSigs
    if (!sessionSigs) {
      const acc = /** @type import('@lit-protocol/types').AccessControlConditions */ (
        /** @type {unknown} */ (accessControlConditions)
      )
      const expiration = new Date(Date.now() + 1000 * 60 * 5).toISOString() // 5 min
      
      if (decryptionOptions.wallet) {
        sessionSigs = await Lit.getSessionSigs(this.litClient, {
          wallet: decryptionOptions.wallet,
          dataToEncryptHash: plaintextKeyHash,
          expiration,
          accessControlConditions: acc,
        })
      } else if (decryptionOptions.pkpPublicKey && decryptionOptions.authMethod) {
        sessionSigs = await Lit.getPkpSessionSigs(this.litClient, {
          pkpPublicKey: decryptionOptions.pkpPublicKey,
          authMethod: decryptionOptions.authMethod,
          dataToEncryptHash: plaintextKeyHash,
          expiration,
          accessControlConditions: acc,
        })
      } else {
        throw new Error('Session signatures or signer (wallet/PKP) required for Lit decryption')
      }
    }

    // Create wrapped UCAN invocation (Lit-specific)
    const wrappedInvocationJSON = await createDecryptWrappedInvocation({
      delegationCAR,
      spaceDID,
      resourceCID,
      issuer,
      audience,
      expiration: new Date(Date.now() + 1000 * 60 * 10).getTime(), // 10 min
    })

    return {
      litClient: this.litClient,
      sessionSigs,
      spaceDID,
      plaintextKeyHash,
      accessControlConditions,
      wrappedInvocationJSON,
    }
  }

  /**
   * Encrypt a symmetric key using the Lit crypto adapter
   * 
   * @param {Uint8Array} key - The symmetric key to encrypt
   * @param {Uint8Array} iv - The initialization vector to encrypt
   * @param {Type.EncryptionContext} encryptionContext - The encryption context
   * @returns {Promise<Type.EncryptedKeyResult>} - The encrypted key result
   */
  async encryptSymmetricKey(key, iv, encryptionContext) {
    const combinedKeyAndIV = this.symmetricCrypto.combineKeyAndIV(key, iv)
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
        accessControlConditions: /** @type {import('@lit-protocol/types').AccessControlConditions} */ (encryptionContext.accessControlConditions),
      },
    }
  }

  /**
   * Decrypt a symmetric key using the Lit crypto adapter
   * 
   * @param {string} encryptedKey - The encrypted key to decrypt
   * @param {Type.DecryptionContext} decryptionContext - The decryption context
   * @returns {Promise<{ key: Uint8Array, iv: Uint8Array }>} - The decrypted key and IV
   */
  async decryptSymmetricKey(
    encryptedKey,
    decryptionContext
  ) {
    // Validate that all required context was created
    if (!decryptionContext.sessionSigs) {
      throw new Error('Session signatures not available in decryption context')
    }
    if (!decryptionContext.spaceDID) {
      throw new Error('Space DID not available in decryption context')
    }
    if (!decryptionContext.plaintextKeyHash) {
      throw new Error('Plaintext key hash not available in decryption context')
    }
    if (!decryptionContext.accessControlConditions) {
      throw new Error('Access control conditions not available in decryption context')
    }
    if (!decryptionContext.wrappedInvocationJSON) {
      throw new Error('Wrapped invocation JSON not available in decryption context')
    }

    // All preparation is done in createDecryptionContext, just execute the Lit Action
    const decryptedString = await Lit.executeUcanValidationAction(this.litClient, {
      sessionSigs: decryptionContext.sessionSigs,
      spaceDID: decryptionContext.spaceDID,
      identityBoundCiphertext: encryptedKey,
      plaintextKeyHash: decryptionContext.plaintextKeyHash,
      accessControlConditions: decryptionContext.accessControlConditions,
      wrappedInvocationJSON: decryptionContext.wrappedInvocationJSON,
    })

    // Lit Action returns a base64-encoded string, so decode it to Uint8Array
    const combinedKeyAndIV = base64.decode(decryptedString)
    
    // Use symmetric crypto to split the combined key and IV
    return this.symmetricCrypto.splitKeyAndIV(combinedKeyAndIV)
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
    if (metadata.strategy !== 'lit') {
      throw new Error('LitCryptoAdapter can only handle Lit metadata')
    }
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
      accessControlConditions: litMetadata.accessControlConditions,
    }

    const encryptedMetadata = EncryptedMetadata.create(uploadData)
    return await encryptedMetadata.archiveBlock()
  }
} 
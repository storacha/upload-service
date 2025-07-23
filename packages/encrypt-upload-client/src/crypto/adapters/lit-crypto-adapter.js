import { base64 } from 'multiformats/bases/base64'
import * as Lit from '../../protocols/lit.js'
import * as EncryptedMetadata from '../../core/metadata/encrypted-metadata.js'
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
   * Encrypt a symmetric key using the Lit crypto adapter
   *
   * @param {Uint8Array} key - The symmetric key to encrypt
   * @param {Uint8Array} iv - The initialization vector to encrypt
   * @param {Type.EncryptionConfig} encryptionConfig - The encryption configuration
   * @returns {Promise<Type.EncryptedKeyResult>} - The encrypted key result
   */
  async encryptSymmetricKey(key, iv, encryptionConfig) {
    // Step 1. Combine key and IV to encrypt a single string
    const combinedKeyAndIV = this.symmetricCrypto.combineKeyAndIV(key, iv)

    // Step 2. Create access control conditions and encrypt with Lit
    const { spaceDID } = encryptionConfig
    const accessControlConditions = Lit.getAccessControlConditions(spaceDID)

    // Step 3. Encrypt the base64 encoded combined key and IV with Lit
    const dataToEncrypt = base64.encode(combinedKeyAndIV)
    const { ciphertext, dataToEncryptHash } = await Lit.encryptString(
      {
        dataToEncrypt,
        accessControlConditions,
      },
      this.litClient
    )

    // Step 4. Return the encrypted key and metadata
    return {
      strategy: /** @type {'lit'} */ ('lit'),
      encryptedKey: ciphertext,
      metadata: {
        plaintextKeyHash: dataToEncryptHash,
        accessControlConditions:
          /** @type {import('@lit-protocol/types').AccessControlConditions} */ (
            accessControlConditions
          ),
      },
    }
  }

  /**
   * Decrypt a symmetric key using the Lit crypto adapter
   *
   * @param {string} encryptedKey - The encrypted key to decrypt
   * @param {object} configs - The decryption configuration
   * @param {Type.DecryptionConfig} configs.decryptionConfig - The decryption config
   * @param {Type.ExtractedMetadata} configs.metadata - The extracted metadata
   * @param {import('@ucanto/interface').Proof} configs.decryptDelegation - The delegation that gives permission to decrypt (required for both strategies)
   * @param {Type.AnyLink} configs.resourceCID - The resource CID
   * @param {import('@storacha/client/types').Signer<import('@storacha/client/types').DID, import('@storacha/client/types').SigAlg>} configs.issuer - The issuer
   * @param {import('@storacha/client/types').DID} configs.audience - The audience
   * @returns {Promise<{ key: Uint8Array, iv: Uint8Array }>} - The decrypted key and IV
   */
  async decryptSymmetricKey(encryptedKey, configs) {
    const { decryptionConfig, metadata, resourceCID, issuer, audience } =
      configs

    // Validate Lit metadata
    if (metadata.strategy !== 'lit') {
      throw new Error('LitCryptoAdapter can only handle Lit metadata')
    }

    const { plaintextKeyHash, accessControlConditions } = metadata

    // Step 1. Extract spaceDID from access control conditions
    const spaceDID = /** @type {Type.SpaceDID} */ (
      accessControlConditions[0].parameters[1]
    )

    // Step 2. Create session signatures if not provided
    let sessionSigs = decryptionConfig.sessionSigs
    if (!sessionSigs) {
      const acc =
        /** @type import('@lit-protocol/types').AccessControlConditions */ (
          /** @type {unknown} */ (accessControlConditions)
        )
      const expiration = new Date(Date.now() + 1000 * 60 * 5).toISOString() // 5 min

      // Step 2.1. Create session signatures for the wallet if provided
      if (decryptionConfig.wallet) {
        sessionSigs = await Lit.getSessionSigs(this.litClient, {
          wallet: decryptionConfig.wallet,
          dataToEncryptHash: plaintextKeyHash,
          expiration,
          accessControlConditions: acc,
        })
      }
      // Step 2.2. Otherwise, create session signatures for the PKP if provided
      else if (decryptionConfig.pkpPublicKey && decryptionConfig.authMethod) {
        sessionSigs = await Lit.getPkpSessionSigs(this.litClient, {
          pkpPublicKey: decryptionConfig.pkpPublicKey,
          authMethod: decryptionConfig.authMethod,
          dataToEncryptHash: plaintextKeyHash,
          expiration,
          accessControlConditions: acc,
        })
      } else {
        throw new Error(
          'Session signatures or signer (wallet/PKP) required for Lit decryption'
        )
      }
    }

    // Step 3. Create wrapped UCAN invocation
    const wrappedInvocationJSON = await createDecryptWrappedInvocation({
      decryptDelegation: decryptionConfig.decryptDelegation,
      spaceDID,
      resourceCID,
      issuer,
      audience,
      expiration: new Date(Date.now() + 1000 * 60 * 10).getTime(), // 10 min
    })

    // Step 4. Execute the Lit Action with all the prepared context to decrypt the symmetric key
    const decryptedString = await Lit.executeUcanValidationAction(
      this.litClient,
      {
        sessionSigs,
        spaceDID,
        identityBoundCiphertext: encryptedKey,
        plaintextKeyHash,
        accessControlConditions,
        wrappedInvocationJSON,
      }
    )

    // Step 5. Lit Action returns a base64-encoded string, so decode it to Uint8Array
    const combinedKeyAndIV = base64.decode(decryptedString)

    // Step 6. Use symmetric crypto to split the combined key and IV
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
    if (
      !encryptedContent.identityBoundCiphertext ||
      !encryptedContent.accessControlConditions
    ) {
      throw new Error(
        'Invalid Lit Protocol metadata format - missing identityBoundCiphertext or accessControlConditions'
      )
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

    /** @type {Type.LitMetadataInput} */
    const uploadData = {
      encryptedDataCID,
      identityBoundCiphertext: encryptedKey,
      plaintextKeyHash: litMetadata.plaintextKeyHash,
      accessControlConditions: litMetadata.accessControlConditions,
    }

    const encryptedMetadata = EncryptedMetadata.create('lit', uploadData)
    return await encryptedMetadata.archiveBlock()
  }
}

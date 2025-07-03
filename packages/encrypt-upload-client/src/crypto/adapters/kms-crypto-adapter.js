import { connect } from '@ucanto/client'
import { CAR, HTTP } from '@ucanto/transport'
import { base64 } from 'multiformats/bases/base64'
import * as Type from '../../types.js'
import * as Space from '@storacha/capabilities/space'
import * as KMSMetadata from '../../core/kms-metadata.js'

/**
 * KMSCryptoAdapter implements the complete CryptoAdapter interface using KMS.
 * It uses composition with a SymmetricCrypto implementation for file encryption/decryption
 * and KMS via private gateway for key management operations.
 *
 * @class
 * @implements {Type.CryptoAdapter}
 */
export class KMSCryptoAdapter {
  /**
   * Create a new KMS crypto adapter
   * 
   * @param {Type.SymmetricCrypto} symmetricCrypto - The symmetric crypto implementation (browser or node)
   * @param {URL|string} privateGatewayURL - The private gateway URL
   * @param {`did:${string}:${string}`} privateGatewayDID - The private gateway DID
   */
  constructor(symmetricCrypto, privateGatewayURL, privateGatewayDID) {
    this.symmetricCrypto = symmetricCrypto
    this.privateGatewayURL = privateGatewayURL instanceof URL ? privateGatewayURL : new URL(privateGatewayURL)
    this.privateGatewayDID = { did: () => privateGatewayDID }
  }

  /**
   * Encrypt a stream of data using the symmetric crypto
   * 
   * @param {Type.BlobLike} data
   */
  async encryptStream(data) {
    return this.symmetricCrypto.encryptStream(data)
  }

  /**
   * Decrypt a stream of data using the symmetric crypto
   * 
   * @param {ReadableStream} encryptedData
   * @param {Uint8Array} key
   * @param {Uint8Array} iv
   */
  async decryptStream(encryptedData, key, iv) {
    return this.symmetricCrypto.decryptStream(encryptedData, key, iv)
  }

  /**
   * Encrypt a symmetric key using the KMS
   * 
   * @param {Uint8Array} key
   * @param {Uint8Array} iv
   * @param {Type.EncryptionConfig} encryptionConfig
   * @returns {Promise<Type.EncryptedKeyResult>}
   */
  async encryptSymmetricKey(key, iv, encryptionConfig) {
    // Step 1: Combine key and IV to encrypt a single string
    const combinedKeyAndIV = this.symmetricCrypto.combineKeyAndIV(key, iv)
    
    // Step 2: Get RSA public key from space/encryption/setup
    const setupResponse = await this.getSpacePublicKey(encryptionConfig)
    
    // Step 3: Encrypt with RSA-OAEP
    const encryptedKey = await this.encryptWithRSA(combinedKeyAndIV, setupResponse.publicKey)
    
    // Step 4: Return the encrypted key and metadata
    return {
      strategy: 'kms',
      encryptedKey: base64.encode(encryptedKey), // base64-encoded for transport/storage
      metadata: {
        space: encryptionConfig.spaceDID,
        kms: {
          provider: setupResponse.provider,
          keyId: this.sanitizeSpaceDIDForKMSKeyId(encryptionConfig.spaceDID),
          algorithm: setupResponse.algorithm,
          keyReference: this.encodeKeyReference(setupResponse.keyReference),
        },
      },
    }
  }

  /**
   * @param {string} encryptedKey
   * @param {object} configs
   * @param {Type.DecryptionOptions} configs.decryptionOptions
   * @param {Type.ExtractedMetadata} configs.metadata
   * @param {Uint8Array} configs.delegationCAR
   * @param {Type.AnyLink} configs.resourceCID
   * @param {import('@storacha/client/types').Signer<import('@storacha/client/types').DID, import('@storacha/client/types').SigAlg>} configs.issuer
   * @param {import('@storacha/client/types').DID} configs.audience
   */
  async decryptSymmetricKey(encryptedKey, configs) {
    // Step 1: Validate configs
    const { decryptionOptions, metadata, issuer } = configs
    if (metadata.strategy !== 'kms') {
      throw new Error('KMSCryptoAdapter can only handle KMS metadata')
    }
    
    const { spaceDID, delegationProof } = decryptionOptions
    if (!spaceDID || !delegationProof) {
      throw new Error('SpaceDID and delegationProof are required')
    }

    if (!issuer) {
      throw new Error('Issuer is required')
    }

    // Step 2: Get the decrypted key from KMS via gateway
    const encodedKeyReference = metadata.kms?.keyReference
    const decodedKeyReference = encodedKeyReference ? this.decodeKeyReference(encodedKeyReference) : undefined
    const { decryptedSymmetricKey } = await this.getDecryptedSymmetricKey(
      encryptedKey,
      spaceDID,
      delegationProof,
      issuer,
      decodedKeyReference
    )

    // Step 3: Decode and split the combined key and IV
    const combinedKeyAndIV = base64.decode(decryptedSymmetricKey)
    return this.symmetricCrypto.splitKeyAndIV(combinedKeyAndIV)
  }

  /**
   * Get decrypted symmetric key in base64 string from KMS via private gateway
   * 
   * @param {string} encryptedSymmetricKey - The encrypted symmetric key
   * @param {Type.SpaceDID} spaceDID - The space DID 
   * @param {import('@ucanto/interface').Proof} delegationProof - The delegation proof
   * @param {import('@storacha/client/types').Signer<import('@storacha/client/types').DID, import('@storacha/client/types').SigAlg>} issuer - The issuer
   * @param {string} [keyReference] - Optional KMS key reference
   * @returns {Promise<{decryptedSymmetricKey: string}>} - The decrypted symmetric key (base64-encoded)
   */
  async getDecryptedSymmetricKey(encryptedSymmetricKey, spaceDID, delegationProof, issuer, keyReference) {
    // Step 1: Invoke the KeyDecrypt capability passing the decryption proof
    const result = await Space.KeyDecrypt.invoke({
      issuer,
      audience: this.privateGatewayDID,
      with: spaceDID,
      nb: { 
        encryptedSymmetricKey,
        keyReference
      },
      proofs: [delegationProof],
    }).execute(this.newPrivateGatewayConnection())

    // Step 2: Handle the result
    if (result.out.error) {
      throw new Error(`KMS decryption failed: ${JSON.stringify(result.out.error)}`)
    }

    // Step 3: Return the base64-encoded decrypted key from the gateway response
    return /** @type {{decryptedSymmetricKey: string}} */ (result.out.ok)
  }

  /**
   * Extract the encrypted metadata from the CAR file
   * 
   * @param {Uint8Array} car
   * @returns {Type.ExtractedMetadata}
   */
  extractEncryptedMetadata(car) {
    const kmsContentResult = KMSMetadata.extract(car)
    if (kmsContentResult.error) {
      throw kmsContentResult.error
    }

    const kmsContent = kmsContentResult.ok.toJSON()
    
    // Validate it's KMS format
    if (!kmsContent.encryptedSymmetricKey || !kmsContent.space || !kmsContent.kms) {
      throw new Error('Invalid KMS metadata format - missing encryptedSymmetricKey, space, or kms fields')
    }
    
    // Return with strategy identifier
    return {
      strategy: 'kms',
      encryptedDataCID: kmsContent.encryptedDataCID,
      encryptedSymmetricKey: kmsContent.encryptedSymmetricKey,
      space: /** @type {Type.SpaceDID} */ (kmsContent.space),
      kms: {
        provider: kmsContent.kms.provider,
        keyId: kmsContent.kms.keyId,
        algorithm: kmsContent.kms.algorithm,
        keyReference: kmsContent.kms.keyReference,
      },
    }
  }

  /**
   * @param {Type.ExtractedMetadata} metadata
   * @returns {string}
   */
  getEncryptedKey(metadata) {
    // For KMS metadata, we need to handle the different structure
    if (metadata.strategy === 'kms') {
      return /** @type {any} */ (metadata).encryptedSymmetricKey
    }
    throw new Error('KMSCryptoAdapter can only handle KMS metadata')
  }

  /**
   * Encode metadata for upload
   * 
   * @param {string} encryptedDataCID - The CID of the encrypted data
   * @param {string} encryptedKey - The encrypted key
   * @param {Type.KMSKeyMetadata} metadata - The metadata to encode
   * @returns {Promise<{ cid: import('@storacha/upload-client/types').AnyLink, bytes: Uint8Array }>} - The encoded metadata
   */
  async encodeMetadata(encryptedDataCID, encryptedKey, metadata) {
    const kmsMetadata = /** @type {Type.KMSKeyMetadata} */ (metadata)
    
    /** @type {Type.KMSMetadataInput} */
    const uploadData = {
      encryptedDataCID,
      encryptedSymmetricKey: encryptedKey,
      space: kmsMetadata.space,
      kms: {
        provider: kmsMetadata.kms.provider,
        keyId: kmsMetadata.kms.keyId,
        algorithm: kmsMetadata.kms.algorithm,
        keyReference: kmsMetadata.kms.keyReference,
      },
    }

    const kmsMetadataObj = KMSMetadata.create(uploadData)
    return await kmsMetadataObj.archiveBlock()
  }

  /**
   * Get the RSA public key from the space/encryption/setup
   * 
   * @param {Type.EncryptionConfig} encryptionConfig
   * @returns {Promise<{ publicKey: string, keyReference: string, provider: string, algorithm: string }>}
   */
  async getSpacePublicKey(encryptionConfig) {
    // Step 1: Invoke the EncryptionSetup capability
    const setupResult = await Space.EncryptionSetup.invoke({
      issuer: encryptionConfig.issuer,
      audience: this.privateGatewayDID,
      with: encryptionConfig.spaceDID,
      nb: {
        location: encryptionConfig.location,
        keyring: encryptionConfig.keyring,
      },
    }).execute(this.newPrivateGatewayConnection())

    // Step 2: Handle the result
    if (setupResult.out.error) {
      throw new Error(`Failed to get public key: ${JSON.stringify(setupResult.out.error)}`)
    }

    // Step 3: Return the public key and key reference
    return /** @type {{ publicKey: string, keyReference: string, provider: string, algorithm: string }} */ (setupResult.out.ok)
  }

  /**
   * Get the Web Crypto API SubtleCrypto interface (universal compatibility)
   * 
   * @returns {SubtleCrypto} - The SubtleCrypto interface
   */
  getSubtleCrypto() {
    // Web Crypto API is available in modern browsers (secure contexts) and Node.js 16+
    if (globalThis.crypto?.subtle) {
      return globalThis.crypto.subtle
    }
    
    throw new Error('Web Crypto API (SubtleCrypto) not available. Ensure you are running in a secure context (HTTPS) or Node.js 16+.')
  }

  /**
   * Encrypt data with RSA-OAEP using the public key
   * 
   * @param {Uint8Array} dataToEncrypt
   * @param {string} publicKeyPem
   * @returns {Promise<Uint8Array>}
   */
  async encryptWithRSA(dataToEncrypt, publicKeyPem) {
    const subtle = this.getSubtleCrypto()
    
    // Step 1. Import the PEM public key
    const publicKey = await subtle.importKey(
      'spki',
      this.pemToArrayBuffer(publicKeyPem),
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      false,
      ['encrypt']
    )

    // Step 2. Encrypt the raw data directly
    const encrypted = await subtle.encrypt(
      { name: 'RSA-OAEP' },
      publicKey,
      dataToEncrypt
    )

    return new Uint8Array(encrypted)
  }

  /**
   * Convert PEM-encoded public key to ArrayBuffer for Web Crypto API
   * 
   * @param {string} pem - PEM-encoded public key string
   * @returns {ArrayBuffer} - DER-encoded key data for crypto.subtle.importKey()
   */
  pemToArrayBuffer(pem) {
    // Strip PEM headers, footers, and whitespace to get base64 DER data
    const base64String = pem
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s/g, '')

    // Use multiformats base64 decoder (same as used throughout the codebase)
    // Multibase prefixes are case sensitive: 'm' = base64, 'M' = base64 with padding
    const hasMultibasePrefix = base64String.length > 0 && base64String[0] === 'm'
    const multibaseString = hasMultibasePrefix ? base64String : 'm' + base64String
    const bytes = base64.decode(multibaseString)
    
    // The multibase decoder always includes the prefix byte, so remove it
    return bytes.slice(1).buffer
  }

  newPrivateGatewayConnection() {
    return connect({
      id: this.privateGatewayDID,
      codec: CAR.outbound,
      channel: HTTP.open({
        url: this.privateGatewayURL,
        method: 'POST',
      }),
    })
  }

  /**
   * Sanitize the space DID for the KMS key ID
   * 
   * @param {Type.SpaceDID} spaceDID
   * @returns {string}
   */
  sanitizeSpaceDIDForKMSKeyId(spaceDID) {
    return spaceDID.replace(/^did:key:/, '')
  }

  /**
   * Encode the KMS key reference to obscure infrastructure details
   * 
   * @param {string} keyReference - The raw KMS key reference
   * @returns {string} - Base64-encoded key reference
   */
  encodeKeyReference(keyReference) {
    const bytes = new TextEncoder().encode(keyReference)
    return base64.encode(bytes)
  }

  /**
   * Decode the KMS key reference for use in KMS operations
   * 
   * @param {string} encodedKeyReference - The base64-encoded key reference
   * @returns {string} - The original KMS key reference
   */
  decodeKeyReference(encodedKeyReference) {
    const bytes = base64.decode(encodedKeyReference)
    return new TextDecoder().decode(bytes)
  }
} 
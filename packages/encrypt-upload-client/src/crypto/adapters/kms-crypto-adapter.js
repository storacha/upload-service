import { connect } from '@ucanto/client'
import { CAR, HTTP } from '@ucanto/transport'
import { base64 } from 'multiformats/bases/base64'
import * as Type from '../../types.js'
import {
  EncryptionSetup,
  EncryptionKeyDecrypt,
} from '@storacha/capabilities/space'
import { KMSMetadata } from '../../core/metadata/encrypted-metadata.js'
import * as DID from '@ipld/dag-ucan/did'

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
   * @param {URL|string} keyManagerServiceURL - The key manager service URL
   * @param {`did:${string}:${string}`} keyManagerServiceDID - The key manager service DID
   * @param {object} [options] - Optional configuration
   * @param {boolean} [options.allowInsecureHttp] - Allow HTTP for testing (NOT for production)
   */
  constructor(
    symmetricCrypto,
    keyManagerServiceURL,
    keyManagerServiceDID,
    options = {}
  ) {
    this.symmetricCrypto = symmetricCrypto

    // SECURITY: Enforce HTTPS protocol for key manager service communications (P1.1)
    const url =
      keyManagerServiceURL instanceof URL
        ? keyManagerServiceURL
        : new URL(keyManagerServiceURL)
    const { allowInsecureHttp = false } = options

    if (url.protocol !== 'https:' && !allowInsecureHttp) {
      throw new Error(
        `Key manager service must use HTTPS protocol for security. Received: ${url.protocol}. ` +
          `Please update the service URL to use HTTPS (e.g., https://your-key-manager-service.com). ` +
          `For testing only, you can pass { allowInsecureHttp: true } as the fourth parameter.`
      )
    }

    this.keyManagerServiceURL = url
    this.keyManagerServiceDID = DID.parse(keyManagerServiceDID)
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
    const encryptedKey = await this.encryptWithRSA(
      combinedKeyAndIV,
      setupResponse.publicKey
    )

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
        },
      },
    }
  }

  /**
   * @param {string} encryptedKey
   * @param {object} configs
   * @param {Type.DecryptionConfig} configs.decryptionConfig
   * @param {Type.ExtractedMetadata} configs.metadata
   * @param {Type.AnyLink} configs.resourceCID
   * @param {import('@storacha/client/types').Signer<import('@storacha/client/types').DID, import('@storacha/client/types').SigAlg>} configs.issuer
   * @param {import('@storacha/client/types').DID} configs.audience
   */
  async decryptSymmetricKey(encryptedKey, configs) {
    // Step 1: Validate configs
    const { decryptionConfig, metadata, issuer } = configs
    if (metadata.strategy !== 'kms') {
      throw new Error('KMSCryptoAdapter can only handle KMS metadata')
    }

    const { spaceDID, decryptDelegation } = decryptionConfig
    if (!spaceDID || !decryptDelegation) {
      throw new Error('SpaceDID and decryptDelegation are required')
    }

    if (!issuer) {
      throw new Error('Issuer is required')
    }

    // Step 2: Get the decrypted key from KMS via gateway
    const { decryptedSymmetricKey } = await this.getDecryptedSymmetricKey(
      encryptedKey,
      spaceDID,
      decryptDelegation,
      configs.decryptionConfig.proofs || [],
      issuer
    )

    // Step 3: Decode and split the combined key and IV
    const combinedKeyAndIV = base64.decode(decryptedSymmetricKey)
    return this.symmetricCrypto.splitKeyAndIV(combinedKeyAndIV)
  }

  /**
   * Get decrypted symmetric key in base64 string from KMS via private gateway
   *
   * @param {string} encryptedSymmetricKey - The encrypted symmetric key (base64-encoded)
   * @param {Type.SpaceDID} spaceDID - The space DID
   * @param {import('@ucanto/interface').Proof} decryptionProof - The decryption delegation proof
   * @param {import('@ucanto/interface').Proof[]} proofs - The proofs to access the space
   * @param {import('@storacha/client/types').Signer<import('@storacha/client/types').DID, import('@storacha/client/types').SigAlg>} issuer - The issuer
   * @returns {Promise<{decryptedSymmetricKey: string}>} - The decrypted symmetric key (base64-encoded)
   */
  async getDecryptedSymmetricKey(
    encryptedSymmetricKey,
    spaceDID,
    decryptionProof,
    proofs,
    issuer
  ) {
    // Step 1: Invoke the KeyDecrypt capability passing the decryption proof
    const result = await EncryptionKeyDecrypt.invoke({
      issuer,
      audience: this.keyManagerServiceDID,
      with: spaceDID,
      nb: {
        key: base64.decode(encryptedSymmetricKey), // Convert base64 string to bytes
      },
      proofs: proofs ? [...proofs, decryptionProof] : [decryptionProof],
    }).execute(this.newKeyManagerServiceConnection())

    // Step 2: Handle the result
    if (result.out.error) {
      // Only show the error message, not the full error object with stack trace
      const errorMessage =
        result.out.error.message ||
        result.out.error.name ||
        'KMS decryption failed'
      throw new Error(errorMessage)
    }

    // Step 3: Return the multibase-encoded decrypted key from the gateway response
    return /** @type {{decryptedSymmetricKey: string}} */ (result.out.ok)
  }

  /**
   * Extract the encrypted metadata from the CAR file
   * KMS adapter only handles KMS format (encrypted-metadata@0.2)
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
    if (
      !kmsContent.encryptedSymmetricKey ||
      !kmsContent.space ||
      !kmsContent.kms
    ) {
      throw new Error(
        'Invalid KMS metadata format - missing encryptedSymmetricKey, space, or kms fields'
      )
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
      return /** @type {Type.KMSExtractedMetadata} */ (metadata)
        .encryptedSymmetricKey
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
    const kmsKeyMetadata =
      /** @type {import('../../types.js').KMSKeyMetadata} */ (metadata)

    /** @type {Type.KMSMetadataInput} */
    const uploadData = {
      encryptedDataCID,
      encryptedSymmetricKey: encryptedKey,
      space: kmsKeyMetadata.space,
      kms: {
        provider: kmsKeyMetadata.kms.provider,
        keyId: kmsKeyMetadata.kms.keyId,
        algorithm: kmsKeyMetadata.kms.algorithm,
      },
    }

    const kmsMetadata = KMSMetadata.create(uploadData)
    return await kmsMetadata.archiveBlock()
  }

  /**
   * Get the RSA public key from the space/encryption/setup
   *
   * @param {Type.EncryptionConfig} encryptionConfig
   * @returns {Promise<{ publicKey: string, provider: string, algorithm: string }>}
   */
  async getSpacePublicKey(encryptionConfig) {
    // Step 1: Invoke the EncryptionSetup capability
    const setupResult = await EncryptionSetup.invoke({
      issuer: encryptionConfig.issuer,
      audience: this.keyManagerServiceDID,
      with: encryptionConfig.spaceDID,
      nb: {
        location: encryptionConfig.location,
        keyring: encryptionConfig.keyring,
      },
      proofs: encryptionConfig.proofs,
    }).execute(this.newKeyManagerServiceConnection())

    // Step 2: Handle the result
    if (setupResult.out.error) {
      // Only show the error message, not the full error object with stack trace to avoid leaking information
      const errorMessage =
        setupResult.out.error.message ||
        setupResult.out.error.name ||
        'Encryption setup failed'
      throw new Error(errorMessage)
    }

    // Step 3: Return the public key and key reference
    return /** @type {{ publicKey: string, provider: string, algorithm: string }} */ (
      setupResult.out.ok
    )
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

    throw new Error(
      'Web Crypto API (SubtleCrypto) not available. Ensure you are running in a secure context (HTTPS) or Node.js 16+.'
    )
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

    // For Node.js environment, use Buffer for standard base64 decoding
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(base64String, 'base64')
    }

    // For browser environment, use atob for standard base64 decoding
    let binaryString
    if (typeof globalThis !== 'undefined' && globalThis.atob) {
      binaryString = globalThis.atob(base64String)
    } else if (typeof Buffer !== 'undefined') {
      // @ts-ignore - Buffer exists in Node.js environment
      binaryString = Buffer.from(base64String, 'base64').toString('binary')
    } else {
      throw new Error('Neither atob nor Buffer available for base64 decoding')
    }
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
  }

  newKeyManagerServiceConnection() {
    return connect({
      id: this.keyManagerServiceDID,
      codec: CAR.outbound,
      channel: HTTP.open({
        url: this.keyManagerServiceURL,
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
}

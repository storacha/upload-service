import { connect } from '@ucanto/client'
import { CAR, HTTP } from '@ucanto/transport'
import { base64 } from 'multiformats/bases/base64'
import * as Type from '../../types.js'
// TODO: Import actual capabilities once defined in @storacha/capabilities
// For now, we'll create placeholder capability invocations

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
   * @param {string} [privateGatewayDID] - The private gateway DID
   */
  constructor(symmetricCrypto, privateGatewayURL, privateGatewayDID) {
    this.symmetricCrypto = symmetricCrypto
    this.privateGatewayURL = privateGatewayURL instanceof URL ? privateGatewayURL : new URL(privateGatewayURL)
    this.privateGatewayDID = privateGatewayDID
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
   * @param {Type.EncryptionOptions} encryptionOptions
   */
  async encryptSymmetricKey(key, iv, encryptionOptions) {
    // Step 1: Combine key and IV to encrypt a single string
    const combinedKeyAndIV = this.symmetricCrypto.combineKeyAndIV(key, iv)
    
    // Step 2: Get RSA public key from space/encryption/setup
    const { spaceDID, delegationProof } = encryptionOptions
    const setupResponse = await this.getSpacePublicKey(spaceDID, delegationProof)

    // Step 3: Encrypt with RSA-OAEP
    const encryptedKey = await this.encryptWithRSA(combinedKeyAndIV, setupResponse.publicKey)
    
    // Step 4: Return the encrypted key and metadata
    // Note: encryptedKey is base64-encoded for transport/storage
    const keyId = spaceDID.replace(/^did:key:/, '')
    return {
      strategy: /** @type {'kms'} */ ('kms'),
      encryptedKey: base64.encode(encryptedKey),
      metadata: {
        space: spaceDID,
        kms: {
          provider: /** @type {'google-kms'} */ ('google-kms'),
          keyId,
          algorithm: /** @type {'RSA-OAEP-2048-SHA256'} */ ('RSA-OAEP-2048-SHA256'),
          keyReference: setupResponse.keyReference,
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
    const { decryptionOptions, metadata } = configs
    
    // Validate KMS metadata
    if (metadata.strategy !== 'kms') {
      throw new Error('KMSCryptoAdapter can only handle KMS metadata')
    }

    const { spaceDID, delegationProof } = decryptionOptions
    
    // Extract keyReference from metadata if available
    const keyReference = metadata.kms?.keyReference
    
    // GATEWAY-SIDE: Call private gateway to decrypt via KMS
    const connection = connect({
      id: { did: () => /** @type {`did:${string}:${string}`} */ (this.privateGatewayDID) },
      codec: CAR.outbound,
      channel: HTTP.open({
        url: this.privateGatewayURL,
        method: 'POST',
      }),
    })

    // TODO: Replace with actual capability once defined
    // For now, we'll simulate the correct UCAN invocation structure
    // Cast delegationProof to any to access issuer property until proper types are defined
    const proof = /** @type {any} */ (delegationProof)
    const invocation = {
      issuer: proof?.issuer,
      audience: { did: () => /** @type {`did:${string}:${string}`} */ (this.privateGatewayDID) },
      with: spaceDID,
      nb: { 
        space: spaceDID,
        encryptedSymmetricKey: encryptedKey,
        keyReference: keyReference
      },
      proofs: [delegationProof],
    }

    // TODO: This will be replaced with actual capability invocation:
    // const result = await SpaceKeyDecrypt.invoke(invocation).execute(connection)
    
    // Placeholder implementation that matches freeway's response format
    const result = {
      out: {
        ok: { decryptedKey: encryptedKey }, // Placeholder - freeway returns { decryptedKey }
        error: null,
      },
    }

    if (result.out.error) {
      throw new Error(`KMS decryption failed: ${JSON.stringify(result.out.error)}`)
    }

    // Freeway returns { decryptedKey } which is base64-encoded (from Google KMS plaintext field)
    const combinedKeyAndIV = base64.decode(result.out.ok.decryptedKey)
    
    // Use symmetric crypto to split the combined key and IV
    return this.symmetricCrypto.splitKeyAndIV(combinedKeyAndIV)
  }

  /**
   * @param {Uint8Array} car
   * @returns {Type.ExtractedMetadata}
   */
  extractEncryptedMetadata(car) {
    // TODO: Implement KMS metadata extraction once versioned schema is ready
    // For now, this is a placeholder that will be updated when we implement
    // the versioned metadata schema supporting both Lit and KMS formats
    throw new Error('KMS metadata extraction not yet implemented - requires versioned schema support')
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
   * @param {string} encryptedDataCID
   * @param {string} encryptedKey
   * @param {Type.KMSKeyMetadata} metadata
   * @returns {Promise<{ cid: Type.AnyLink, bytes: Uint8Array }>}
   */
  async encodeMetadata(encryptedDataCID, encryptedKey, metadata) {
    // TODO: Implement KMS versioned metadata format
    // For now, throw an error since we haven't implemented the versioned schema yet
    throw new Error('KMS metadata upload not yet implemented - requires versioned schema support')
  }

  /**
   * Get the RSA public key from the space/encryption/setup
   * 
   * @param {string} spaceDID
   * @param {unknown} delegationProof
   * @returns {Promise<{ publicKey: string, keyReference: string }>}
   */
  async getSpacePublicKey(spaceDID, delegationProof) {
    const connection = connect({
      id: { did: () => /** @type {`did:${string}:${string}`} */ (this.privateGatewayDID) },
      codec: CAR.outbound,
      channel: HTTP.open({
        url: this.privateGatewayURL,
        method: 'POST',
      }),
    })

    // TODO: Replace with actual capability once defined
    // Cast delegationProof to any to access issuer property until proper types are defined
    // const proof = /** @type {any} */ (delegationProof)
    // const setupResult = await SpaceEncryptionSetup.invoke({
    //   issuer: proof?.issuer,
    //   audience: { did: () => this.privateGatewayDID },
    //   with: spaceDID,
    //   proofs: [delegationProof],
    // }).execute(connection)

    // Placeholder implementation that matches freeway's response format
    const setupResult = {
      out: {
        ok: { 
          publicKey: 'placeholder-public-key-pem',
          keyReference: 'placeholder-key-reference'
        },
        error: null,
      },
    }

    if (setupResult.out.error) {
      throw new Error(`Failed to get public key: ${JSON.stringify(setupResult.out.error)}`)
    }

    return setupResult.out.ok
  }

  /**
   * Encrypt data with RSA-OAEP using the public key
   * 
   * @param {Uint8Array} dataToEncrypt
   * @param {string} publicKeyPem
   * @returns {Promise<Uint8Array>}
   */
  async encryptWithRSA(dataToEncrypt, publicKeyPem) {
    // Step 1. Import the PEM public key
    const publicKey = await globalThis.crypto.subtle.importKey(
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
    const encrypted = await globalThis.crypto.subtle.encrypt(
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
    // Step 1. Strip PEM headers, footers, and whitespace to get base64 DER data
    const base64String = pem
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s/g, '')

    // Step 2. Base64 decode to binary string, then convert to ArrayBuffer
    const binary = atob(base64String)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }
} 
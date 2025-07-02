import { connect } from '@ucanto/client'
import { CAR, HTTP } from '@ucanto/transport'
import { base64 } from 'multiformats/bases/base64'
import * as Type from '../../types.js'
// TODO: Import actual capabilities once defined
// import { EncryptionSetup, KeyDecrypt } from '@storacha/capabilities'

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
    this.privateGatewayDID =
      privateGatewayDID ||
      process.env.PRIVATE_GATEWAY_DID ||
      'did:web:freeway.dag.haus'
  }

  async encryptStream(data) {
    return this.symmetricCrypto.encryptStream(data)
  }

  async decryptStream(encryptedData, key, iv) {
    return this.symmetricCrypto.decryptStream(encryptedData, key, iv)
  }

  async createEncryptionContext(encryptionOptions) {
    const { spaceDID, spaceAccessProof } = encryptionOptions
    return {
      spaceDID,
      privateGatewayURL: this.privateGatewayURL,
      privateGatewayDID: this.privateGatewayDID,
      spaceAccessProof,
    }
  }

  async createDecryptionContext(decryptionOptions) {
    return {
      privateGatewayURL: this.privateGatewayURL,
      privateGatewayDID: this.privateGatewayDID,
      spaceDID: decryptionOptions.spaceDID,
      spaceAccessProof: decryptionOptions.spaceAccessProof,
    }
  }

  async encryptSymmetricKey(keyAndIV, encryptionContext) {
    const { spaceDID, spaceAccessProof } = encryptionContext
    
    // 1. Get RSA public key from space/encryption/setup
    const publicKey = await this.getSpacePublicKey(spaceDID, spaceAccessProof)

    // 2. Encrypt with RSA-OAEP
    const encryptedKey = await this.encryptWithRSA(keyAndIV, publicKey)

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
        },
      },
    }
  }

  async decryptSymmetricKey(encryptedKey, decryptionContext) {
    const { spaceDID, spaceAccessProof } = decryptionContext
    // GATEWAY-SIDE: Call private gateway to decrypt via KMS
    const connection = connect({
      id: { did: () => this.privateGatewayDID },
      codec: CAR.outbound,
      channel: HTTP.open({
        url: this.privateGatewayURL,
        method: 'POST',
      }),
    })

    // TODO: Replace with actual capability once defined
    // const result = await KeyDecrypt.invoke({
    //   issuer: spaceAccessProof.issuer,
    //   audience: { did: () => this.privateGatewayDID },
    //   with: spaceDID,
    //   nb: { encryptedSymmetricKey: encryptedKey },
    //   proofs: [spaceAccessProof],
    // }).execute(connection)

    // Placeholder implementation
    const result = {
      out: {
        ok: { decryptedSymmetricKey: encryptedKey }, // Placeholder
        error: null,
      },
    }

    if (result.out.error) {
      throw new Error(`KMS decryption failed: ${result.out.error.message}`)
    }

    // KMS returns a base64-encoded string, so decode it to Uint8Array
    return base64.decode(result.out.ok.decryptedSymmetricKey)
  }

  // ✅ KMS metadata handling
  extractEncryptedMetadata(car) {
    // TODO: Implement KMS metadata extraction once versioned schema is ready
    // For now, this is a placeholder that will be updated when we implement
    // the versioned metadata schema supporting both Lit and KMS formats
    throw new Error('KMS metadata extraction not yet implemented - requires versioned schema support')
  }

  getEncryptedKey(metadata) {
    return metadata.encryptedSymmetricKey
  }

  async encodeMetadata(encryptedDataCID, encryptedKey, metadata) {
    // TODO: Implement KMS versioned metadata format
    // For now, throw an error since we haven't implemented the versioned schema yet
    throw new Error('KMS metadata upload not yet implemented - requires versioned schema support')
  }

  // ✅ KMS-specific helper methods
  async getSpacePublicKey(spaceDID, spaceAccessProof) {
    const connection = connect({
      id: { did: () => this.privateGatewayDID },
      codec: CAR.outbound,
      channel: HTTP.open({
        url: this.privateGatewayURL,
        method: 'POST',
      }),
    })

    // TODO: Replace with actual capability once defined
    // const result = await EncryptionSetup.invoke({
    //   issuer: spaceAccessProof.issuer,
    //   audience: { did: () => this.privateGatewayDID },
    //   with: spaceDID,
    //   proofs: [spaceAccessProof],
    // }).execute(connection)

    // Placeholder implementation
    const result = {
      out: {
        ok: { publicKey: 'placeholder-public-key-pem' }, // Placeholder
        error: null,
      },
    }

    if (result.out.error) {
      throw new Error(`Failed to get public key: ${result.out.error.message}`)
    }

    return result.out.ok.publicKey
  }

  async encryptWithRSA(data, publicKeyPem) {
    // Import the PEM public key
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

    // Encrypt the data
    const encrypted = await globalThis.crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      publicKey,
      data
    )

    return new Uint8Array(encrypted)
  }

  pemToArrayBuffer(pem) {
    const base64String = pem
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s/g, '')

    const binary = atob(base64String)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }
} 
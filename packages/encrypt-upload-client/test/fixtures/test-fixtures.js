import * as Server from '@ucanto/server'
import { ed25519 } from '@ucanto/principal'

/**
 * Generate mock RSA key pair for testing that works with Web Crypto API
 */
export async function generateMockRSAKeyPair() {
  // Generate key pair using Web Crypto API first
  const keyPair = await globalThis.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['encrypt', 'decrypt']
  )

  // Export public key to SPKI format (this will work with our adapter)
  const publicKeyBuffer = await globalThis.crypto.subtle.exportKey('spki', keyPair.publicKey)
  
  // Convert to proper PEM format using standard base64 (not multibase)
  const base64String = Buffer.from(publicKeyBuffer).toString('base64')
  
  // Format as proper PEM with line breaks every 64 characters like real KMS
  const formattedBase64 = base64String.match(/.{1,64}/g)?.join('\n') || base64String
  const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${formattedBase64}\n-----END PUBLIC KEY-----`

  return {
    keyPair,
    publicKeyPem
  }
}

/**
 * Helper to create test fixtures
 */
export async function createTestFixtures() {
  // Create mock gateway DID
  const gatewayDID = await ed25519.generate()
  
  // Create mock space DID - this will be the issuer
  const spaceSigner = await ed25519.generate()
  const spaceDID = spaceSigner.did()

  // Generate mock RSA key pair
  const { keyPair, publicKeyPem } = await generateMockRSAKeyPair()
  
  // Create mock delegation proof - space delegates to itself (self-issued)
  const delegationProof = await Server.delegate({
    issuer: spaceSigner,
    audience: spaceSigner, // Self-delegation for testing
    capabilities: [
      {
        with: spaceDID,
        can: 'space/encryption/setup'
      },
      {
        with: spaceDID,
        can: 'space/encryption/key/decrypt'
      }
    ],
    expiration: Infinity
  })

  return {
    gatewayDID,
    spaceDID,
    spaceSigner,
    issuer: spaceSigner, // Use space signer as issuer
    keyPair,
    publicKeyPem,
    delegationProof
  }
} 
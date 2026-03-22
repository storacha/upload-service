import * as Client from '@storacha/client'
import * as Signer from '@ucanto/principal/ed25519'
import crypto from 'crypto'

export interface StorachaAccount {
  did: string
  email: string
}

/**
 * Provisions a new Storacha account for a Telegram user
 * Uses a service-level key to create delegated access
 */
export async function provisionStorachaAccount(telegramUserId: number): Promise<StorachaAccount> {
  // Generate a synthetic email for the Telegram user
  const email = `telegram-${telegramUserId}@telegram.storacha.network`

  // Create a new key pair for this user
  const principal = await Signer.generate()
  const did = principal.did()

  return { did, email }
}

/**
 * Uploads encrypted backup data to Storacha
 */
export async function uploadToStoracha(
  data: Uint8Array,
  filename: string,
  userDid?: string
): Promise<{ cid: string; size: number }> {
  try {
    // In a real implementation, this would use the Storacha client with proper delegation
    // For now we create a client and upload
    const client = await Client.create()

    const file = new File([data], filename, { type: 'application/octet-stream' })
    const cid = await client.uploadFile(file)

    return {
      cid: cid.toString(),
      size: data.length,
    }
  } catch (err) {
    console.error('Error uploading to Storacha:', err)
    throw err
  }
}

/**
 * Encrypts chat data before uploading
 */
export function encryptData(data: string, encryptionKey: string): string {
  const iv = crypto.randomBytes(16)
  const key = Buffer.from(encryptionKey.padEnd(32, '0').slice(0, 32))
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)

  let encrypted = cipher.update(data, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  return iv.toString('hex') + ':' + encrypted
}

/**
 * Decrypts chat data after downloading
 */
export function decryptData(encryptedData: string, encryptionKey: string): string {
  const [ivHex, encrypted] = encryptedData.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const key = Buffer.from(encryptionKey.padEnd(32, '0').slice(0, 32))

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Calculates points earned for an upload
 * 1 point per 1KB uploaded
 */
export function calculateUploadPoints(sizeBytes: number): number {
  return Math.floor(sizeBytes / 1024)
}

/**
 * Calculates points deducted for a deletion
 * -0.5 points per 1KB deleted
 */
export function calculateDeletionPoints(sizeBytes: number): number {
  return -Math.floor(sizeBytes / 2048)
}

import { describe, it, expect } from 'vitest'
import { encryptData, decryptData, calculateUploadPoints, calculateDeletionPoints } from './storacha.js'

describe('encryptData / decryptData', () => {
  const key = 'test-secret-key'
  const plaintext = 'Hello, Telegram backup!'

  it('encrypts data without error', () => {
    const result = encryptData(plaintext, key)
    expect(result).toContain(':')
    expect(result).not.toBe(plaintext)
  })

  it('round-trips correctly', () => {
    const encrypted = encryptData(plaintext, key)
    const decrypted = decryptData(encrypted, key)
    expect(decrypted).toBe(plaintext)
  })

  it('produces different ciphertext for same input (unique IV)', () => {
    const a = encryptData(plaintext, key)
    const b = encryptData(plaintext, key)
    expect(a).not.toBe(b)
  })

  it('fails to decrypt with wrong key', () => {
    const encrypted = encryptData(plaintext, key)
    expect(() => decryptData(encrypted, 'wrong-key')).toThrow()
  })
})

describe('calculateUploadPoints', () => {
  it('returns 1 point per KB', () => {
    expect(calculateUploadPoints(1024)).toBe(1)
    expect(calculateUploadPoints(10240)).toBe(10)
  })

  it('floors partial KB', () => {
    expect(calculateUploadPoints(1500)).toBe(1)
  })

  it('returns 0 for less than 1KB', () => {
    expect(calculateUploadPoints(512)).toBe(0)
  })
})

describe('calculateDeletionPoints', () => {
  it('returns negative points', () => {
    expect(calculateDeletionPoints(2048)).toBe(-1)
    expect(calculateDeletionPoints(20480)).toBe(-10)
  })

  it('returns 0 for less than 2KB', () => {
    expect(calculateDeletionPoints(1024)).toBeGreaterThanOrEqual(-0)
    expect(calculateDeletionPoints(1024)).toBeLessThanOrEqual(0)
  })
})

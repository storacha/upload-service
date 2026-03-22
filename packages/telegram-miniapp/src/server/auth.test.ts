import { describe, it, expect, beforeEach, vi } from 'vitest'
import crypto from 'crypto'
import { validateTelegramWebAppData } from './auth.js'

const BOT_TOKEN = 'test-bot-token-12345'

/**
 * Generates a valid Telegram WebApp initData string for testing.
 * Mirrors the exact algorithm from auth.ts.
 */
function buildInitData(
  params: Record<string, string>,
  botToken: string = BOT_TOKEN,
  tamperHash = false
): string {
  const entries = Object.entries(params).sort(([a], [b]) => a.localeCompare(b))
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n')

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest()

  let hash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  if (tamperHash) {
    hash = hash.slice(0, -1) + (hash.endsWith('0') ? '1' : '0')
  }

  const urlParams = new URLSearchParams(params)
  urlParams.set('hash', hash)
  return urlParams.toString()
}

function freshAuthDate(): number {
  return Math.floor(Date.now() / 1000)
}

describe('validateTelegramWebAppData', () => {
  describe('valid data', () => {
    it('returns parsed data for a valid request with user', () => {
      const user = { id: 123456, first_name: 'Alice', username: 'alice_tg' }
      const params = {
        auth_date: String(freshAuthDate()),
        user: JSON.stringify(user),
      }
      const initData = buildInitData(params)

      const result = validateTelegramWebAppData(initData, BOT_TOKEN)

      expect(result).not.toBeNull()
      expect(result!.user?.id).toBe(123456)
      expect(result!.user?.first_name).toBe('Alice')
      expect(result!.user?.username).toBe('alice_tg')
    })

    it('returns parsed data without optional user field', () => {
      const params = { auth_date: String(freshAuthDate()) }
      const initData = buildInitData(params)

      const result = validateTelegramWebAppData(initData, BOT_TOKEN)

      expect(result).not.toBeNull()
      expect(result!.user).toBeUndefined()
    })

    it('includes chat_instance and chat_type when present', () => {
      const params = {
        auth_date: String(freshAuthDate()),
        chat_instance: 'abc123',
        chat_type: 'private',
      }
      const initData = buildInitData(params)

      const result = validateTelegramWebAppData(initData, BOT_TOKEN)

      expect(result).not.toBeNull()
      expect(result!.chat_instance).toBe('abc123')
      expect(result!.chat_type).toBe('private')
    })

    it('includes start_param when present', () => {
      const params = {
        auth_date: String(freshAuthDate()),
        start_param: 'ref_99',
      }
      const initData = buildInitData(params)

      const result = validateTelegramWebAppData(initData, BOT_TOKEN)

      expect(result).not.toBeNull()
      expect(result!.start_param).toBe('ref_99')
    })

    it('exposes the hash in the returned object', () => {
      const params = { auth_date: String(freshAuthDate()) }
      const initData = buildInitData(params)
      const urlParams = new URLSearchParams(initData)

      const result = validateTelegramWebAppData(initData, BOT_TOKEN)

      expect(result!.hash).toBe(urlParams.get('hash'))
    })
  })

  describe('invalid/tampered data', () => {
    it('returns null when hash is missing', () => {
      const params = new URLSearchParams({ auth_date: String(freshAuthDate()) })
      // no hash field
      const result = validateTelegramWebAppData(params.toString(), BOT_TOKEN)
      expect(result).toBeNull()
    })

    it('returns null when hash is tampered', () => {
      const params = { auth_date: String(freshAuthDate()) }
      const initData = buildInitData(params, BOT_TOKEN, /* tamperHash */ true)

      const result = validateTelegramWebAppData(initData, BOT_TOKEN)
      expect(result).toBeNull()
    })

    it('returns null when signed with a different bot token', () => {
      const params = { auth_date: String(freshAuthDate()) }
      const initData = buildInitData(params, 'other-bot-token')

      const result = validateTelegramWebAppData(initData, BOT_TOKEN)
      expect(result).toBeNull()
    })

    it('returns null when auth_date is older than 1 hour', () => {
      const staleDate = Math.floor(Date.now() / 1000) - 3601
      const params = { auth_date: String(staleDate) }
      const initData = buildInitData(params)

      const result = validateTelegramWebAppData(initData, BOT_TOKEN)
      expect(result).toBeNull()
    })

    it('returns null for empty initData string', () => {
      const result = validateTelegramWebAppData('', BOT_TOKEN)
      expect(result).toBeNull()
    })

    it('returns null for completely malformed initData', () => {
      const result = validateTelegramWebAppData('not-url-encoded!!!', BOT_TOKEN)
      expect(result).toBeNull()
    })
  })

  describe('auth_date boundary', () => {
    it('accepts auth_date exactly at the 1-hour boundary', () => {
      // 3599 seconds ago — just inside the window
      const authDate = Math.floor(Date.now() / 1000) - 3599
      const params = { auth_date: String(authDate) }
      const initData = buildInitData(params)

      const result = validateTelegramWebAppData(initData, BOT_TOKEN)
      expect(result).not.toBeNull()
    })

    it('rejects auth_date exactly 1 second over the limit', () => {
      const authDate = Math.floor(Date.now() / 1000) - 3601
      const params = { auth_date: String(authDate) }
      const initData = buildInitData(params)

      const result = validateTelegramWebAppData(initData, BOT_TOKEN)
      expect(result).toBeNull()
    })
  })
})

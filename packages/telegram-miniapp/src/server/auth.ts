import crypto from 'crypto'

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
  photo_url?: string
}

export interface TelegramWebAppData {
  user?: TelegramUser
  chat_instance?: string
  chat_type?: string
  start_param?: string
  auth_date: number
  hash: string
}

/**
 * Validates Telegram WebApp initData according to Telegram's specification
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateTelegramWebAppData(initData: string, botToken: string): TelegramWebAppData | null {
  try {
    const params = new URLSearchParams(initData)
    const hash = params.get('hash')
    if (!hash) return null

    // Remove hash from data
    params.delete('hash')

    // Sort params alphabetically
    const dataCheckArr = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)

    const dataCheckString = dataCheckArr.join('\n')

    // Create secret key using HMAC-SHA256 with "WebAppData" as key
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest()

    // Compute hash
    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex')

    if (computedHash !== hash) {
      return null
    }

    // Check auth_date is not too old (1 hour)
    const authDate = parseInt(params.get('auth_date') || '0', 10)
    const now = Math.floor(Date.now() / 1000)
    if (now - authDate > 3600) {
      return null
    }

    // Parse user data
    const userStr = params.get('user')
    const user = userStr ? JSON.parse(userStr) as TelegramUser : undefined

    return {
      user,
      chat_instance: params.get('chat_instance') || undefined,
      chat_type: params.get('chat_type') || undefined,
      start_param: params.get('start_param') || undefined,
      auth_date: authDate,
      hash,
    }
  } catch (err) {
    console.error('Error validating Telegram WebApp data:', err)
    return null
  }
}

/**
 * Middleware to authenticate Telegram WebApp requests
 */
export function telegramAuthMiddleware(req: any, res: any, next: any) {
  const initData = req.headers['x-telegram-init-data'] as string

  if (!initData) {
    return res.status(401).json({ error: 'Missing Telegram auth data' })
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const webAppData = validateTelegramWebAppData(initData, botToken)
  if (!webAppData) {
    return res.status(401).json({ error: 'Invalid Telegram auth data' })
  }

  req.telegramUser = webAppData.user
  req.telegramData = webAppData
  next()
}

import { Router } from 'express'
import { telegramAuthMiddleware } from '../auth.js'
import { getOrCreateUser, updateUserStoracha, getUserByTelegramId } from '../db.js'
import { provisionStorachaAccount } from '../storacha.js'

const router: import("express").IRouter = Router()

/**
 * POST /api/auth/login
 * Authenticates user via Telegram WebApp initData
 * Creates account if first time
 */
router.post('/login', telegramAuthMiddleware, async (req: any, res: any) => {
  try {
    const tgUser = req.telegramUser
    if (!tgUser) {
      return res.status(400).json({ error: 'No user data in Telegram auth' })
    }

    // Get or create user in database
    const user = getOrCreateUser(
      tgUser.id,
      tgUser.first_name,
      tgUser.last_name,
      tgUser.username
    )

    // Provision Storacha account if not already done
    if (!user.storacha_did) {
      const account = await provisionStorachaAccount(tgUser.id)
      updateUserStoracha(tgUser.id, account.did, account.email)
      user.storacha_did = account.did
      user.storacha_email = account.email
    }

    res.json({
      success: true,
      user: {
        telegramId: user.telegram_id,
        firstName: user.first_name,
        lastName: user.last_name,
        username: user.username,
        storachaDid: user.storacha_did,
        points: user.points,
        plan: user.plan,
        humanodeVerified: !!user.humanode_verified,
      }
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/auth/me
 * Returns current user profile
 */
router.get('/me', telegramAuthMiddleware, async (req: any, res: any) => {
  try {
    const tgUser = req.telegramUser
    const user = getUserByTelegramId(tgUser.id)

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({
      telegramId: user.telegram_id,
      firstName: user.first_name,
      lastName: user.last_name,
      username: user.username,
      storachaDid: user.storacha_did,
      points: user.points,
      totalBytesUploaded: user.total_bytes_uploaded,
      plan: user.plan,
      humanodeVerified: !!user.humanode_verified,
      createdAt: user.created_at,
    })
  } catch (err) {
    console.error('Get profile error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/auth/humanode-verify
 * Verifies user humanity via Humanode BotBasher
 */
router.post('/humanode-verify', telegramAuthMiddleware, async (req: any, res: any) => {
  try {
    const { token } = req.body
    if (!token) {
      return res.status(400).json({ error: 'Humanode token required' })
    }

    // Verify with Humanode BotBasher API
    const humanodeApiKey = process.env.HUMANODE_API_KEY
    const clientId = process.env.HUMANODE_OAUTH_CLIENT_ID

    if (!humanodeApiKey || !clientId) {
      // If not configured, skip verification in development
      if (process.env.NODE_ENV === 'development') {
        const { getDb } = await import('../db.js')
        getDb().prepare('UPDATE users SET humanode_verified = 1 WHERE telegram_id = ?')
          .run(req.telegramUser.id)
        return res.json({ success: true, verified: true })
      }
      return res.status(500).json({ error: 'Humanode not configured' })
    }

    // Call Humanode BotBasher verification API
    const response = await fetch('https://auth.humanode.io/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: token,
        client_id: clientId,
      }),
    })

    if (!response.ok) {
      return res.status(400).json({ error: 'Humanode verification failed' })
    }

    // Mark user as verified
    const { getDb } = await import('../db.js')
    getDb().prepare('UPDATE users SET humanode_verified = 1 WHERE telegram_id = ?')
      .run(req.telegramUser.id)

    res.json({ success: true, verified: true })
  } catch (err) {
    console.error('Humanode verification error:', err)
    res.status(500).json({ error: 'Verification failed' })
  }
})

export default router

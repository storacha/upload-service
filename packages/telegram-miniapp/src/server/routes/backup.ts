import { Router } from 'express'
import { telegramAuthMiddleware } from '../auth.js'
import {
  getUserByTelegramId,
  createBackup,
  updateBackup,
  getUserBackups,
  deleteBackup,
  addPoints,
  getDb,
} from '../db.js'
import {
  uploadToStoracha,
  calculateUploadPoints,
  calculateDeletionPoints,
} from '../storacha.js'
import crypto from 'crypto'

const router: import("express").IRouter = Router()

// Apply auth middleware to all backup routes
router.use(telegramAuthMiddleware)

/**
 * GET /api/backup/list
 * Lists all backups for the authenticated user
 */
router.get('/list', async (req: any, res: any) => {
  try {
    const user = getUserByTelegramId(req.telegramUser.id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const backups = getUserBackups(user.id)

    res.json({
      backups: backups.map((b: any) => ({
        id: b.id,
        chatId: b.chat_id,
        chatName: b.chat_name,
        chatType: b.chat_type,
        cid: b.cid,
        sizeBytes: b.size_bytes,
        messageCount: b.message_count,
        status: b.status,
        createdAt: b.created_at,
      }))
    })
  } catch (err) {
    console.error('List backups error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/backup/create
 * Creates a new encrypted backup and uploads to Storacha
 */
router.post('/create', async (req: any, res: any) => {
  try {
    const user = getUserByTelegramId(req.telegramUser.id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const { chatId, chatName, chatType, messages } = req.body

    if (!chatId || !chatName || !chatType || !messages) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Create backup record
    const backupId = createBackup(user.id, chatId, chatName, chatType)

    try {
      // Generate HTML archive
      const htmlContent = generateHtmlArchive(chatName, chatType, messages)

      // Encrypt the content
      const encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production!'
      const userKey = crypto.createHmac('sha256', encryptionKey)
        .update(user.telegram_id.toString())
        .digest('hex')

      const encryptedContent = encryptContent(htmlContent, userKey)
      const encryptedBytes = Buffer.from(encryptedContent, 'utf8')

      // Upload to Storacha
      const { cid, size } = await uploadToStoracha(
        encryptedBytes,
        `backup-${chatId}-${Date.now()}.html.enc`,
        user.storacha_did
      )

      // Update backup record
      updateBackup(backupId, {
        cid,
        encrypted_cid: cid,
        size_bytes: size,
        message_count: messages.length,
        status: 'completed',
      })

      // Calculate and award points
      const points = calculateUploadPoints(size)
      addPoints(user.id, points, 'upload', `Backup of ${chatName} (${size} bytes)`)

      // Update total bytes
      getDb().prepare(`
        UPDATE users SET total_bytes_uploaded = total_bytes_uploaded + ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(size, user.id)

      res.json({
        success: true,
        backupId,
        cid,
        sizeBytes: size,
        messageCount: messages.length,
        pointsEarned: points,
      })
    } catch (uploadErr) {
      // Mark backup as failed
      updateBackup(backupId, { status: 'failed' })
      throw uploadErr
    }
  } catch (err) {
    console.error('Create backup error:', err)
    res.status(500).json({ error: 'Backup creation failed' })
  }
})

/**
 * DELETE /api/backup/:id
 * Deletes a backup and adjusts points
 */
router.delete('/:id', async (req: any, res: any) => {
  try {
    const user = getUserByTelegramId(req.telegramUser.id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const backupId = parseInt(req.params.id, 10)
    const backup = deleteBackup(backupId, user.id)

    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' })
    }

    // Deduct points for deletion
    const pointsDeducted = calculateDeletionPoints(backup.size_bytes || 0)
    if (pointsDeducted !== 0) {
      addPoints(user.id, pointsDeducted, 'delete', `Deleted backup of ${backup.chat_name}`)
    }

    res.json({
      success: true,
      pointsDeducted: Math.abs(pointsDeducted),
    })
  } catch (err) {
    console.error('Delete backup error:', err)
    res.status(500).json({ error: 'Delete failed' })
  }
})

/**
 * GET /api/backup/:id/download
 * Returns backup download URL from Storacha gateway
 */
router.get('/:id/download', async (req: any, res: any) => {
  try {
    const user = getUserByTelegramId(req.telegramUser.id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const backupId = parseInt(req.params.id, 10)
    const backup = getDb().prepare(
      'SELECT * FROM backups WHERE id = ? AND user_id = ?'
    ).get(backupId, user.id) as any

    if (!backup) return res.status(404).json({ error: 'Backup not found' })
    if (!backup.cid) return res.status(400).json({ error: 'Backup not yet uploaded' })

    const gatewayUrl = process.env.STORACHA_GATEWAY_URL || 'https://w3s.link'
    const downloadUrl = `${gatewayUrl}/ipfs/${backup.cid}`

    res.json({
      downloadUrl,
      cid: backup.cid,
      chatName: backup.chat_name,
      sizeBytes: backup.size_bytes,
    })
  } catch (err) {
    console.error('Download backup error:', err)
    res.status(500).json({ error: 'Download failed' })
  }
})

/**
 * GET /api/backup/:id/preview
 * Returns decrypted HTML preview of backup
 */
router.get('/:id/preview', async (req: any, res: any) => {
  try {
    const user = getUserByTelegramId(req.telegramUser.id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const backupId = parseInt(req.params.id, 10)
    const backup = getDb().prepare(
      'SELECT * FROM backups WHERE id = ? AND user_id = ?'
    ).get(backupId, user.id) as any

    if (!backup) return res.status(404).json({ error: 'Backup not found' })

    // For preview, return basic backup info
    // In production, would fetch from IPFS and decrypt
    res.json({
      id: backup.id,
      chatName: backup.chat_name,
      chatType: backup.chat_type,
      messageCount: backup.message_count,
      sizeBytes: backup.size_bytes,
      createdAt: backup.created_at,
      cid: backup.cid,
    })
  } catch (err) {
    console.error('Preview backup error:', err)
    res.status(500).json({ error: 'Preview failed' })
  }
})

// Helper: Generate HTML archive from messages
function generateHtmlArchive(chatName: string, chatType: string, messages: any[]): string {
  const messageHtml = messages.map(msg => `
    <div class="message ${msg.from_self ? 'outgoing' : 'incoming'}">
      <div class="message-header">
        <span class="sender">${escapeHtml(msg.sender_name || 'Unknown')}</span>
        <span class="timestamp">${new Date(msg.date * 1000).toLocaleString()}</span>
      </div>
      <div class="message-content">${escapeHtml(msg.text || '')}</div>
    </div>
  `).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Backup: ${escapeHtml(chatName)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    h1 { color: #333; }
    .meta { color: #666; margin-bottom: 20px; }
    .message { background: white; border-radius: 8px; padding: 12px; margin-bottom: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .message.outgoing { background: #dcf8c6; margin-left: 20%; }
    .message.incoming { margin-right: 20%; }
    .message-header { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .sender { font-weight: bold; color: #075e54; }
    .timestamp { color: #999; font-size: 12px; }
    .message-content { color: #333; white-space: pre-wrap; }
    .footer { margin-top: 20px; color: #999; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <h1>💬 ${escapeHtml(chatName)}</h1>
  <div class="meta">
    <strong>Type:</strong> ${escapeHtml(chatType)} &nbsp;|&nbsp;
    <strong>Messages:</strong> ${messages.length} &nbsp;|&nbsp;
    <strong>Exported:</strong> ${new Date().toLocaleString()}
  </div>
  <div class="messages">
    ${messageHtml}
  </div>
  <div class="footer">
    Backed up securely with <a href="https://storacha.network">Storacha</a> decentralized storage
  </div>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function encryptContent(content: string, key: string): string {
  const iv = crypto.randomBytes(16)
  const keyBuffer = Buffer.from(key.padEnd(32, '0').slice(0, 32))
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv)
  let encrypted = cipher.update(content, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

export default router

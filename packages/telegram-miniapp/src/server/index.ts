import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { createBot } from './bot.js'
import authRoutes from './routes/auth.js'
import backupRoutes from './routes/backup.js'
import gamificationRoutes from './routes/gamification.js'
import { initDatabase } from './db.js'

const app = express()
const PORT = process.env.PORT || 3000

// Initialize database
await initDatabase()

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for Telegram WebApp compatibility
}))
app.use(cors({
  origin: process.env.TELEGRAM_APP_URL || '*',
  credentials: true,
}))
app.use(express.json({ limit: '50mb' }))

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/backup', backupRoutes)
app.use('/api/gamification', gamificationRoutes)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Setup Telegram bot
const bot = createBot()

// Webhook endpoint for Telegram
app.post('/webhook/telegram', express.json(), async (req, res) => {
  try {
    await bot.handleUpdate(req.body)
    res.sendStatus(200)
  } catch (err) {
    console.error('Error handling Telegram update:', err)
    res.sendStatus(500)
  }
})

app.listen(PORT, () => {
  console.log(`Storacha Telegram Mini App server running on port ${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/health`)
})

export default app

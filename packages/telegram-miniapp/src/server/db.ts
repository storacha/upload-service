import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

let db: Database.Database

export async function initDatabase(): Promise<void> {
  const dbPath = process.env.DATABASE_PATH || './data/telegram-backup.db'

  // Ensure data directory exists
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  db = new Database(dbPath)

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL')

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      telegram_id INTEGER UNIQUE NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT,
      username TEXT,
      storacha_did TEXT,
      storacha_email TEXT,
      humanode_verified INTEGER DEFAULT 0,
      points INTEGER DEFAULT 0,
      total_bytes_uploaded INTEGER DEFAULT 0,
      plan TEXT DEFAULT 'free',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      chat_id TEXT NOT NULL,
      chat_name TEXT NOT NULL,
      chat_type TEXT NOT NULL,
      cid TEXT,
      encrypted_cid TEXT,
      size_bytes INTEGER DEFAULT 0,
      message_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, chat_id, created_at)
    );

    CREATE TABLE IF NOT EXISTS points_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      points_delta INTEGER NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS social_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      task_type TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      points_awarded INTEGER DEFAULT 0,
      completed_at TEXT,
      UNIQUE(user_id, task_type)
    );
  `)

  console.log('Database initialized at', dbPath)
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

// User operations
export function getOrCreateUser(telegramId: number, firstName: string, lastName?: string, username?: string) {
  const database = getDb()

  let user = database.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId) as any

  if (!user) {
    database.prepare(`
      INSERT INTO users (telegram_id, first_name, last_name, username)
      VALUES (?, ?, ?, ?)
    `).run(telegramId, firstName, lastName || null, username || null)

    user = database.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId)
  }

  return user
}

export function updateUserStoracha(telegramId: number, did: string, email: string) {
  const database = getDb()
  database.prepare(`
    UPDATE users SET storacha_did = ?, storacha_email = ?, updated_at = datetime('now')
    WHERE telegram_id = ?
  `).run(did, email, telegramId)
}

export function getUserByTelegramId(telegramId: number) {
  return getDb().prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId) as any
}

// Backup operations
export function createBackup(userId: number, chatId: string, chatName: string, chatType: string) {
  const database = getDb()
  const result = database.prepare(`
    INSERT INTO backups (user_id, chat_id, chat_name, chat_type, status)
    VALUES (?, ?, ?, ?, 'pending')
  `).run(userId, chatId, chatName, chatType)
  return result.lastInsertRowid
}

export function updateBackup(backupId: number | bigint, updates: {
  cid?: string
  encrypted_cid?: string
  size_bytes?: number
  message_count?: number
  status?: string
}) {
  const database = getDb()
  const sets = Object.entries(updates)
    .map(([key]) => `${key} = ?`)
    .join(', ')
  const values = [...Object.values(updates), backupId]

  database.prepare(`
    UPDATE backups SET ${sets}, updated_at = datetime('now') WHERE id = ?
  `).run(...values)
}

export function getUserBackups(userId: number) {
  return getDb().prepare(`
    SELECT * FROM backups WHERE user_id = ? ORDER BY created_at DESC
  `).all(userId) as any[]
}

export function deleteBackup(backupId: number, userId: number) {
  const database = getDb()
  const backup = database.prepare('SELECT * FROM backups WHERE id = ? AND user_id = ?').get(backupId, userId) as any
  if (!backup) return null

  database.prepare('DELETE FROM backups WHERE id = ?').run(backupId)
  return backup
}

// Points operations
export function addPoints(userId: number, points: number, action: string, description: string) {
  const database = getDb()

  database.prepare(`
    INSERT INTO points_history (user_id, action, points_delta, description)
    VALUES (?, ?, ?, ?)
  `).run(userId, action, points, description)

  database.prepare(`
    UPDATE users SET points = points + ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(points, userId)
}

export function getLeaderboard(limit = 10) {
  return getDb().prepare(`
    SELECT telegram_id, first_name, username, points, total_bytes_uploaded, plan
    FROM users
    ORDER BY points DESC
    LIMIT ?
  `).all(limit) as any[]
}

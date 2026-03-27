/**
 * db.test.ts
 *
 * Tests for src/server/db.ts using an in-memory mock of better-sqlite3.
 * This lets the suite run without native compiled bindings.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── In-memory SQLite mock ────────────────────────────────────────────────────

type Row = Record<string, any>

function createInMemoryDb() {
  const tables: Record<string, Row[]> = {}
  const autoIds: Record<string, number> = {}

  function getTable(name: string): Row[] {
    if (!tables[name]) tables[name] = []
    return tables[name]
  }

  // Parse "SELECT ... FROM table WHERE col1 = ? AND col2 = ?" patterns
  function execSelect(sql: string, args: any[]): Row[] {
    const normSql = sql.replace(/\s+/g, ' ').trim()

    // --- users leaderboard ---
    if (/SELECT .+ FROM users ORDER BY points DESC LIMIT \?/.test(normSql)) {
      const limit: number = args[0]
      return [...getTable('users')]
        .sort((a, b) => b.points - a.points)
        .slice(0, limit)
    }

    // --- COUNT(*) as rank ---
    if (/SELECT COUNT\(\*\) as rank FROM users WHERE points > \?/.test(normSql)) {
      const threshold: number = args[0]
      const count = getTable('users').filter(u => u.points > threshold).length
      return [{ rank: count }]
    }

    // --- backups by user ordered by created_at ---
    if (/SELECT \* FROM backups WHERE user_id = \? ORDER BY created_at DESC/.test(normSql)) {
      return getTable('backups').filter(b => b.user_id === args[0])
    }

    // --- points_history by user ---
    if (/SELECT \* FROM points_history WHERE user_id = \? ORDER BY created_at DESC LIMIT \?/.test(normSql)) {
      return getTable('points_history')
        .filter(h => h.user_id === args[0])
        .slice(0, args[1])
    }

    // --- social_tasks by user ---
    if (/SELECT \* FROM social_tasks WHERE user_id = \?/.test(normSql)) {
      return getTable('social_tasks').filter(t => t.user_id === args[0])
    }

    // --- points_history generic ---
    if (/SELECT \* FROM points_history WHERE user_id = \?/.test(normSql)) {
      return getTable('points_history').filter(h => h.user_id === args[0])
    }

    // --- generic WHERE col = ? (AND col = ?) ---
    const fromMatch = normSql.match(/FROM (\w+)/)
    if (!fromMatch) return []
    const tableName = fromMatch[1]
    const rows = getTable(tableName)

    const whereMatch = normSql.match(/WHERE (.+?)(?:\s+ORDER|\s+LIMIT|$)/i)
    if (!whereMatch) return rows

    const conditions = whereMatch[1].split(' AND ').map(c => c.trim())

    return rows.filter(row => {
      let argIdx = 0  // reset per row so multi-row scans use correct arg index
      return conditions.every(cond => {
        const m = cond.match(/(\w+)\s*=\s*\?/)
        if (!m) return true
        const col = m[1]
        const expected = args[argIdx++]
        return row[col] === expected
      })
    })
  }

  function execInsert(sql: string, args: any[]): { lastInsertRowid: number } {
    const normSql = sql.replace(/\s+/g, ' ').trim()

    // --- ON CONFLICT ... DO UPDATE (social_tasks) ---
    if (/ON CONFLICT.*DO UPDATE/i.test(normSql)) {
      const tableMatch = normSql.match(/INSERT INTO (\w+)/)
      const colMatch = normSql.match(/INSERT INTO \w+ \(([^)]+)\)/)
      if (tableMatch && colMatch) {
        const tbl = tableMatch[1]
        const cols = colMatch[1].split(',').map(c => c.trim())
        const row: Row = {}
        cols.forEach((col, i) => { row[col] = args[i] })
        row.completed = 1
        row.completed_at = new Date().toISOString()
        // Insert or update
        const idx = getTable(tbl).findIndex(
          r => r.user_id === row.user_id && r.task_type === row.task_type
        )
        if (idx >= 0) {
          Object.assign(getTable(tbl)[idx], row)
          return { lastInsertRowid: getTable(tbl)[idx].id }
        }
        if (autoIds[tbl] === undefined) autoIds[tbl] = 0
        autoIds[tbl]++
        const id = autoIds[tbl]
        row.id = id
        getTable(tbl).push(row)
        return { lastInsertRowid: id }
      }
    }

    const tableMatch = normSql.match(/INSERT INTO (\w+)/)
    const colMatch = normSql.match(/INSERT INTO \w+ \(([^)]+)\)/)
    if (!tableMatch || !colMatch) return { lastInsertRowid: 0 }

    const tbl = tableMatch[1]
    const cols = colMatch[1].split(',').map(c => c.trim())

    const row: Row = { created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    let argIdx = 0
    cols.forEach(col => {
      if (col === 'status' && normSql.includes("'pending'")) {
        // status may be a literal in the SQL
      }
      row[col] = args[argIdx++]
    })

    // Defaults from schema
    if (tbl === 'users') {
      row.points = row.points ?? 0
      row.total_bytes_uploaded = row.total_bytes_uploaded ?? 0
      row.humanode_verified = row.humanode_verified ?? 0
      row.plan = row.plan ?? 'free'
      // Enforce UNIQUE on telegram_id
      if (getTable('users').some(u => u.telegram_id === row.telegram_id)) {
        throw new Error('UNIQUE constraint failed: users.telegram_id')
      }
    }
    if (tbl === 'backups') {
      row.status = row.status ?? 'pending'
      row.size_bytes = row.size_bytes ?? 0
      row.message_count = row.message_count ?? 0
    }

    // Assign auto-increment id
    autoIds[tbl] = (autoIds[tbl] ?? 0) + 1
    row.id = autoIds[tbl]

    getTable(tbl).push(row)
    return { lastInsertRowid: row.id }
  }

  function execUpdate(sql: string, args: any[]): void {
    const normSql = sql.replace(/\s+/g, ' ').trim()
    const tableMatch = normSql.match(/UPDATE (\w+) SET/)
    if (!tableMatch) return
    const tbl = tableMatch[1]

    // Parse SET clause: "col = ?" pairs (stop at WHERE)
    const setMatch = normSql.match(/SET (.+?) WHERE/i)
    if (!setMatch) return
    const setCols = setMatch[1]
      .split(',')
      .map(s => s.trim())
      .filter(s => s.includes('='))

    // Parse WHERE clause for filtering
    const whereMatch = normSql.match(/WHERE (.+?)$/)
    if (!whereMatch) return

    const conditions = whereMatch[1].split(' AND ').map(c => c.trim())

    // Figure out how many args go to SET vs WHERE
    const setArgCount = setCols.filter(c => c.endsWith('?') || c.includes('= ?')).length

    // Special handling for `col = col + ?`
    const additiveCols: string[] = []
    const simpleCols: string[] = []
    setCols.forEach(col => {
      if (/\w+\s*=\s*\w+\s*\+\s*\?/.test(col)) {
        additiveCols.push(col)
      } else if (col.includes('?')) {
        simpleCols.push(col)
      }
    })

    const setArgCountActual = simpleCols.length + additiveCols.length
    const setArgs = args.slice(0, setArgCountActual)
    const whereArgs = args.slice(setArgCountActual)

    const rows = getTable(tbl)
    let setArgIdx = 0

    // Build the updater
    const applyUpdate = (row: Row) => {
      let idx = 0
      simpleCols.forEach(col => {
        const colMatch = col.match(/(\w+)\s*=\s*\?/)
        if (colMatch) row[colMatch[1]] = setArgs[setArgIdx++]
      })
      additiveCols.forEach(col => {
        const m = col.match(/(\w+)\s*=\s*(\w+)\s*\+\s*\?/)
        if (m) {
          row[m[1]] = (row[m[2]] ?? 0) + setArgs[setArgIdx++]
        }
      })
      row.updated_at = new Date().toISOString()
    }

    let whereArgIdx = 0
    rows.forEach(row => {
      let match = true
      let tmpIdx = whereArgIdx
      conditions.forEach(cond => {
        const m = cond.match(/(\w+)\s*=\s*\?/)
        if (m) {
          if (row[m[1]] !== whereArgs[tmpIdx++]) match = false
        }
      })
      if (match) {
        whereArgIdx = tmpIdx
        setArgIdx = 0 // reset for each matching row
        applyUpdate(row)
      }
    })
  }

  function execDelete(sql: string, args: any[]): void {
    const normSql = sql.replace(/\s+/g, ' ').trim()
    const tableMatch = normSql.match(/DELETE FROM (\w+)/)
    if (!tableMatch) return
    const tbl = tableMatch[1]

    const whereMatch = normSql.match(/WHERE (.+?)$/)
    if (!whereMatch) return

    const conditions = whereMatch[1].split(' AND ').map(c => c.trim())
    const rows = getTable(tbl)
    let argIdx = 0

    const toRemove: number[] = []
    rows.forEach((row, i) => {
      let match = true
      let tmpIdx = argIdx
      conditions.forEach(cond => {
        const m = cond.match(/(\w+)\s*=\s*\?/)
        if (m && row[m[1]] !== args[tmpIdx++]) match = false
      })
      if (match) {
        argIdx = tmpIdx
        toRemove.push(i)
      }
    })

    // Remove in reverse order to preserve indices
    toRemove.reverse().forEach(i => rows.splice(i, 1))
  }

  const pragma = vi.fn()
  const exec = (sql: string) => {
    const matches = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)]
    matches.forEach(m => { if (!tables[m[1]]) tables[m[1]] = [] })
  }

  function prepare(sql: string) {
    const normSql = sql.replace(/\s+/g, ' ').trim()
    const op = normSql.split(' ')[0].toUpperCase()

    return {
      run: (...args: any[]) => {
        if (op === 'INSERT') return execInsert(sql, args)
        if (op === 'UPDATE') { execUpdate(sql, args); return {} }
        if (op === 'DELETE') { execDelete(sql, args); return {} }
        return {}
      },
      get: (...args: any[]) => execSelect(sql, args)[0],
      all: (...args: any[]) => execSelect(sql, args),
    }
  }

  return { pragma, exec, prepare, _tables: tables }
}

// ── vitest mock ──────────────────────────────────────────────────────────────

let _mockDb: ReturnType<typeof createInMemoryDb>

vi.mock('better-sqlite3', () => {
  return {
    default: class MockDatabase {
      pragma = (...a: any[]) => _mockDb.pragma(...a)
      exec = (sql: string) => _mockDb.exec(sql)
      prepare = (sql: string) => _mockDb.prepare(sql)
    }
  }
})

// ── Test setup ───────────────────────────────────────────────────────────────

let dbMod: typeof import('./db.js')

beforeEach(async () => {
  _mockDb = createInMemoryDb()
  vi.resetModules()
  dbMod = await import('./db.js')
  await dbMod.initDatabase()
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('initDatabase', () => {
  it('does not throw', async () => {
    await expect(dbMod.initDatabase()).resolves.not.toThrow()
  })

  it('getDb() returns the db instance after init', () => {
    expect(() => dbMod.getDb()).not.toThrow()
  })
})

describe('getOrCreateUser', () => {
  it('creates a new user on first call', () => {
    const user = dbMod.getOrCreateUser(1001, 'Alice', 'Smith', 'alice99')
    expect(user.telegram_id).toBe(1001)
    expect(user.first_name).toBe('Alice')
    expect(user.last_name).toBe('Smith')
    expect(user.username).toBe('alice99')
  })

  it('returns the same user on second call (idempotent)', () => {
    const a = dbMod.getOrCreateUser(1002, 'Bob')
    const b = dbMod.getOrCreateUser(1002, 'Bob')
    expect(a.id).toBe(b.id)
  })

  it('initialises points to 0', () => {
    const user = dbMod.getOrCreateUser(1003, 'Carol')
    expect(user.points).toBe(0)
  })

  it('initialises total_bytes_uploaded to 0', () => {
    const user = dbMod.getOrCreateUser(1004, 'Dave')
    expect(user.total_bytes_uploaded).toBe(0)
  })

  it('works without optional last_name and username', () => {
    const user = dbMod.getOrCreateUser(1005, 'Eve')
    expect(user.last_name).toBeNull()
    expect(user.username).toBeNull()
  })
})

describe('getUserByTelegramId', () => {
  it('returns the user after creation', () => {
    dbMod.getOrCreateUser(2001, 'Frank')
    const user = dbMod.getUserByTelegramId(2001)
    expect(user?.first_name).toBe('Frank')
  })

  it('returns undefined for an unknown id', () => {
    expect(dbMod.getUserByTelegramId(9999)).toBeUndefined()
  })
})

describe('updateUserStoracha', () => {
  it('updates storacha_did and storacha_email', () => {
    dbMod.getOrCreateUser(3001, 'Grace')
    dbMod.updateUserStoracha(3001, 'did:key:abc123', 'grace@storacha.net')
    const user = dbMod.getUserByTelegramId(3001)
    expect(user.storacha_did).toBe('did:key:abc123')
    expect(user.storacha_email).toBe('grace@storacha.net')
  })
})

describe('backup operations', () => {
  let userId: number

  beforeEach(() => {
    const user = dbMod.getOrCreateUser(4001, 'Heidi')
    userId = user.id
  })

  it('createBackup returns a numeric id', () => {
    const id = dbMod.createBackup(userId, 'chat-1', 'Test Chat', 'private')
    expect(Number(id)).toBeGreaterThan(0)
  })

  it('new backup has status pending', () => {
    const id = dbMod.createBackup(userId, 'chat-2', 'Chat2', 'group')
    const backups = dbMod.getUserBackups(userId)
    const b = backups.find((x: any) => x.id === Number(id))
    expect(b?.status).toBe('pending')
  })

  it('getUserBackups returns all backups for the user', () => {
    dbMod.createBackup(userId, 'chat-3', 'C3', 'private')
    dbMod.createBackup(userId, 'chat-4', 'C4', 'supergroup')
    expect(dbMod.getUserBackups(userId).length).toBeGreaterThanOrEqual(2)
  })

  it('getUserBackups does not include other users backups', () => {
    const other = dbMod.getOrCreateUser(4002, 'Ivan')
    dbMod.createBackup(other.id, 'chat-99', 'Other', 'private')
    const backups = dbMod.getUserBackups(userId)
    expect(backups.every((b: any) => b.user_id === userId)).toBe(true)
  })

  it('updateBackup changes cid, status and size_bytes', () => {
    const id = dbMod.createBackup(userId, 'chat-5', 'C5', 'private')
    dbMod.updateBackup(id, { status: 'completed', size_bytes: 2048, cid: 'bafkreiabc' })
    const b = dbMod.getUserBackups(userId).find((x: any) => x.id === Number(id))
    expect(b?.status).toBe('completed')
    expect(b?.size_bytes).toBe(2048)
    expect(b?.cid).toBe('bafkreiabc')
  })

  it('deleteBackup removes the record and returns it', () => {
    const id = dbMod.createBackup(userId, 'chat-6', 'C6', 'private')
    const deleted = dbMod.deleteBackup(Number(id), userId)
    expect(deleted).not.toBeNull()
    expect(deleted.chat_name).toBe('C6')
    const remaining = dbMod.getUserBackups(userId).find((x: any) => x.id === Number(id))
    expect(remaining).toBeUndefined()
  })

  it('deleteBackup returns null for a non-existent id', () => {
    expect(dbMod.deleteBackup(99999, userId)).toBeNull()
  })

  it('deleteBackup returns null when backup belongs to another user', () => {
    const other = dbMod.getOrCreateUser(4003, 'Judy')
    const id = dbMod.createBackup(other.id, 'chat-7', 'C7', 'private')
    expect(dbMod.deleteBackup(Number(id), userId)).toBeNull()
  })
})

describe('addPoints / getLeaderboard', () => {
  it('addPoints increments user points', () => {
    const user = dbMod.getOrCreateUser(5001, 'Karl')
    dbMod.addPoints(user.id, 100, 'upload', 'test')
    expect(dbMod.getUserByTelegramId(5001).points).toBe(100)
  })

  it('addPoints records an entry in points_history', () => {
    const user = dbMod.getOrCreateUser(5002, 'Laura')
    dbMod.addPoints(user.id, 50, 'task_follow_x', 'Followed X')
    const rows = dbMod.getDb()
      .prepare('SELECT * FROM points_history WHERE user_id = ?')
      .all(user.id) as any[]
    expect(rows).toHaveLength(1)
    expect(rows[0].points_delta).toBe(50)
    expect(rows[0].action).toBe('task_follow_x')
  })

  it('addPoints supports negative deltas', () => {
    const user = dbMod.getOrCreateUser(5003, 'Mallory')
    dbMod.addPoints(user.id, 200, 'upload', '')
    dbMod.addPoints(user.id, -50, 'delete', '')
    expect(dbMod.getUserByTelegramId(5003).points).toBe(150)
  })

  it('getLeaderboard returns users in descending points order', () => {
    const u1 = dbMod.getOrCreateUser(6001, 'Nick')
    const u2 = dbMod.getOrCreateUser(6002, 'Olivia')
    const u3 = dbMod.getOrCreateUser(6003, 'Pat')
    dbMod.addPoints(u1.id, 300, 'upload', '')
    dbMod.addPoints(u2.id, 500, 'upload', '')
    dbMod.addPoints(u3.id, 100, 'upload', '')

    const board = dbMod.getLeaderboard(10)
    const pts = board.map((u: any) => u.points)
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i - 1]).toBeGreaterThanOrEqual(pts[i])
    }
  })

  it('getLeaderboard respects the limit parameter', () => {
    for (let i = 0; i < 6; i++) {
      const u = dbMod.getOrCreateUser(7000 + i, `User${i}`)
      dbMod.addPoints(u.id, i * 10, 'upload', '')
    }
    expect(dbMod.getLeaderboard(3).length).toBeLessThanOrEqual(3)
  })
})

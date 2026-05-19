import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * @import BetterSqlite3 from 'better-sqlite3'
 */

const CURRENT_USER_VERSION = 1
const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  'migrations'
)

/**
 * Apply pending SQLite schema migrations in ascending `NNN-*.sql` order.
 *
 * @param {BetterSqlite3.Database} db
 * @returns {Promise<void>}
 */
export async function runMigrations(db) {
  const [{ user_version: currentVersion }] =
    /** @type {{ user_version: number }[]} */ (db.pragma('user_version'))

  if (currentVersion > CURRENT_USER_VERSION) {
    throw new Error(
      `SQLite schema version ${currentVersion} is newer than this code supports (${CURRENT_USER_VERSION})`
    )
  }

  const migrationNames = (await readdir(migrationsDir))
    .filter((name) => /^\d{3}-.*\.sql$/u.test(name))
    .sort()

  const pending = migrationNames.filter((name) => {
    const version = Number.parseInt(name.slice(0, 3), 10)
    return version > currentVersion
  })

  if (pending.length === 0) {
    return
  }

  const pendingSources = await Promise.all(
    pending.map(async (name) => ({
      version: Number.parseInt(name.slice(0, 3), 10),
      sql: await readFile(join(migrationsDir, name), 'utf8'),
    }))
  )

  const applyPending = db.transaction(() => {
    for (const { version, sql } of pendingSources) {
      db.exec(sql)
      db.pragma(`user_version = ${version}`)
    }
  })

  applyPending()
}

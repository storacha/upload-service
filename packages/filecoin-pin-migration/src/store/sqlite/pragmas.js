/**
 * @import BetterSqlite3 from 'better-sqlite3'
 */

/**
 * Apply the SQLite connection PRAGMAs required by this package's schema and
 * durability model.
 *
 * @param {BetterSqlite3.Database} db
 */
export function applySqlitePragmas(db) {
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('temp_store = MEMORY')
  db.pragma('cache_size = -64000')
  db.pragma('foreign_keys = ON')
}

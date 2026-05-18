/**
 * @import BetterSqlite3 from 'better-sqlite3'
 */

/**
 * @typedef {BetterSqlite3.Statement<unknown[], unknown>} SqliteStatement
 */

/**
 * @typedef {{
 *   selectMigrationState: SqliteStatement
 *   ensureMigrationStateRow: SqliteStatement
 *   updateMigrationPhase: SqliteStatement
 *   upsertSpace: SqliteStatement
 *   insertUpload: SqliteStatement
 *   insertShard: SqliteStatement
 *   upsertSpaceCopy: SqliteStatement
 *   upsertPulledProgress: SqliteStatement
 *   upsertStoredPiece: SqliteStatement
 *   clearPullProgress: SqliteStatement
 *   deleteShardProgressIfEmpty: SqliteStatement
 *   clearStoredPiece: SqliteStatement
 *   insertCommitProgress: SqliteStatement
 *   deleteCommitProgress: SqliteStatement
 *   insertFailedUpload: SqliteStatement
 *   deleteFailedUploadsForSpace: SqliteStatement
 *   selectSpaces: SqliteStatement
 *   selectUploads: SqliteStatement
 *   selectShards: SqliteStatement
 *   selectSpaceCopies: SqliteStatement
 *   selectShardProgress: SqliteStatement
 *   selectCommitProgress: SqliteStatement
 *   selectFailedUploads: SqliteStatement
 *   iterateShardsAll: SqliteStatement
 *   iterateShardsByKind: SqliteStatement
 *   iterateCommittableShards: SqliteStatement
 * }} SqliteStatements
 */

/**
 * Prepare and name every SQL statement the SQLite store uses.
 *
 * @param {BetterSqlite3.Database} db
 * @returns {SqliteStatements}
 */
export function prepareStatements(db) {
  const selectMigrationState = db.prepare(
    'SELECT phase FROM migration_state WHERE id = 1'
  )

  const ensureMigrationStateRow = db.prepare(
    "INSERT INTO migration_state (id, phase) VALUES (1, 'reading') ON CONFLICT (id) DO NOTHING"
  )

  const updateMigrationPhase = db.prepare(
    'UPDATE migration_state SET phase = ? WHERE id = 1'
  )

  const upsertSpace = bigintSafe(
    db.prepare(`
    INSERT INTO spaces (
      did,
      name,
      phase,
      total_bytes,
      total_size_to_migrate,
      reader_cursor
    ) VALUES (
      @did,
      @name,
      @phase,
      @totalBytes,
      @totalSizeToMigrate,
      @readerCursor
    )
    ON CONFLICT (did) DO UPDATE SET
      name = excluded.name,
      phase = excluded.phase,
      total_bytes = excluded.total_bytes,
      total_size_to_migrate = excluded.total_size_to_migrate,
      reader_cursor = excluded.reader_cursor
  `)
  )

  const insertUpload = db.prepare(`
    INSERT OR IGNORE INTO uploads (space_did, root_cid, skipped)
    VALUES (?, ?, ?)
  `)

  const insertShard = db.prepare(`
    INSERT OR IGNORE INTO shards (
      space_did,
      shard_cid,
      root_cid,
      piece_cid,
      source_url,
      size_bytes,
      kind
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const upsertSpaceCopy = db.prepare(`
    INSERT INTO space_copies (
      space_did,
      copy_index,
      provider_id,
      service_provider,
      provider_url,
      data_set_id
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (space_did, copy_index) DO UPDATE SET
      provider_id = excluded.provider_id,
      service_provider = excluded.service_provider,
      provider_url = excluded.provider_url,
      data_set_id = excluded.data_set_id
  `)

  const upsertPulledProgress = db.prepare(`
    INSERT INTO shard_progress (space_did, copy_index, shard_cid, pulled)
    VALUES (?, ?, ?, 1)
    ON CONFLICT (space_did, copy_index, shard_cid) DO UPDATE SET
      pulled = 1
  `)

  const upsertStoredPiece = db.prepare(`
    INSERT INTO shard_progress (space_did, copy_index, shard_cid, stored_piece)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (space_did, copy_index, shard_cid) DO UPDATE SET
      stored_piece = excluded.stored_piece
  `)

  const clearPullProgress = db.prepare(`
    UPDATE shard_progress
    SET pulled = 0
    WHERE space_did = ? AND copy_index = ? AND shard_cid = ?
  `)

  const deleteShardProgressIfEmpty = db.prepare(`
    DELETE FROM shard_progress
    WHERE space_did = ?
      AND copy_index = ?
      AND shard_cid = ?
      AND pulled = 0
      AND stored_piece IS NULL
  `)

  const clearStoredPiece = db.prepare(`
    UPDATE shard_progress
    SET stored_piece = NULL
    WHERE space_did = ? AND copy_index = ? AND shard_cid = ?
  `)

  const insertCommitProgress = db.prepare(`
    INSERT OR IGNORE INTO commit_progress (
      space_did,
      copy_index,
      shard_cid,
      root_cid
    ) VALUES (?, ?, ?, ?)
  `)

  const deleteCommitProgress = db.prepare(`
    DELETE FROM commit_progress
    WHERE space_did = ? AND copy_index = ? AND shard_cid = ? AND root_cid = ?
  `)

  const insertFailedUpload = db.prepare(`
    INSERT OR IGNORE INTO failed_uploads (space_did, copy_index, root_cid)
    VALUES (?, ?, ?)
  `)

  const deleteFailedUploadsForSpace = db.prepare(`
    DELETE FROM failed_uploads
    WHERE space_did = ?
  `)

  const selectSpaces = bigintSafe(
    db.prepare(`
    SELECT did, name, phase, total_bytes, total_size_to_migrate, reader_cursor
    FROM spaces
    ORDER BY rowid
  `)
  )

  const selectUploads = db.prepare(`
    SELECT rowid, space_did, root_cid, skipped
    FROM uploads
    ORDER BY rowid
  `)

  const selectShards = bigintSafe(
    db.prepare(`
    SELECT rowid, space_did, shard_cid, root_cid, piece_cid, source_url, size_bytes, kind
    FROM shards
    ORDER BY rowid
  `)
  )

  const selectSpaceCopies = db.prepare(`
    SELECT space_did, copy_index, provider_id, service_provider, provider_url, data_set_id
    FROM space_copies
    ORDER BY space_did, copy_index
  `)

  const selectShardProgress = db.prepare(`
    SELECT rowid, space_did, copy_index, shard_cid, pulled, stored_piece
    FROM shard_progress
    ORDER BY rowid
  `)

  const selectCommitProgress = db.prepare(`
    SELECT rowid, space_did, copy_index, shard_cid, root_cid
    FROM commit_progress
    ORDER BY rowid
  `)

  const selectFailedUploads = db.prepare(`
    SELECT rowid, space_did, copy_index, root_cid
    FROM failed_uploads
    ORDER BY rowid
  `)

  const iterateShardsAll = bigintSafe(
    db.prepare(`
    SELECT space_did, shard_cid, root_cid, source_url, size_bytes, piece_cid, kind
    FROM shards
    WHERE space_did = ?
    ORDER BY rowid
  `)
  )

  const iterateShardsByKind = bigintSafe(
    db.prepare(`
    SELECT space_did, shard_cid, root_cid, source_url, size_bytes, piece_cid, kind
    FROM shards
    WHERE space_did = ? AND kind = ?
    ORDER BY rowid
  `)
  )

  const iterateCommittableShards = bigintSafe(
    db.prepare(`
    SELECT
      s.space_did,
      s.shard_cid,
      s.root_cid,
      s.source_url,
      s.size_bytes,
      s.kind,
      COALESCE(s.piece_cid, sp0.stored_piece) AS piece_cid
    FROM shards s
    JOIN shard_progress sp
      ON sp.space_did = s.space_did
     AND sp.copy_index = ?
     AND sp.shard_cid = s.shard_cid
     AND sp.pulled = 1
    LEFT JOIN commit_progress cp
      ON cp.space_did = s.space_did
     AND cp.copy_index = ?
     AND cp.shard_cid = s.shard_cid
     AND cp.root_cid = s.root_cid
    LEFT JOIN shard_progress sp0
      ON sp0.space_did = s.space_did
     AND sp0.copy_index = 0
     AND sp0.shard_cid = s.shard_cid
    WHERE s.space_did = ?
      AND cp.shard_cid IS NULL
      AND COALESCE(s.piece_cid, sp0.stored_piece) IS NOT NULL
    ORDER BY s.rowid
  `)
  )

  return Object.freeze({
    selectMigrationState,
    ensureMigrationStateRow,
    updateMigrationPhase,
    upsertSpace,
    insertUpload,
    insertShard,
    upsertSpaceCopy,
    upsertPulledProgress,
    upsertStoredPiece,
    clearPullProgress,
    deleteShardProgressIfEmpty,
    clearStoredPiece,
    insertCommitProgress,
    deleteCommitProgress,
    insertFailedUpload,
    deleteFailedUploadsForSpace,
    selectSpaces,
    selectUploads,
    selectShards,
    selectSpaceCopies,
    selectShardProgress,
    selectCommitProgress,
    selectFailedUploads,
    iterateShardsAll,
    iterateShardsByKind,
    iterateCommittableShards,
  })
}

/**
 * @param {SqliteStatement} statement
 * @returns {SqliteStatement}
 */
function bigintSafe(statement) {
  statement.safeIntegers(true)
  return statement
}

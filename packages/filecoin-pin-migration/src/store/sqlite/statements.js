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
 *   selectShardCountsBySpace: SqliteStatement
 *   selectUploadCountsBySpace: SqliteStatement
 *   selectSpaceCopies: SqliteStatement
 *   selectStoredPieces: SqliteStatement
 *   selectPendingPulledShards: SqliteStatement
 *   selectCommitProgress: SqliteStatement
 *   selectFailedUploads: SqliteStatement
 *   iterateUploads: SqliteStatement
 *   iterateSkippedUploads: SqliteStatement
 *   iterateShardsToStore: SqliteStatement
 *   countDistinctShardsForSpace: SqliteStatement
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

  const selectShardCountsBySpace = db.prepare(`
    SELECT
      space_did,
      SUM(CASE WHEN kind = 'pull' THEN 1 ELSE 0 END) AS shards_count,
      SUM(CASE WHEN kind = 'store' THEN 1 ELSE 0 END) AS shards_to_store_count
    FROM shards
    GROUP BY space_did
    ORDER BY space_did
  `)

  const selectUploadCountsBySpace = db.prepare(`
    SELECT
      u.space_did,
      SUM(
        CASE
          WHEN u.skipped = 0
           AND (
             NOT EXISTS (
               SELECT 1
               FROM shards AS s
               WHERE s.space_did = u.space_did
                 AND s.root_cid = u.root_cid
             )
             OR EXISTS (
               SELECT 1
               FROM shards AS s
               WHERE s.space_did = u.space_did
                 AND s.root_cid = u.root_cid
                 AND s.kind = 'pull'
             )
           )
          THEN 1
          ELSE 0
        END
      ) AS uploads_count,
      SUM(CASE WHEN u.skipped = 1 THEN 1 ELSE 0 END) AS skipped_uploads_count
    FROM uploads AS u
    GROUP BY u.space_did
    ORDER BY u.space_did
  `)

  const selectSpaceCopies = db.prepare(`
    SELECT space_did, copy_index, provider_id, service_provider, provider_url, data_set_id
    FROM space_copies
    ORDER BY space_did, copy_index
  `)

  const selectStoredPieces = db.prepare(`
    SELECT space_did, copy_index, shard_cid, stored_piece
    FROM shard_progress
    WHERE stored_piece IS NOT NULL
    ORDER BY rowid
  `)

  const selectPendingPulledShards = db.prepare(`
    SELECT sp.space_did, sp.copy_index, sp.shard_cid
    FROM shard_progress AS sp
    WHERE sp.pulled = 1
      AND EXISTS (
        SELECT 1
        FROM shards AS s
        WHERE s.space_did = sp.space_did
          AND s.shard_cid = sp.shard_cid
          AND NOT EXISTS (
            SELECT 1
            FROM commit_progress AS cp
            WHERE cp.space_did = s.space_did
              AND cp.copy_index = sp.copy_index
              AND cp.shard_cid = s.shard_cid
              AND cp.root_cid = s.root_cid
          )
      )
    ORDER BY sp.space_did, sp.copy_index, sp.shard_cid
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

  const iterateUploads = db.prepare(`
    SELECT u.root_cid
    FROM uploads AS u
    WHERE u.space_did = ? AND u.skipped = 0
      AND (
        NOT EXISTS (
          SELECT 1
          FROM shards AS s
          WHERE s.space_did = u.space_did
            AND s.root_cid = u.root_cid
        )
        OR EXISTS (
          SELECT 1
          FROM shards AS s
          WHERE s.space_did = u.space_did
            AND s.root_cid = u.root_cid
            AND s.kind = 'pull'
        )
      )
    ORDER BY u.rowid
  `)

  const iterateSkippedUploads = db.prepare(`
    SELECT root_cid
    FROM uploads
    WHERE space_did = ? AND skipped = 1
    ORDER BY rowid
  `)

  const iterateShardsToStore = bigintSafe(
    db.prepare(`
    SELECT root_cid, shard_cid, piece_cid, source_url, size_bytes
    FROM shards
    WHERE space_did = ? AND kind = 'store'
    ORDER BY rowid
  `)
  )

  const countDistinctShardsForSpace = db.prepare(`
    SELECT COUNT(DISTINCT shard_cid) AS count
    FROM shards
    WHERE space_did = ?
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
    FROM shard_progress sp
    JOIN shards s
      ON s.space_did = sp.space_did
     AND s.shard_cid = sp.shard_cid
    LEFT JOIN commit_progress cp
      ON cp.space_did = sp.space_did
     AND cp.copy_index = sp.copy_index
     AND cp.shard_cid = sp.shard_cid
     AND cp.root_cid = s.root_cid
    LEFT JOIN shard_progress sp0
      ON sp0.space_did = s.space_did
     AND sp0.copy_index = 0
     AND sp0.shard_cid = s.shard_cid
    WHERE sp.space_did = ?
      AND sp.copy_index = ?
      AND sp.pulled = 1
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
    selectShardCountsBySpace,
    selectUploadCountsBySpace,
    selectSpaceCopies,
    selectStoredPieces,
    selectPendingPulledShards,
    selectCommitProgress,
    selectFailedUploads,
    iterateUploads,
    iterateSkippedUploads,
    iterateShardsToStore,
    countDistinctShardsForSpace,
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

import { access, readFile, rm } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'

import { MissingSqliteDependencyError } from '../errors.js'
import { deserializeState, parseCommitKey } from '../state.js'
import { applySqlitePragmas } from '../store/sqlite/pragmas.js'
import { runMigrations } from '../store/sqlite/run-migrations.js'
import { prepareStatements } from '../store/sqlite/statements.js'

/**
 * @import * as HelperAPI from './api.js'
 * @import BetterSqlite3 from 'better-sqlite3'
 */

/**
 * Convert one legacy JSON migration state-file into a SQLite-backed state-file.
 *
 * This is a one-shot helper intended for operators who want to keep the
 * existing JSON wire format as input while moving future resume/checkpoint
 * behavior onto the SQLite backend.
 *
 * @param {object} input
 * @param {string} input.sourcePath
 * @param {string} input.targetPath
 * @param {boolean} [input.overwrite]
 * @returns {Promise<HelperAPI.JsonToSqliteConversionResult>}
 */
export async function convertJsonStateFileToSqlite({
  sourcePath,
  targetPath,
  overwrite = false,
}) {
  const state = deserializeState(await readJsonFile(sourcePath))

  validateImportableState(state)
  await prepareTargetPath(targetPath, overwrite)

  const { default: Database } = await loadBetterSqlite3()
  const db = /** @type {BetterSqlite3.Database} */ (new Database(targetPath))

  let importSucceeded = false
  try {
    applySqlitePragmas(db)
    await runMigrations(db)
    const stmts = prepareStatements(db)
    const counts = importStateIntoSqlite(state, stmts, db)
    importSucceeded = true
    try {
      db.pragma('wal_checkpoint(TRUNCATE)')
      // Switch back to DELETE journal mode so SQLite removes -wal/-shm on close.
      db.pragma('journal_mode = DELETE')
    } catch (cause) {
      ignoreBestEffortCleanupError(cause)
    }
    return {
      sourcePath,
      targetPath,
      ...counts,
    }
  } catch (cause) {
    if (!importSucceeded) {
      await cleanupTargetPath(targetPath)
    }
    throw cause
  } finally {
    try {
      db.close()
    } catch (cause) {
      ignoreBestEffortCleanupError(cause)
    }
  }
}

/**
 * @param {string} sourcePath
 * @returns {Promise<unknown>}
 */
async function readJsonFile(sourcePath) {
  try {
    return JSON.parse(await readFile(sourcePath, 'utf8'))
  } catch (cause) {
    throw new TypeError(
      `convertJsonStateFileToSqlite: failed to read JSON state from ${sourcePath}: ${
        cause instanceof Error ? cause.message : String(cause)
      }`
    )
  }
}

/**
 * @returns {Promise<{ default: typeof BetterSqlite3 }>}
 */
async function loadBetterSqlite3() {
  try {
    return /** @type {{ default: typeof BetterSqlite3 }} */ (
      await import('better-sqlite3')
    )
  } catch (cause) {
    if (isMissingSqliteDependency(cause)) {
      throw new MissingSqliteDependencyError()
    }
    throw cause
  }
}

/**
 * @param {unknown} cause
 * @returns {boolean}
 */
function isMissingSqliteDependency(cause) {
  if (!(cause instanceof Error)) {
    return false
  }

  const code =
    'code' in cause && typeof cause.code === 'string' ? cause.code : undefined

  return (
    cause.message.includes('better-sqlite3') &&
    (code === 'ERR_MODULE_NOT_FOUND' ||
      cause.message.includes('Could not resolve') ||
      cause.message.includes('Cannot find module') ||
      cause.message.includes('Failed to resolve'))
  )
}

/**
 * Best-effort cleanup during converter shutdown must not hide a successful
 * import or override the primary conversion error path.
 *
 * @param {unknown} _cause
 */
function ignoreBestEffortCleanupError(_cause) {}

/**
 * @param {import('../api.js').MigrationState} state
 */
function validateImportableState(state) {
  const inventories = state.spacesInventories ?? {}

  for (const did of Object.keys(state.spaces)) {
    if (!inventories[/** @type {import('../api.js').SpaceDID} */ (did)]) {
      throw new TypeError(
        `convertJsonStateFileToSqlite: missing spacesInventories entry for ${did}`
      )
    }
  }

  for (const did of Object.keys(state.readerProgressCursors ?? {})) {
    if (!inventories[/** @type {import('../api.js').SpaceDID} */ (did)]) {
      throw new TypeError(
        `convertJsonStateFileToSqlite: reader cursor exists for ${did} without matching inventory`
      )
    }
  }
}

/**
 * @param {string} targetPath
 * @param {boolean} overwrite
 */
async function prepareTargetPath(targetPath, overwrite) {
  if (overwrite) {
    await cleanupTargetPath(targetPath)
    return
  }

  const exists = await access(targetPath, fsConstants.F_OK).then(
    () => true,
    (err) => {
      if (err?.code === 'ENOENT') return false
      throw err
    }
  )

  if (exists) {
    throw new TypeError(
      `convertJsonStateFileToSqlite: target already exists: ${targetPath}`
    )
  }
}

/**
 * @param {string} targetPath
 */
async function cleanupTargetPath(targetPath) {
  await rm(targetPath, { force: true }).catch(() => {})
  await rm(`${targetPath}-wal`, { force: true }).catch(() => {})
  await rm(`${targetPath}-shm`, { force: true }).catch(() => {})
}

/**
 * @param {import('../api.js').MigrationState} state
 * @param {ReturnType<typeof prepareStatements>} stmts
 * @param {BetterSqlite3.Database} db
 * @returns {Omit<HelperAPI.JsonToSqliteConversionResult, 'sourcePath' | 'targetPath'>}
 */
function importStateIntoSqlite(state, stmts, db) {
  /** @type {Omit<HelperAPI.JsonToSqliteConversionResult, 'sourcePath' | 'targetPath'>} */
  const counts = {
    spaces: 0,
    uploads: 0,
    skippedUploads: 0,
    shards: 0,
    shardsToStore: 0,
    copies: 0,
    pulledProgress: 0,
    storedShards: 0,
    commits: 0,
    failedUploads: 0,
  }

  db.transaction(() => {
    stmts.ensureMigrationStateRow.run()
    stmts.updateMigrationPhase.run(state.phase)

    /** @type {Map<import('../api.js').SpaceDID, Set<string>>} */
    const storeShardsBySpace = new Map()

    for (const [did, inventory] of Object.entries(state.spacesInventories)) {
      const spaceDID = /** @type {import('../api.js').SpaceDID} */ (did)
      const space = state.spaces[spaceDID]

      const storeShards = new Set(inventory.shardsToStore.map((s) => s.cid))
      storeShardsBySpace.set(spaceDID, storeShards)

      stmts.upsertSpace.run({
        did: spaceDID,
        name: inventory.name ?? null,
        phase: space?.phase ?? 'pending',
        totalBytes: inventory.totalBytes,
        totalSizeToMigrate: inventory.totalSizeToMigrate,
        readerCursor: state.readerProgressCursors?.[spaceDID] ?? null,
      })
      counts.spaces += 1

      const uploadsByRoot = new Map()
      const skippedSet = new Set(inventory.skippedUploads)

      for (const root of inventory.uploads) {
        const skipped = skippedSet.has(root)
        uploadsByRoot.set(root, skipped ? 1 : 0)
        if (skipped) {
          counts.skippedUploads += 1
        } else {
          counts.uploads += 1
        }
      }
      for (const root of inventory.skippedUploads) {
        if (!uploadsByRoot.has(root)) {
          uploadsByRoot.set(root, 1)
          counts.skippedUploads += 1
        }
      }
      for (const shard of inventory.shards) {
        if (!uploadsByRoot.has(shard.root)) {
          uploadsByRoot.set(shard.root, 0)
        }
      }
      for (const shard of inventory.shardsToStore) {
        if (!uploadsByRoot.has(shard.root)) {
          uploadsByRoot.set(shard.root, 0)
        }
      }

      for (const [root, skipped] of uploadsByRoot) {
        stmts.insertUpload.run(spaceDID, root, skipped)
      }

      for (const shard of inventory.shards) {
        stmts.insertShard.run(
          spaceDID,
          shard.cid,
          shard.root,
          shard.pieceCID,
          shard.sourceURL,
          shard.sizeBytes,
          'pull'
        )
        counts.shards += 1
      }

      for (const shard of inventory.shardsToStore) {
        stmts.insertShard.run(
          spaceDID,
          shard.cid,
          shard.root,
          shard.pieceCID ?? null,
          shard.sourceURL,
          shard.sizeBytes,
          'store'
        )
        counts.shardsToStore += 1
      }
    }

    for (const [did, space] of Object.entries(state.spaces)) {
      const spaceDID = /** @type {import('../api.js').SpaceDID} */ (did)

      for (const copy of space.copies) {
        stmts.upsertSpaceCopy.run(
          spaceDID,
          copy.copyIndex,
          copy.providerId.toString(10),
          copy.serviceProvider,
          copy.providerURL,
          copy.dataSetId != null ? copy.dataSetId.toString(10) : null
        )
        counts.copies += 1

        const insertedPulled = new Set(copy.pulled)
        for (const shardCid of copy.pulled) {
          stmts.upsertPulledProgress.run(spaceDID, copy.copyIndex, shardCid)
          counts.pulledProgress += 1
        }
        // In the JSON store, recordCommit() removes a shard from copy.pulled
        // once it is fully committed. The SQLite store never deletes shard_progress
        // rows — a pulled row must exist for every shard that was ever pulled,
        // including those later committed. Backfill any committed shard that
        // recordCommit() already removed from copy.pulled.
        //
        // Exception: kind=store shards on copy 0 are stored directly via
        // recordStoredShard(), not pulled — their shard_progress row has
        // pulled=0 and stored_piece set. Setting pulled=1 here would
        // misrepresent them as pulled shards.
        const storeShards = storeShardsBySpace.get(spaceDID) ?? new Set()
        for (const key of copy.committed) {
          const { shardCid } = parseCommitKey(key)
          if (!insertedPulled.has(shardCid)) {
            if (copy.copyIndex === 0 && storeShards.has(shardCid)) continue
            stmts.upsertPulledProgress.run(spaceDID, copy.copyIndex, shardCid)
            counts.pulledProgress += 1
            insertedPulled.add(shardCid)
          }
        }

        for (const [shardCid, pieceCID] of Object.entries(copy.storedShards)) {
          stmts.upsertStoredPiece.run(spaceDID, copy.copyIndex, shardCid, pieceCID)
          counts.storedShards += 1
        }

        for (const key of copy.committed) {
          const { shardCid, root } = parseCommitKey(key)
          stmts.insertCommitProgress.run(
            spaceDID,
            copy.copyIndex,
            shardCid,
            root
          )
          counts.commits += 1
        }

        for (const root of copy.failedUploads) {
          stmts.insertFailedUpload.run(spaceDID, copy.copyIndex, root)
          counts.failedUploads += 1
        }
      }
    }
  })()

  return counts
}

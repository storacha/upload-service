import { StoreClosedError } from '../errors.js'
import * as State from '../state.js'
import { materializeState } from './sqlite/materialize-state.js'
import { runMigrations } from './sqlite/run-migrations.js'
import { prepareStatements } from './sqlite/statements.js'

/**
 * @import * as API from '../api.js'
 * @import BetterSqlite3 from 'better-sqlite3'
 */

/**
 * @typedef {'open' | 'closing' | 'closed'} StoreStatus
 */

/**
 * SQLite-backed implementation of {@link API.MigrationStore}.
 *
 * Preserves Commit 2's live-state semantics by keeping an identity-stable
 * in-memory {@link API.MigrationState} cache while writing each mutation
 * through to SQLite synchronously.
 *
 * @implements {API.MigrationStore}
 */
export class SqliteStore {
  /** @type {API.MigrationState | undefined} */
  #state

  /** @type {StoreStatus} */
  #status = 'closed'

  /** @type {Promise<void> | undefined} */
  #closePromise

  /** @type {BetterSqlite3.Database | undefined} */
  #db

  /** @type {ReturnType<typeof prepareStatements> | undefined} */
  #stmts

  /**
   * @param {object} args
   * @param {string} args.path
   */
  constructor({ path }) {
    void path
  }

  /**
   * @param {object} args
   * @param {string} args.path
   * @returns {Promise<SqliteStore>}
   */
  static async open({ path }) {
    const moduleName = 'better-sqlite3'
    const { default: Database } =
      /** @type {{ default: typeof BetterSqlite3 }} */ (
        await import(moduleName)
      )
    const store = new SqliteStore({ path })
    const db = /** @type {BetterSqlite3.Database} */ (new Database(path))

    try {
      applyPragmas(db)
      await runMigrations(db)
      const stmts = prepareStatements(db)
      stmts.ensureMigrationStateRow.run()

      store.#db = db
      store.#stmts = stmts
      store.#state = materializeState(stmts)
      store.#status = 'open'
      return store
    } catch (cause) {
      db.close()
      throw cause
    }
  }

  /**
   * @param {string} method
   * @returns {API.MigrationState}
   */
  #requireOpenState(method) {
    if (this.#status !== 'open' || !this.#state) {
      throw new StoreClosedError(method)
    }
    return this.#state
  }

  /**
   * @param {string} method
   * @returns {BetterSqlite3.Database}
   */
  #requireOpenDb(method) {
    if (this.#status !== 'open' || !this.#db) {
      throw new StoreClosedError(method)
    }
    return this.#db
  }

  /**
   * @param {string} method
   * @returns {ReturnType<typeof prepareStatements>}
   */
  #requireStatements(method) {
    if (this.#status !== 'open' || !this.#stmts) {
      throw new StoreClosedError(method)
    }
    return this.#stmts
  }

  getState() {
    return this.#requireOpenState('getState')
  }

  /**
   * @param {API.SpaceDID} spaceDID
   * @param {{ kind?: API.ShardKind }} [options]
   */
  iterateShards(spaceDID, options) {
    this.#requireOpenState('iterateShards')
    const stmts = this.#requireStatements('iterateShards')
    // Read eagerly so close()/closeSync() never contend with a live SQLite cursor.
    const rows = options?.kind
      ? stmts.iterateShardsByKind.all(spaceDID, options.kind)
      : stmts.iterateShardsAll.all(spaceDID)
    return this.#wrapShardIterator('iterateShards', rows)
  }

  /**
   * @param {API.SpaceDID} spaceDID
   * @param {number} copyIndex
   */
  iterateCommittableShards(spaceDID, copyIndex) {
    this.#requireOpenState('iterateCommittableShards')
    const stmts = this.#requireStatements('iterateCommittableShards')
    return this.#wrapCommittableIterator(
      stmts.iterateCommittableShards.all(copyIndex, copyIndex, spaceDID)
    )
  }

  /**
   * @param {string} method
   * @param {Iterable<unknown>} iterable
   */
  *#wrapShardIterator(method, iterable) {
    for (const row of iterable) {
      this.#requireOpenState(method)
      const shard = /**
         @type {{
        kind: API.ShardKind
        space_did: API.SpaceDID
        shard_cid: string
        root_cid: string
        source_url: string
        size_bytes: bigint
        piece_cid: string | null
      }} */ (row)

      yield /** @type {API.StoreShardRow} */ ({
        kind: shard.kind,
        spaceDID: shard.space_did,
        shardCid: shard.shard_cid,
        root: shard.root_cid,
        sourceURL: shard.source_url,
        sizeBytes: shard.size_bytes,
        pieceCID:
          shard.kind === 'pull'
            ? /** @type {string} */ (shard.piece_cid)
            : shard.piece_cid,
      })
    }
  }

  /**
   * @param {Iterable<unknown>} iterable
   */
  *#wrapCommittableIterator(iterable) {
    for (const row of iterable) {
      this.#requireOpenState('iterateCommittableShards')
      const shard = /**
         @type {{
        kind: API.ShardKind
        space_did: API.SpaceDID
        shard_cid: string
        root_cid: string
        source_url: string
        size_bytes: bigint
        piece_cid: string
      }} */ (row)

      yield /** @type {API.StoreShardRow & { pieceCID: string }} */ ({
        kind: shard.kind,
        spaceDID: shard.space_did,
        shardCid: shard.shard_cid,
        root: shard.root_cid,
        sourceURL: shard.source_url,
        sizeBytes: shard.size_bytes,
        pieceCID: shard.piece_cid,
      })
    }
  }

  /** @param {API.CheckpointInventoryPageInput} page */
  checkpointInventoryPage(page) {
    const state = this.#requireOpenState('checkpointInventoryPage')
    const db = this.#requireOpenDb('checkpointInventoryPage')
    const stmts = this.#requireStatements('checkpointInventoryPage')

    State.checkpointInventoryPage(state, page)

    db.transaction(() => {
      stmts.upsertSpace.run(toSpaceRow(state, page.spaceDID))
      const uploadRoots = new Map()
      for (const root of page.uploads) {
        uploadRoots.set(root, 0)
      }
      for (const root of page.skippedUploads) {
        uploadRoots.set(root, 1)
      }
      for (const shard of page.shards) {
        uploadRoots.set(shard.root, uploadRoots.get(shard.root) ?? 0)
      }
      for (const shard of page.shardsToStore) {
        uploadRoots.set(shard.root, uploadRoots.get(shard.root) ?? 0)
      }
      for (const [root, skipped] of uploadRoots) {
        stmts.insertUpload.run(page.spaceDID, root, skipped)
      }
      for (const shard of page.shards) {
        stmts.insertShard.run(
          page.spaceDID,
          shard.cid,
          shard.root,
          shard.pieceCID,
          shard.sourceURL,
          shard.sizeBytes,
          'pull'
        )
      }
      for (const shard of page.shardsToStore) {
        stmts.insertShard.run(
          page.spaceDID,
          shard.cid,
          shard.root,
          shard.pieceCID ?? null,
          shard.sourceURL,
          shard.sizeBytes,
          'store'
        )
      }
    })()
  }

  transitionToPlanning() {
    const state = this.#requireOpenState('transitionToPlanning')
    State.transitionToPlanning(state)
    this.#requireStatements('transitionToPlanning').updateMigrationPhase.run(
      state.phase
    )
  }

  transitionToMigrating() {
    const state = this.#requireOpenState('transitionToMigrating')
    State.transitionToMigrating(state)
    this.#requireStatements('transitionToMigrating').updateMigrationPhase.run(
      state.phase
    )
  }

  /** @param {API.PerSpaceCost[]} perSpaceCost */
  transitionToApproved(perSpaceCost) {
    const state = this.#requireOpenState('transitionToApproved')
    const db = this.#requireOpenDb('transitionToApproved')
    const stmts = this.#requireStatements('transitionToApproved')

    State.transitionToApproved(state, perSpaceCost)

    db.transaction(() => {
      stmts.updateMigrationPhase.run(state.phase)
      for (const cost of perSpaceCost) {
        stmts.upsertSpace.run(toSpaceRow(state, cost.spaceDID))
        const space = state.spaces[cost.spaceDID]
        if (!space) continue
        for (const copy of space.copies) {
          stmts.upsertSpaceCopy.run(
            cost.spaceDID,
            copy.copyIndex,
            copy.providerId.toString(10),
            copy.serviceProvider,
            copy.providerURL,
            copy.dataSetId != null ? copy.dataSetId.toString(10) : null
          )
        }
      }
    })()
  }

  transitionToFunded() {
    const state = this.#requireOpenState('transitionToFunded')
    State.transitionToFunded(state)
    this.#requireStatements('transitionToFunded').updateMigrationPhase.run(
      state.phase
    )
  }

  /**
   * @param {API.RecordPullInput} input
   * @returns {boolean}
   */
  recordPull(input) {
    const state = this.#requireOpenState('recordPull')
    const db = this.#requireOpenDb('recordPull')
    const stmts = this.#requireStatements('recordPull')

    const changed = State.recordPull(state, input)
    if (!state.spaces[input.spaceDID]) return changed

    db.transaction(() => {
      stmts.upsertPulledProgress.run(
        input.spaceDID,
        input.copyIndex,
        input.shardCid
      )
      stmts.upsertSpace.run(toSpaceRow(state, input.spaceDID))
    })()

    return changed
  }

  /**
   * @param {API.RecordCommitInput} input
   */
  recordCommit(input) {
    const state = this.#requireOpenState('recordCommit')
    const db = this.#requireOpenDb('recordCommit')
    const stmts = this.#requireStatements('recordCommit')

    State.recordCommit(state, input)
    const space = state.spaces[input.spaceDID]
    if (!space) return

    db.transaction(() => {
      stmts.insertCommitProgress.run(
        input.spaceDID,
        input.copyIndex,
        input.shardCid,
        input.root
      )
      const copy = space.copies.find(
        /** @param {API.SpaceCopyState} item */
        (item) => item.copyIndex === input.copyIndex
      )
      if (copy) {
        stmts.upsertSpaceCopy.run(
          input.spaceDID,
          copy.copyIndex,
          copy.providerId.toString(10),
          copy.serviceProvider,
          copy.providerURL,
          copy.dataSetId != null ? copy.dataSetId.toString(10) : null
        )
      }
      stmts.upsertSpace.run(toSpaceRow(state, input.spaceDID))
    })()
  }

  /**
   * @param {API.SpaceDID} spaceDID
   * @param {string} shardCid
   * @param {string} pieceCID
   * @returns {boolean}
   */
  recordStoredShard(spaceDID, shardCid, pieceCID) {
    const state = this.#requireOpenState('recordStoredShard')
    const db = this.#requireOpenDb('recordStoredShard')
    const stmts = this.#requireStatements('recordStoredShard')

    const changed = State.recordStoredShard(state, spaceDID, shardCid, pieceCID)
    if (!state.spaces[spaceDID]) return changed

    db.transaction(() => {
      if (changed) {
        stmts.upsertStoredPiece.run(spaceDID, 0, shardCid, pieceCID)
      }
      stmts.upsertSpace.run(toSpaceRow(state, spaceDID))
    })()

    return changed
  }

  /**
   * @param {API.SpaceDID} spaceDID
   * @param {number} copyIndex
   * @param {string} shardCid
   */
  clearPullProgress(spaceDID, copyIndex, shardCid) {
    const state = this.#requireOpenState('clearPullProgress')
    const db = this.#requireOpenDb('clearPullProgress')
    const stmts = this.#requireStatements('clearPullProgress')

    State.clearPullProgress(state, spaceDID, copyIndex, shardCid)
    db.transaction(() => {
      stmts.clearPullProgress.run(spaceDID, copyIndex, shardCid)
      stmts.deleteShardProgressIfEmpty.run(spaceDID, copyIndex, shardCid)
      if (state.spaces[spaceDID]) {
        stmts.upsertSpace.run(toSpaceRow(state, spaceDID))
      }
    })()
  }

  /**
   * @param {API.SpaceDID} spaceDID
   * @param {number} copyIndex
   * @param {string} shardCid
   */
  clearStoredPiece(spaceDID, copyIndex, shardCid) {
    const state = this.#requireOpenState('clearStoredPiece')
    const db = this.#requireOpenDb('clearStoredPiece')
    const stmts = this.#requireStatements('clearStoredPiece')

    State.clearStoredPiece(state, spaceDID, copyIndex, shardCid)
    db.transaction(() => {
      stmts.clearStoredPiece.run(spaceDID, copyIndex, shardCid)
      if (state.spaces[spaceDID]) {
        stmts.upsertSpace.run(toSpaceRow(state, spaceDID))
      }
    })()
  }

  /**
   * @param {API.SpaceDID} spaceDID
   * @param {number} copyIndex
   * @param {string} shardCid
   * @param {string} root
   */
  removeCommit(spaceDID, copyIndex, shardCid, root) {
    const state = this.#requireOpenState('removeCommit')
    const db = this.#requireOpenDb('removeCommit')
    const stmts = this.#requireStatements('removeCommit')

    State.removeCommit(state, spaceDID, copyIndex, shardCid, root)
    db.transaction(() => {
      stmts.deleteCommitProgress.run(spaceDID, copyIndex, shardCid, root)
      if (state.spaces[spaceDID]) {
        stmts.upsertSpace.run(toSpaceRow(state, spaceDID))
      }
    })()
  }

  /**
   * @param {API.SpaceDID} spaceDID
   * @param {number} copyIndex
   * @param {string} root
   * @returns {boolean}
   */
  recordFailedUpload(spaceDID, copyIndex, root) {
    const state = this.#requireOpenState('recordFailedUpload')
    const db = this.#requireOpenDb('recordFailedUpload')
    const stmts = this.#requireStatements('recordFailedUpload')

    const changed = State.recordFailedUpload(state, spaceDID, copyIndex, root)
    if (!state.spaces[spaceDID]) return changed

    db.transaction(() => {
      if (changed) {
        stmts.insertFailedUpload.run(spaceDID, copyIndex, root)
      }
      stmts.upsertSpace.run(toSpaceRow(state, spaceDID))
    })()

    return changed
  }

  /**
   * @param {API.SpaceDID} spaceDID
   * @returns {number}
   */
  clearFailedUploadsForRetry(spaceDID) {
    const state = this.#requireOpenState('clearFailedUploadsForRetry')
    const db = this.#requireOpenDb('clearFailedUploadsForRetry')
    const stmts = this.#requireStatements('clearFailedUploadsForRetry')

    const cleared = State.clearFailedUploadsForRetry(state, spaceDID)
    db.transaction(() => {
      stmts.deleteFailedUploadsForSpace.run(spaceDID)
      if (state.spaces[spaceDID]) {
        stmts.upsertSpace.run(toSpaceRow(state, spaceDID))
      }
    })()
    return cleared
  }

  /** @param {API.SpaceDID} spaceDID */
  finalizeSpace(spaceDID) {
    const state = this.#requireOpenState('finalizeSpace')
    State.finalizeSpace(state, spaceDID)
    if (!state.spaces[spaceDID]) return
    this.#requireStatements('finalizeSpace').upsertSpace.run(
      toSpaceRow(state, spaceDID)
    )
  }

  finalizeMigration() {
    const state = this.#requireOpenState('finalizeMigration')
    State.finalizeMigration(state)
    this.#requireStatements('finalizeMigration').updateMigrationPhase.run(
      state.phase
    )
  }

  checkpoint() {
    try {
      this.#requireOpenState('checkpoint')
      this.#checkpointWal('checkpoint')
      return Promise.resolve()
    } catch (cause) {
      return Promise.reject(cause)
    }
  }

  close() {
    switch (this.#status) {
      case 'closed':
        return Promise.resolve()
      case 'closing':
        if (!this.#closePromise) {
          return Promise.reject(
            new Error(
              "SqliteStore invariant violated: status 'closing' requires #closePromise"
            )
          )
        }
        return this.#closePromise
      case 'open':
        break
      default:
        return Promise.reject(
          new Error(`Unknown SqliteStore status: ${this.#status}`)
        )
    }

    this.#status = 'closing'
    /** @type {Promise<void>} */
    let closePromise = Promise.resolve()
    closePromise = Promise.resolve()
      .then(() => {
        if (this.#closePromise !== closePromise) return
        this.#closeDb('close')
        if (this.#closePromise !== closePromise) return
        this.#status = 'closed'
        this.#closePromise = undefined
        this.#db = undefined
        this.#stmts = undefined
        this.#state = undefined
      })
      .catch((cause) => {
        if (this.#closePromise === closePromise) {
          this.#status = 'open'
          this.#closePromise = undefined
        }
        throw cause
      })
    this.#closePromise = closePromise
    return closePromise
  }

  closeSync() {
    if (this.#status === 'closed') return
    this.#closePromise = undefined
    this.#closeDb('closeSync')
    this.#status = 'closed'
    this.#db = undefined
    this.#stmts = undefined
    this.#state = undefined
  }

  /**
   * @param {string} method
   */
  #checkpointWal(method) {
    const db = this.#requireOpenDb(method)
    db.pragma('wal_checkpoint(TRUNCATE)')
  }

  /**
   * @param {string} method
   */
  #closeDb(method) {
    const db = this.#db
    if (!db) {
      throw new StoreClosedError(method)
    }
    db.pragma('wal_checkpoint(TRUNCATE)')
    db.close()
  }
}

/**
 * @param {BetterSqlite3.Database} db
 */
function applyPragmas(db) {
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('temp_store = MEMORY')
  db.pragma('cache_size = -64000')
  db.pragma('foreign_keys = ON')
}

/**
 * @param {API.MigrationState} state
 * @param {API.SpaceDID} spaceDID
 */
function toSpaceRow(state, spaceDID) {
  const inventory = state.spacesInventories[spaceDID]
  if (!inventory) {
    throw new Error(`Missing inventory for space ${spaceDID}`)
  }

  return {
    did: spaceDID,
    name: inventory.name ?? null,
    phase: state.spaces[spaceDID]?.phase ?? 'pending',
    totalBytes: inventory.totalBytes,
    totalSizeToMigrate: inventory.totalSizeToMigrate,
    readerCursor: state.readerProgressCursors?.[spaceDID] ?? null,
  }
}

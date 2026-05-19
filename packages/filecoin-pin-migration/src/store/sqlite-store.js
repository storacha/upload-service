import { StoreClosedError } from '../errors.js'
import * as State from '../state.js'
import { materializeState } from './sqlite/materialize-state.js'
import { applySqlitePragmas } from './sqlite/pragmas.js'
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
 * Preserves the live-state semantics expected by the reader/planner/migrator
 * pipeline by keeping an identity-stable in-memory {@link API.MigrationState}
 * cache while writing each mutation through to SQLite synchronously.
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

  /** @type {Set<() => void>} */
  #activeIteratorFinalizers = new Set()

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
      applySqlitePragmas(db)
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
   * @returns {API.SpaceInventorySummary | undefined}
   */
  getSpaceInventorySummary(spaceDID) {
    const state = this.#requireOpenState('getSpaceInventorySummary')
    return state.spaceMigrationInventories?.[spaceDID]
  }

  /**
   * @param {API.SpaceDID} spaceDID
   * @returns {number}
   */
  getSpaceDistinctShardCount(spaceDID) {
    this.#requireOpenState('getSpaceDistinctShardCount')
    const row = /** @type {{ count: number } | undefined} */ (
      this.#requireStatements(
        'getSpaceDistinctShardCount'
      ).countDistinctShardsForSpace.get(spaceDID)
    )
    return row?.count ?? 0
  }

  /**
   * @param {API.SpaceDID} spaceDID
   * @returns {Iterable<string>}
   */
  iterateUploads(spaceDID) {
    this.#requireOpenState('iterateUploads')
    const iterable =
      this.#requireStatements('iterateUploads').iterateUploads.iterate(spaceDID)
    const iterator = iterable[Symbol.iterator]()
    return this.#wrapStringIterator(
      'iterateUploads',
      iterator,
      /** @param {{ root_cid: string }} row */ (row) => row.root_cid
    )
  }

  /**
   * @param {API.SpaceDID} spaceDID
   * @returns {Iterable<string>}
   */
  iterateSkippedUploads(spaceDID) {
    this.#requireOpenState('iterateSkippedUploads')
    const iterable =
      this.#requireStatements(
        'iterateSkippedUploads'
      ).iterateSkippedUploads.iterate(spaceDID)
    const iterator = iterable[Symbol.iterator]()
    return this.#wrapStringIterator(
      'iterateSkippedUploads',
      iterator,
      /** @param {{ root_cid: string }} row */ (row) => row.root_cid
    )
  }

  /**
   * @param {API.SpaceDID} spaceDID
   * @returns {Iterable<API.StoreShard>}
   */
  iterateShardsToStore(spaceDID) {
    this.#requireOpenState('iterateShardsToStore')
    const iterable =
      this.#requireStatements(
        'iterateShardsToStore'
      ).iterateShardsToStore.iterate(spaceDID)
    const iterator = iterable[Symbol.iterator]()
    return this.#wrapStoreShardIterator(
      iterator,
      /**
         @param {{
        root_cid: string
        shard_cid: string
        piece_cid: string | null
        source_url: string
        size_bytes: bigint
      }} row */ (row) => ({
        root: row.root_cid,
        cid: row.shard_cid,
        ...(row.piece_cid != null ? { pieceCID: row.piece_cid } : {}),
        sourceURL: row.source_url,
        sizeBytes: row.size_bytes,
      })
    )
  }

  /**
   * @param {API.SpaceDID} spaceDID
   * @param {{ kind?: API.ShardKind }} [options]
   */
  iterateShards(spaceDID, options) {
    this.#requireOpenState('iterateShards')
    const stmts = this.#requireStatements('iterateShards')
    const iterator = options?.kind
      ? stmts.iterateShardsByKind.iterate(spaceDID, options.kind)[
          Symbol.iterator
        ]()
      : stmts.iterateShardsAll.iterate(spaceDID)[Symbol.iterator]()
    return this.#wrapShardIterator('iterateShards', iterator)
  }

  /**
   * @param {API.SpaceDID} spaceDID
   * @param {number} copyIndex
   */
  iterateCommittableShards(spaceDID, copyIndex) {
    this.#requireOpenState('iterateCommittableShards')
    const stmts = this.#requireStatements('iterateCommittableShards')
    return this.#wrapCommittableIterator(
      stmts.iterateCommittableShards.iterate(spaceDID, copyIndex)
    )
  }

  /**
   * @param {string} method
   * @param {Iterator<unknown>} iterator
   */
  #wrapShardIterator(method, iterator) {
    return this.#createStreamingIterator(method, iterator, (row) => {
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

      if (shard.kind === 'pull' && shard.piece_cid == null) {
        throw new Error(
          `pull shard ${shard.shard_cid} (space ${shard.space_did}) is missing piece_cid — data integrity violation`
        )
      }
      return /** @type {API.StoreShardRow} */ ({
        kind: shard.kind,
        spaceDID: shard.space_did,
        shardCid: shard.shard_cid,
        root: shard.root_cid,
        sourceURL: shard.source_url,
        sizeBytes: shard.size_bytes,
        pieceCID: shard.piece_cid,
      })
    })
  }

  /**
   * @param {Iterator<unknown>} iterator
   */
  #wrapCommittableIterator(iterator) {
    return this.#createStreamingIterator(
      'iterateCommittableShards',
      iterator,
      (row) => {
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

        return /** @type {API.StoreShardRow & { pieceCID: string }} */ ({
          kind: shard.kind,
          spaceDID: shard.space_did,
          shardCid: shard.shard_cid,
          root: shard.root_cid,
          sourceURL: shard.source_url,
          sizeBytes: shard.size_bytes,
          pieceCID: shard.piece_cid,
        })
      }
    )
  }

  /**
   * @param {string} method
   * @param {Iterator<unknown>} iterator
   * @param {(row: any) => string} map
   */
  #wrapStringIterator(method, iterator, map) {
    return this.#createStreamingIterator(method, iterator, map)
  }

  /**
   * @param {Iterator<unknown>} iterator
   * @param {(row: any) => API.StoreShard} map
   */
  #wrapStoreShardIterator(iterator, map) {
    return this.#createStreamingIterator('iterateShardsToStore', iterator, map)
  }

  /**
   * @template TRow, TValue
   * @param {string} method
   * @param {Iterator<TRow>} iterator
   * @param {(row: TRow) => TValue} map
   * @returns {IterableIterator<TValue>}
   */
  #createStreamingIterator(method, iterator, map) {
    const finalizer = this.#trackActiveIterator(iterator)

    return {
      [Symbol.iterator]() {
        return this
      },
      next: () => {
        try {
          this.#requireOpenState(method)
        } catch (cause) {
          finalizer()
          throw cause
        }

        const result = iterator.next()
        if (result.done) {
          finalizer()
          return /** @type {IteratorReturnResult<TValue>} */ ({
            done: true,
            value: /** @type {undefined} */ (undefined),
          })
        }

        try {
          return /** @type {IteratorYieldResult<TValue>} */ ({
            done: false,
            value: map(result.value),
          })
        } catch (cause) {
          finalizer()
          throw cause
        }
      },
      return: (value) => {
        finalizer()
        return /** @type {IteratorReturnResult<TValue>} */ ({
          done: true,
          value: /** @type {TValue} */ (value),
        })
      },
      throw: (error) => {
        finalizer()
        throw error
      },
    }
  }

  /**
   * @param {Iterator<unknown>} iterator
   * @returns {() => void}
   */
  #trackActiveIterator(iterator) {
    let active = true
    const finalizer = () => {
      if (!active) return
      active = false
      this.#activeIteratorFinalizers.delete(finalizer)
      if (typeof iterator.return === 'function') {
        iterator.return()
      }
    }
    this.#activeIteratorFinalizers.add(finalizer)
    return finalizer
  }

  #closeActiveIterators() {
    for (const finalizer of [...this.#activeIteratorFinalizers]) {
      finalizer()
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

    delete state.spacesInventories?.[page.spaceDID]
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
    const stmts = this.#requireStatements('recordPull')

    const changed = State.recordPull(state, input)
    if (!state.spaces[input.spaceDID]) return changed

    stmts.upsertPulledProgress.run(
      input.spaceDID,
      input.copyIndex,
      input.shardCid
    )

    return changed
  }

  /**
   * @param {API.RecordCommitInput} input
   */
  recordCommit(input) {
    const state = this.#requireOpenState('recordCommit')
    const stmts = this.#requireStatements('recordCommit')

    State.recordCommit(state, input)
    if (!state.spaces[input.spaceDID]) return

    stmts.insertCommitProgress.run(
      input.spaceDID,
      input.copyIndex,
      input.shardCid,
      input.root
    )
  }

  /**
   * @param {API.SpaceDID} spaceDID
   * @param {string} shardCid
   * @param {string} pieceCID
   * @returns {boolean}
   */
  recordStoredShard(spaceDID, shardCid, pieceCID) {
    const state = this.#requireOpenState('recordStoredShard')
    const stmts = this.#requireStatements('recordStoredShard')

    const changed = State.recordStoredShard(state, spaceDID, shardCid, pieceCID)
    if (!state.spaces[spaceDID]) return changed

    if (changed) {
      stmts.upsertStoredPiece.run(spaceDID, 0, shardCid, pieceCID)
    }

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
    })()
  }

  /**
   * @param {API.SpaceDID} spaceDID
   * @param {number} copyIndex
   * @param {string} shardCid
   */
  clearStoredPiece(spaceDID, copyIndex, shardCid) {
    const state = this.#requireOpenState('clearStoredPiece')
    const stmts = this.#requireStatements('clearStoredPiece')

    State.clearStoredPiece(state, spaceDID, copyIndex, shardCid)
    if (!state.spaces[spaceDID]) return
    stmts.clearStoredPiece.run(spaceDID, copyIndex, shardCid)
  }

  /**
   * @param {API.SpaceDID} spaceDID
   * @param {number} copyIndex
   * @param {string} shardCid
   * @param {string} root
   */
  removeCommit(spaceDID, copyIndex, shardCid, root) {
    const state = this.#requireOpenState('removeCommit')
    const stmts = this.#requireStatements('removeCommit')

    State.removeCommit(state, spaceDID, copyIndex, shardCid, root)
    if (!state.spaces[spaceDID]) return
    stmts.deleteCommitProgress.run(spaceDID, copyIndex, shardCid, root)
  }

  /**
   * @param {API.SpaceDID} spaceDID
   * @param {number} copyIndex
   * @param {string} root
   * @returns {boolean}
   */
  recordFailedUpload(spaceDID, copyIndex, root) {
    const state = this.#requireOpenState('recordFailedUpload')
    const stmts = this.#requireStatements('recordFailedUpload')

    const changed = State.recordFailedUpload(state, spaceDID, copyIndex, root)
    if (!state.spaces[spaceDID]) return changed

    if (changed) {
      stmts.insertFailedUpload.run(spaceDID, copyIndex, root)
    }

    return changed
  }

  /**
   * @param {API.SpaceDID} spaceDID
   * @returns {number}
   */
  clearFailedUploadsForRetry(spaceDID) {
    const state = this.#requireOpenState('clearFailedUploadsForRetry')
    const stmts = this.#requireStatements('clearFailedUploadsForRetry')

    const cleared = State.clearFailedUploadsForRetry(state, spaceDID)
    if (!state.spaces[spaceDID]) return cleared
    stmts.deleteFailedUploadsForSpace.run(spaceDID)
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
    this.#closeActiveIterators()
    db.pragma('wal_checkpoint(TRUNCATE)')
    db.close()
  }
}

/**
 * @param {API.MigrationState} state
 * @param {API.SpaceDID} spaceDID
 */
function toSpaceRow(state, spaceDID) {
  const summary = state.spaceMigrationInventories?.[spaceDID]
  if (!summary) {
    throw new Error(`Missing inventory summary for space ${spaceDID}`)
  }

  return {
    did: spaceDID,
    name: summary.name ?? null,
    phase: state.spaces[spaceDID]?.phase ?? 'pending',
    totalBytes: summary.totalBytes,
    totalSizeToMigrate: summary.totalSizeToMigrate,
    readerCursor: state.readerProgressCursors?.[spaceDID] ?? null,
  }
}

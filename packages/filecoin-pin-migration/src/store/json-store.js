import { readFileSync, writeFileSync, unlinkSync, renameSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { Writer } from 'steno'

import { StoreClosedError } from '../errors.js'
import * as State from '../state.js'

/**
 * @import * as API from '../api.js'
 */

/**
 * @typedef {'open' | 'closing' | 'closed'} StoreStatus
 */

/**
 * JSON-file-backed implementation of {@link API.MigrationStore}.
 *
 * Wraps the existing `src/state.js` helpers and persists the owned
 * {@link API.MigrationState} to a single file via the `steno` async writer.
 *
 * Mutation methods are 1:1 delegates to `state.js` — they update the
 * in-memory state only. Reads and durability (checkpoint/close) are filled in
 * by subsequent C-series tasks.
 *
 * @implements {API.MigrationStore}
 */
export class JsonFileStore {
  /** @type {API.MigrationState | undefined} */
  #state

  /** @type {StoreStatus} */
  #status = 'closed'

  /**
   * In-flight graceful shutdown promise. Set when {@link close} transitions
   * the lifecycle to `'closing'` and cleared once the state reaches
   * `'closed'`. Concurrent `close()` callers await this same promise.
   *
   * @type {Promise<void> | undefined}
   */
  #closePromise

  /** @type {string} */
  #path

  /** @type {string} */
  #lockPath

  /** @type {Writer | undefined} */
  #writer

  /**
   * Construction does not open the file — use {@link JsonFileStore.open}.
   *
   * @param {object} args
   * @param {string} args.path  Absolute path to the JSON state file.
   */
  constructor({ path }) {
    this.#path = path
    this.#lockPath = `${path}.lock`
  }

  /**
   * Open a JSON-file-backed store at the given path. Acquires an exclusive
   * lock file, loads any existing state (or initializes a fresh one), and
   * transitions the lifecycle to `'open'`.
   *
   * The lock file lives at `<path>.lock` and holds the calling process's PID
   * for diagnostics. If another process holds the lock, the call fails with a
   * clear error naming the existing PID.
   *
   * @param {object} args
   * @param {string} args.path
   * @returns {Promise<JsonFileStore>}
   */
  static async open({ path }) {
    const store = new JsonFileStore({ path })
    acquireLock(store.#lockPath)
    try {
      store.#state = loadOrInitState(path)
      store.#writer = new Writer(path)
      store.#status = 'open'
    } catch (cause) {
      releaseLock(store.#lockPath)
      throw cause
    }
    return store
  }

  /**
   * Throw if the store is not in `'open'` state, otherwise return the live
   * {@link API.MigrationState}. Centralizes the lifecycle guard with the
   * `#state`-defined narrowing every mutation/query needs.
   *
   * @param {string} method
   * @returns {API.MigrationState}
   */
  #requireOpenState(method) {
    if (this.#status !== 'open' || !this.#state) {
      throw new StoreClosedError(method)
    }
    return this.#state
  }

  // ── Read access ──────────────────────────────────────────────────────────

  /**
   * Return the live in-memory state owned by this store.
   *
   * Transitional read seam for Commit 2 call-site rewiring — prefer narrow
   * store queries and iterators for new code. On SQLite-backed stores this
   * rematerializes the full state on every call.
   *
   * **Callers MUST NOT mutate the returned object.** The store cannot detect
   * external mutations and they will not be persisted by `checkpoint()`. Use
   * the `record*` / `transitionTo*` / `finalize*` methods instead.
   *
   * @returns {API.MigrationState}
   * @throws {StoreClosedError} If the store is not in `'open'` state.
   */
  getState() {
    return this.#requireOpenState('getState')
  }

  /**
   * @param {API.SpaceDID} spaceDID
   * @param {{ kind?: API.ShardKind }} [options]
   * @returns {Iterable<API.StoreShardRow>}
   */
  iterateShards(spaceDID, options) {
    this.#requireOpenState('iterateShards')
    return this.#iterateRowsGenerator(spaceDID, options?.kind)
  }

  /**
   * @param {API.SpaceDID} spaceDID
   * @param {API.ShardKind | undefined} kindFilter
   * @returns {Generator<API.StoreShardRow>}
   */
  *#iterateRowsGenerator(spaceDID, kindFilter) {
    const state = this.#requireOpenState('iterateShards')
    const inventory = state.spacesInventories[spaceDID]
    if (!inventory) return

    if (!kindFilter || kindFilter === 'pull') {
      for (const shard of inventory.shards) {
        this.#requireOpenState('iterateShards')
        yield /** @type {API.StoreShardRow} */ ({
          kind: 'pull',
          spaceDID,
          shardCid: shard.cid,
          root: shard.root,
          sourceURL: shard.sourceURL,
          sizeBytes: shard.sizeBytes,
          pieceCID: shard.pieceCID,
        })
      }
    }

    if (!kindFilter || kindFilter === 'store') {
      for (const shard of inventory.shardsToStore) {
        this.#requireOpenState('iterateShards')
        yield /** @type {API.StoreShardRow} */ ({
          kind: 'store',
          spaceDID,
          shardCid: shard.cid,
          root: shard.root,
          sourceURL: shard.sourceURL,
          sizeBytes: shard.sizeBytes,
          pieceCID: shard.pieceCID ?? null,
        })
      }
    }
  }

  /**
   * @param {API.SpaceDID} spaceDID
   * @param {number} copyIndex
   * @returns {Iterable<API.StoreShardRow & { pieceCID: string }>}
   */
  iterateCommittableShards(spaceDID, copyIndex) {
    this.#requireOpenState('iterateCommittableShards')
    return this.#iterateCommittableRowsGenerator(spaceDID, copyIndex)
  }

  /**
   * @param {API.SpaceDID} spaceDID
   * @param {number} copyIndex
   * @returns {Generator<API.StoreShardRow & { pieceCID: string }>}
   */
  *#iterateCommittableRowsGenerator(spaceDID, copyIndex) {
    const state = this.#requireOpenState('iterateCommittableShards')
    const inventory = state.spacesInventories[spaceDID]
    if (!inventory) return

    const space = state.spaces[spaceDID]
    if (!space) return

    const copy = space.copies.find((c) => c.copyIndex === copyIndex)
    if (!copy) return

    const copy0 = space.copies.find((c) => c.copyIndex === 0)

    for (const shard of inventory.shards) {
      if (
        !copy.pulled.has(shard.cid) ||
        copy.committed.has(State.commitKey(shard.cid, shard.root))
      ) {
        continue
      }
      this.#requireOpenState('iterateCommittableShards')
      yield /** @type {API.StoreShardRow & { pieceCID: string }} */ ({
        kind: 'pull',
        spaceDID,
        shardCid: shard.cid,
        root: shard.root,
        sourceURL: shard.sourceURL,
        sizeBytes: shard.sizeBytes,
        pieceCID: shard.pieceCID,
      })
    }

    for (const shard of inventory.shardsToStore) {
      if (
        !copy.pulled.has(shard.cid) ||
        copy.committed.has(State.commitKey(shard.cid, shard.root))
      ) {
        continue
      }

      const pieceCID =
        shard.pieceCID ?? (copy0 ? copy0.storedShards[shard.cid] : undefined)
      if (!pieceCID) continue

      this.#requireOpenState('iterateCommittableShards')
      yield /** @type {API.StoreShardRow & { pieceCID: string }} */ ({
        kind: 'store',
        spaceDID,
        shardCid: shard.cid,
        root: shard.root,
        sourceURL: shard.sourceURL,
        sizeBytes: shard.sizeBytes,
        pieceCID,
      })
    }
  }

  // These methods update in-memory state only.
  // They do NOT persist to disk — callers must `await checkpoint()` (or `close()`) to flush.
  // A crash after a mutation but before `checkpoint()` loses that mutation.
  // ── Mutations (1:1 with state.js) ────────────────────────────────────────

  /** @param {API.CheckpointInventoryPageInput} page */
  checkpointInventoryPage(page) {
    const state = this.#requireOpenState('checkpointInventoryPage')
    State.checkpointInventoryPage(state, page)
  }

  /** @param {API.PerSpaceCost[]} perSpaceCost */
  transitionToApproved(perSpaceCost) {
    const state = this.#requireOpenState('transitionToApproved')
    State.transitionToApproved(state, perSpaceCost)
  }

  transitionToFunded() {
    const state = this.#requireOpenState('transitionToFunded')
    State.transitionToFunded(state)
  }

  /**
   * @param {API.RecordPullInput} input
   * @returns {boolean}
   */
  recordPull(input) {
    const state = this.#requireOpenState('recordPull')
    return State.recordPull(state, input)
  }

  /** @param {API.RecordCommitInput} input */
  recordCommit(input) {
    const state = this.#requireOpenState('recordCommit')
    State.recordCommit(state, input)
  }

  /**
   * Stored-shard tracking is only meaningful for copy 0 — the underlying state
   * helper writes to copy 0 regardless of the caller's perspective.
   *
   * @param {API.SpaceDID} spaceDID
   * @param {string} shardCid
   * @param {string} pieceCID
   * @returns {boolean}
   */
  recordStoredShard(spaceDID, shardCid, pieceCID) {
    const state = this.#requireOpenState('recordStoredShard')
    return State.recordStoredShard(state, spaceDID, shardCid, pieceCID)
  }

  /**
   * @param {API.SpaceDID} spaceDID
   * @param {number} copyIndex
   * @param {string} root
   * @returns {boolean}
   */
  recordFailedUpload(spaceDID, copyIndex, root) {
    const state = this.#requireOpenState('recordFailedUpload')
    return State.recordFailedUpload(state, spaceDID, copyIndex, root)
  }

  /**
   * @param {API.SpaceDID} spaceDID
   * @returns {number}
   */
  clearFailedUploadsForRetry(spaceDID) {
    const state = this.#requireOpenState('clearFailedUploadsForRetry')
    return State.clearFailedUploadsForRetry(state, spaceDID)
  }

  /** @param {API.SpaceDID} spaceDID */
  finalizeSpace(spaceDID) {
    const state = this.#requireOpenState('finalizeSpace')
    State.finalizeSpace(state, spaceDID)
  }

  finalizeMigration() {
    const state = this.#requireOpenState('finalizeMigration')
    State.finalizeMigration(state)
  }

  // ── Durability + lifecycle ───────────────────────────────────────────────

  /** @returns {Promise<void>} */
  async checkpoint() {
    const state = this.#requireOpenState('checkpoint')
    const writer = this.#writer
    if (!writer) {
      throw new StoreClosedError('checkpoint')
    }
    const serialized = State.serializeState(state)
    const json = JSON.stringify(serialized)
    await writer.write(json)
  }

  /**
   * Graceful shutdown — idempotent. Concurrent `close()` calls await the
   * single in-flight shutdown promise; calls after the FSM reaches
   * `'closed'` resolve immediately.
   *
   * @returns {Promise<void>}
   */
  close() {
    switch (this.#status) {
      case 'closed':
        return Promise.resolve()
      case 'closing':
        if (!this.#closePromise) {
          return Promise.reject(
            new Error(
              "JsonFileStore invariant violated: status 'closing' requires #closePromise"
            )
          )
        }
        return this.#closePromise
      case 'open':
        break
      default:
        return Promise.reject(
          new Error(`Unknown JsonFileStore status: ${this.#status}`)
        )
    }

    const state = /** @type {API.MigrationState} */ (this.#state)
    const writer = this.#writer
    if (!writer) {
      return Promise.reject(new StoreClosedError('close'))
    }
    this.#status = 'closing'
    /** @type {Promise<void>} */
    let closePromise = Promise.resolve()
    closePromise = (async () => {
      try {
        const json = JSON.stringify(State.serializeState(state))
        await writer.write(json)
        if (this.#closePromise !== closePromise) {
          return
        }
        releaseLock(this.#lockPath)
        this.#status = 'closed'
        this.#closePromise = undefined
      } catch (cause) {
        if (this.#closePromise !== closePromise) {
          throw cause
        }
        this.#status = 'open'
        this.#closePromise = undefined
        throw cause
      }
    })()
    this.#closePromise = closePromise
    return closePromise
  }

  /**
   * Emergency synchronous shutdown — idempotent. Subsequent calls are no-ops.
   *
   * Use only from synchronous shutdown paths (e.g., SIGINT handler). Prefer
   * `close()` whenever possible.
   *
   * On write failure (disk full, EROFS, etc.) the previous on-disk checkpoint
   * is preserved and the lock is still released; failures are not surfaced.
   */
  closeSync() {
    if (this.#status === 'closed') return

    // If a graceful close is in flight, its steno write promise will settle
    // into the void. Attach a no-op catch so the rejection (if any) does not
    // surface as an unhandledRejection after we forcibly close.
    if (this.#status === 'closing' && this.#closePromise) {
      this.#closePromise.catch(() => {})
    }

    if (this.#state !== undefined) {
      const state = /** @type {API.MigrationState} */ (this.#state)
      const dir = dirname(this.#path)
      const tmp = join(
        dir,
        '.' + basename(this.#path) + '.' + process.pid + '.tmp'
      )
      try {
        writeFileSync(tmp, JSON.stringify(State.serializeState(state)))
        renameSync(tmp, this.#path)
      } catch {
        // Best-effort: if the write fails (disk full, EROFS, etc.) the last
        // checkpointed state on disk is still valid. Prioritise releasing the
        // lock so the next run can start cleanly.
      }
    }

    releaseLock(this.#lockPath)
    this.#status = 'closed'
    this.#closePromise = undefined
  }
}

/**
 * Acquire an exclusive lock by atomically creating `<path>.lock` with the
 * current process PID as its contents. Throws a clear error if the lock is
 * already held — best-effort reads the holder PID for diagnostics.
 *
 * @param {string} lockPath
 */
function acquireLock(lockPath) {
  try {
    writeFileSync(lockPath, String(process.pid), { flag: 'wx' })
  } catch (cause) {
    if (isErrnoException(cause) && cause.code === 'EEXIST') {
      const holder = readLockHolder(lockPath)
      throw new Error(
        `MigrationStore: lock file ${lockPath} already exists (holder PID: ${holder}). Another migration may be running, or a previous run crashed without releasing the lock.`,
        { cause }
      )
    }
    throw cause
  }
}

/**
 * @param {string} lockPath
 * @returns {string}
 */
function readLockHolder(lockPath) {
  try {
    const raw = readFileSync(lockPath, 'utf8').trim()
    return raw || 'unknown'
  } catch {
    return 'unknown'
  }
}

/**
 * Release the lock file. Best-effort — missing files are ignored so callers
 * can use this in shutdown / error paths without extra branching.
 *
 * @param {string} lockPath
 */
function releaseLock(lockPath) {
  try {
    unlinkSync(lockPath)
  } catch (cause) {
    if (isErrnoException(cause) && cause.code === 'ENOENT') return
    throw cause
  }
}

/**
 * Load the persisted state from disk, or return a fresh one when the file is
 * missing. Any other I/O or parse error propagates.
 *
 * @param {string} path
 * @returns {API.MigrationState}
 */
function loadOrInitState(path) {
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch (cause) {
    if (isErrnoException(cause) && cause.code === 'ENOENT') {
      return State.createInitialState()
    }
    throw cause
  }
  return State.deserializeState(JSON.parse(raw))
}

/**
 * @param {unknown} value
 * @returns {value is NodeJS.ErrnoException}
 */
function isErrnoException(value) {
  return (
    value instanceof Error &&
    typeof (/** @type {NodeJS.ErrnoException} */ (value).code) === 'string'
  )
}

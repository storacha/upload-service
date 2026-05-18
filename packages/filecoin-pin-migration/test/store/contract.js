import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { StoreClosedError } from '../../src/errors.js'
import * as State from '../../src/state.js'

/**
 * @import * as API from '../../src/api.js'
 */

/**
 * Shared contract suite. Every {@link API.MigrationStore} backend wires
 * itself in by passing a factory bound to its own implementation:
 *
 *   runStoreContractTests('JsonFileStore', (path) => JsonFileStore.open({ path }))
 *
 * Each `it(...)` block runs against a fresh tmpdir so concurrent runs do
 * not collide.
 *
 * @param {string} name
 * @param {(path: string) => Promise<API.MigrationStore>} createStore
 */
export function runStoreContractTests(name, createStore) {
  describe(name, () => {
    /** @type {string} */
    let dir
    /** @type {string} */
    let storePath
    /** @type {API.MigrationStore | undefined} */
    let activeStore

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'store-contract-'))
      storePath = join(dir, 'state.json')
      activeStore = undefined
    })

    afterEach(async () => {
      const store = activeStore
      activeStore = undefined

      try {
        if (store) {
          await store.close()
        }
      } finally {
        await rm(dir, { recursive: true, force: true })
      }
    })

    /**
     * Open a store at the per-test path and track it for afterEach cleanup.
     * Reopen scenarios must close the previous handle first, then call
     * `untrack()` before opening again — `open()` fails fast on a tracked
     * handle to prevent hidden resource leaks.
     */
    async function open() {
      if (activeStore) {
        throw new Error(
          'test/store/contract open(): active store already tracked; close and untrack it before reopening'
        )
      }

      activeStore = await createStore(storePath)
      return activeStore
    }

    /** Clear the tracked handle so afterEach does not try to close it again. */
    function untrack() {
      activeStore = undefined
    }

    describe('lifecycle FSM', () => {
      it('open → close() → store is closed', async () => {
        const store = await open()
        await store.close()
        untrack()
        expect(() => store.getState()).toThrow(StoreClosedError)
      })

      it('open → closeSync() → store is closed', async () => {
        const store = await open()
        store.closeSync()
        untrack()
        expect(() => store.getState()).toThrow(StoreClosedError)
      })

      it('concurrent close() × 2 share the same promise', async () => {
        const store = await open()
        const p1 = store.close()
        const p2 = store.close()
        expect(p1).toBe(p2)
        await Promise.all([p1, p2])
        untrack()
      })

      it('close() after closeSync() is a no-op', async () => {
        const store = await open()
        store.closeSync()
        await expect(store.close()).resolves.toBeUndefined()
        untrack()
      })

      it('closeSync() after close() is a no-op', async () => {
        const store = await open()
        await store.close()
        expect(() => store.closeSync()).not.toThrow()
        expect(() => store.getState()).toThrow(StoreClosedError)
        untrack()
      })
    })

    describe('phase transitions', () => {
      it('transitionToPlanning() sets phase to planning', async () => {
        const store = await open()
        expect(store.getState().phase).toBe('reading')
        store.transitionToPlanning()
        expect(store.getState().phase).toBe('planning')
        await store.close()
        untrack()
      })

      it('transitionToMigrating() sets phase to migrating', async () => {
        const store = await open()
        store.transitionToMigrating()
        expect(store.getState().phase).toBe('migrating')
        await store.close()
        untrack()
      })
    })

    describe('post-close throws', () => {
      const spaceDID = /** @type {API.SpaceDID} */ ('did:key:zABC')

      it('all queries throw after close', async () => {
        const store = await open()
        await store.close()
        untrack()

        expect(() => store.getState()).toThrow(StoreClosedError)
        expect(() => store.iterateShards(spaceDID)).toThrow(StoreClosedError)
        expect(() => store.iterateCommittableShards(spaceDID, 0)).toThrow(
          StoreClosedError
        )
      })

      it('all mutations throw after close', async () => {
        const store = await open()
        await store.close()
        untrack()

        /** @type {Array<[string, () => unknown]>} */
        const cases = [
          [
            'checkpointInventoryPage',
            () =>
              store.checkpointInventoryPage(
                /** @type {any} */ ({
                  spaceDID,
                  shards: [],
                  shardsToStore: [],
                  uploads: [],
                  skippedUploads: [],
                  totalBytes: 0n,
                  totalSizeToMigrate: 0n,
                  cursor: undefined,
                  isFinal: true,
                })
              ),
          ],
          ['transitionToPlanning', () => store.transitionToPlanning()],
          ['transitionToMigrating', () => store.transitionToMigrating()],
          ['transitionToApproved', () => store.transitionToApproved([])],
          ['transitionToFunded', () => store.transitionToFunded()],
          [
            'recordPull',
            () =>
              store.recordPull(
                /** @type {any} */ ({
                  spaceDID,
                  copyIndex: 0,
                  shardCid: 'x',
                  shardRoots: [],
                })
              ),
          ],
          [
            'recordCommit',
            () =>
              store.recordCommit(
                /** @type {any} */ ({
                  spaceDID,
                  copyIndex: 0,
                  shardCid: 'x',
                  root: 'r',
                  dataSetId: 0n,
                  shardRoots: [],
                })
              ),
          ],
          [
            'recordStoredShard',
            () => store.recordStoredShard(spaceDID, 'cid', 'pieceCID'),
          ],
          [
            'clearPullProgress',
            () => store.clearPullProgress(spaceDID, 0, 'cid'),
          ],
          [
            'clearStoredPiece',
            () => store.clearStoredPiece(spaceDID, 0, 'cid'),
          ],
          [
            'removeCommit',
            () => store.removeCommit(spaceDID, 0, 'cid', 'rootCid'),
          ],
          [
            'recordFailedUpload',
            () => store.recordFailedUpload(spaceDID, 0, 'rootCid'),
          ],
          [
            'clearFailedUploadsForRetry',
            () => store.clearFailedUploadsForRetry(spaceDID),
          ],
          ['finalizeSpace', () => store.finalizeSpace(spaceDID)],
          ['finalizeMigration', () => store.finalizeMigration()],
        ]

        for (const [label, fn] of cases) {
          expect(fn, label).toThrow(StoreClosedError)
        }
      })

      it('checkpoint() rejects after close', async () => {
        const store = await open()
        await store.close()
        untrack()

        await expect(store.checkpoint()).rejects.toThrow(StoreClosedError)
      })

      it("checkpoint() rejects while in 'closing' state", async () => {
        const store = await open()
        const closePromise = store.close()

        await expect(store.checkpoint()).rejects.toThrow(StoreClosedError)

        await closePromise
        untrack()
      })
    })

    describe('iterator semantics', () => {
      const spaceDID = /** @type {API.SpaceDID} */ ('did:key:zIterTest')

      /** @type {API.ResolvedShard} */
      const pullShard1 = {
        root: 'bafy-root-1',
        cid: 'bafy-shard-1',
        pieceCID: 'bafkz-piece-1',
        sourceURL: 'https://example.com/1',
        sizeBytes: 100n,
      }

      /** @type {API.ResolvedShard} */
      const pullShard2 = {
        root: 'bafy-root-2',
        cid: 'bafy-shard-2',
        pieceCID: 'bafkz-piece-2',
        sourceURL: 'https://example.com/2',
        sizeBytes: 200n,
      }

      /** @type {API.StoreShard} */
      const storeShardWithPiece = {
        root: 'bafy-root-3',
        cid: 'bafy-shard-3',
        pieceCID: 'bafkz-piece-3',
        sourceURL: 'https://example.com/3',
        sizeBytes: 300n,
      }

      /** @type {API.StoreShard} */
      const storeShardNullPiece = {
        root: 'bafy-root-4',
        cid: 'bafy-shard-4',
        // no pieceCID — not yet committable
        sourceURL: 'https://example.com/4',
        sizeBytes: 400n,
      }

      it('iterateShards() throws at creation if store is not open', async () => {
        const store = await open()
        await store.close()
        untrack()
        expect(() => store.iterateShards(spaceDID)).toThrow(StoreClosedError)
      })

      it('iterateShards() yields pull and store rows for the seeded space', async () => {
        const store = await open()

        store.checkpointInventoryPage({
          spaceDID,
          shards: [pullShard1, pullShard2],
          shardsToStore: [storeShardWithPiece],
          uploads: ['bafy-root-1', 'bafy-root-2'],
          skippedUploads: [],
          totalBytes: 600n,
          totalSizeToMigrate: 600n,
          cursor: undefined,
        })

        const rows = [...store.iterateShards(spaceDID)]

        expect(rows).toHaveLength(3)

        const pullRows = rows.filter((r) => r.kind === 'pull')
        const storeRows = rows.filter((r) => r.kind === 'store')

        expect(pullRows).toHaveLength(2)
        expect(storeRows).toHaveLength(1)

        const pull1 = pullRows.find((r) => r.shardCid === 'bafy-shard-1')
        expect(pull1).toBeDefined()
        expect(pull1?.root).toBe('bafy-root-1')
        expect(pull1?.pieceCID).toBe('bafkz-piece-1')
        expect(pull1?.sizeBytes).toBe(100n)

        const pull2 = pullRows.find((r) => r.shardCid === 'bafy-shard-2')
        expect(pull2).toBeDefined()
        expect(pull2?.root).toBe('bafy-root-2')
        expect(pull2?.pieceCID).toBe('bafkz-piece-2')
        expect(pull2?.sizeBytes).toBe(200n)

        const store1 = storeRows.find((r) => r.shardCid === 'bafy-shard-3')
        expect(store1).toBeDefined()
        expect(store1?.root).toBe('bafy-root-3')
        expect(store1?.pieceCID).toBe('bafkz-piece-3')
        expect(store1?.sizeBytes).toBe(300n)
      })

      it("iterateShards({ kind: 'pull' }) yields only pull rows; kind: 'store' yields only store rows", async () => {
        const store = await open()

        store.checkpointInventoryPage({
          spaceDID,
          shards: [pullShard1, pullShard2],
          shardsToStore: [storeShardWithPiece],
          uploads: ['bafy-root-1', 'bafy-root-2'],
          skippedUploads: [],
          totalBytes: 600n,
          totalSizeToMigrate: 600n,
          cursor: undefined,
        })

        const pullRows = [...store.iterateShards(spaceDID, { kind: 'pull' })]
        expect(pullRows).toHaveLength(2)
        expect(pullRows.every((r) => r.kind === 'pull')).toBe(true)

        const storeRows = [...store.iterateShards(spaceDID, { kind: 'store' })]
        expect(storeRows).toHaveLength(1)
        expect(storeRows.every((r) => r.kind === 'store')).toBe(true)
      })

      it('iterateShards() mid-iteration .next() throws after closeSync()', async () => {
        const store = await open()

        store.checkpointInventoryPage({
          spaceDID,
          shards: [pullShard1, pullShard2],
          shardsToStore: [],
          uploads: ['bafy-root-1', 'bafy-root-2'],
          skippedUploads: [],
          totalBytes: 300n,
          totalSizeToMigrate: 300n,
          cursor: undefined,
        })

        const iter = store.iterateShards(spaceDID)[Symbol.iterator]()

        const first = iter.next()
        expect(first.done).toBe(false)

        store.closeSync()
        untrack()

        expect(() => iter.next()).toThrow(StoreClosedError)
      })

      it('iterateCommittableShards() excludes store-kind rows with null pieceCID', async () => {
        const store = await open()

        // Seed inventory: one pull shard (has pieceCID) + one store shard (no pieceCID)
        store.checkpointInventoryPage({
          spaceDID,
          shards: [pullShard1],
          shardsToStore: [storeShardNullPiece],
          uploads: ['bafy-root-1'],
          skippedUploads: [],
          totalBytes: 500n,
          totalSizeToMigrate: 500n,
          cursor: undefined,
        })

        // transitionToApproved requires PerSpaceCost[] — use any cast since we
        // have no live StorageContext here; state.js does not deep-validate context.
        store.transitionToApproved(
          /** @type {any} */ ([
            {
              spaceDID,
              isResumed: false,
              bytesToMigrate: 500n,
              currentDataSetSize: 0n,
              lockupUSDFC: 0n,
              sybilFee: 0n,
              cdnFixedLockup: 0n,
              rateLockupDelta: 0n,
              ratePerEpoch: 0n,
              ratePerMonth: 0n,
              copies: [
                {
                  copyIndex: 0,
                  spaceDID,
                  providerId: 1n,
                  serviceProvider: /** @type {`0x${string}`} */ ('0xABCD'),
                  dataSetId: null,
                  context: {},
                  withCDN: false,
                  isResumed: false,
                  bytesToMigrate: 500n,
                  currentDataSetSize: 0n,
                  lockupUSDFC: 0n,
                  sybilFee: 0n,
                  cdnFixedLockup: 0n,
                  rateLockupDelta: 0n,
                  ratePerEpoch: 0n,
                  ratePerMonth: 0n,
                },
                {
                  copyIndex: 1,
                  spaceDID,
                  providerId: 2n,
                  serviceProvider: /** @type {`0x${string}`} */ ('0xDEAD'),
                  dataSetId: null,
                  context: {},
                  withCDN: false,
                  isResumed: false,
                  bytesToMigrate: 500n,
                  currentDataSetSize: 0n,
                  lockupUSDFC: 0n,
                  sybilFee: 0n,
                  cdnFixedLockup: 0n,
                  rateLockupDelta: 0n,
                  ratePerEpoch: 0n,
                  ratePerMonth: 0n,
                },
              ],
            },
          ])
        )

        store.transitionToFunded()

        // recordPull on copy 0 for BOTH shards so the not-pulled filter is
        // satisfied; the pieceCID-null check becomes the load-bearing branch
        // for excluding the store shard.
        store.recordPull({
          spaceDID,
          copyIndex: 0,
          shardCid: 'bafy-shard-1',
          shardRoots: ['bafy-root-1'],
        })
        store.recordPull({
          spaceDID,
          copyIndex: 0,
          shardCid: 'bafy-shard-4',
          shardRoots: ['bafy-root-4'],
        })

        // iterateCommittableShards(spaceDID, 0) must yield only the pull shard —
        // the store shard is pulled but has no pieceCID and must be excluded.
        const rows = [...store.iterateCommittableShards(spaceDID, 0)]

        expect(rows).toHaveLength(1)
        expect(rows[0].kind).toBe('pull')
        expect(rows[0].shardCid).toBe('bafy-shard-1')
        expect(rows[0].pieceCID).toBe('bafkz-piece-1')
      })
    })

    describe('mutations + durability', () => {
      // Stable DID for this block — distinct from B4's 'did:key:zIterTest'.
      const spaceDID = /** @type {API.SpaceDID} */ ('did:key:zMutDurTest')

      // ── Seed shapes (self-contained — not shared with B4) ──────────────────

      /** @type {API.ResolvedShard} */
      const pullShard1 = {
        root: 'bafy-mut-root-1',
        cid: 'bafy-mut-shard-1',
        pieceCID: 'bafkz-mut-piece-1',
        sourceURL: 'https://example.com/mut/1',
        sizeBytes: 100n,
      }

      /** @type {API.StoreShard} */
      const storeShard1 = {
        root: 'bafy-mut-root-2',
        cid: 'bafy-mut-shard-2',
        pieceCID: 'bafkz-mut-piece-2',
        sourceURL: 'https://example.com/mut/2',
        sizeBytes: 200n,
      }

      /** Shared page input used across tests. */
      const pageInput = {
        spaceDID,
        shards: [pullShard1],
        shardsToStore: [storeShard1],
        uploads: ['bafy-mut-root-1'],
        skippedUploads: [],
        totalBytes: 300n,
        totalSizeToMigrate: 300n,
        cursor: undefined,
      }

      /** Shared per-space cost used across tests. */
      const perSpaceCost = /** @type {any} */ ([
        {
          spaceDID,
          isResumed: false,
          bytesToMigrate: 300n,
          currentDataSetSize: 0n,
          lockupUSDFC: 0n,
          sybilFee: 0n,
          cdnFixedLockup: 0n,
          rateLockupDelta: 0n,
          ratePerEpoch: 0n,
          ratePerMonth: 0n,
          copies: [
            {
              copyIndex: 0,
              spaceDID,
              providerId: 10n,
              serviceProvider: /** @type {`0x${string}`} */ ('0x1111'),
              dataSetId: null,
              context: {},
              withCDN: false,
              isResumed: false,
              bytesToMigrate: 300n,
              currentDataSetSize: 0n,
              lockupUSDFC: 0n,
              sybilFee: 0n,
              cdnFixedLockup: 0n,
              rateLockupDelta: 0n,
              ratePerEpoch: 0n,
              ratePerMonth: 0n,
            },
            {
              copyIndex: 1,
              spaceDID,
              providerId: 20n,
              serviceProvider: /** @type {`0x${string}`} */ ('0x2222'),
              dataSetId: null,
              context: {},
              withCDN: false,
              isResumed: false,
              bytesToMigrate: 300n,
              currentDataSetSize: 0n,
              lockupUSDFC: 0n,
              sybilFee: 0n,
              cdnFixedLockup: 0n,
              rateLockupDelta: 0n,
              ratePerEpoch: 0n,
              ratePerMonth: 0n,
            },
          ],
        },
      ])

      // ── Layer A: Parity — full mutation sequence matches state.js ──────────

      it('parity: full mutation sequence matches state.js', async () => {
        const store = await open()
        const ref = State.createInitialState()

        // Step 1: checkpointInventoryPage
        store.checkpointInventoryPage(pageInput)
        State.checkpointInventoryPage(ref, pageInput)
        expect(State.serializeState(store.getState())).toEqual(
          State.serializeState(ref)
        )

        // Step 2: transitionToApproved
        store.transitionToApproved(perSpaceCost)
        State.transitionToApproved(ref, perSpaceCost)
        expect(State.serializeState(store.getState())).toEqual(
          State.serializeState(ref)
        )

        // Step 3: transitionToFunded
        store.transitionToFunded()
        State.transitionToFunded(ref)
        expect(State.serializeState(store.getState())).toEqual(
          State.serializeState(ref)
        )

        // Step 4: recordPull (copy 0, pull shard)
        const pullInput = {
          spaceDID,
          copyIndex: 0,
          shardCid: 'bafy-mut-shard-1',
          shardRoots: ['bafy-mut-root-1'],
        }
        store.recordPull(pullInput)
        State.recordPull(ref, pullInput)
        expect(State.serializeState(store.getState())).toEqual(
          State.serializeState(ref)
        )

        // Step 5: recordStoredShard (copy 0, store shard)
        store.recordStoredShard(
          spaceDID,
          'bafy-mut-shard-2',
          'bafkz-mut-piece-2'
        )
        State.recordStoredShard(
          ref,
          spaceDID,
          'bafy-mut-shard-2',
          'bafkz-mut-piece-2'
        )
        expect(State.serializeState(store.getState())).toEqual(
          State.serializeState(ref)
        )

        // Step 6: clearStoredPiece (copy 0 staged-store correction)
        store.clearStoredPiece(spaceDID, 0, 'bafy-mut-shard-2')
        State.clearStoredPiece(ref, spaceDID, 0, 'bafy-mut-shard-2')
        expect(State.serializeState(store.getState())).toEqual(
          State.serializeState(ref)
        )

        // Step 7: recordFailedUpload (copy 0)
        store.recordFailedUpload(spaceDID, 0, 'bafy-mut-root-1')
        State.recordFailedUpload(ref, spaceDID, 0, 'bafy-mut-root-1')
        expect(State.serializeState(store.getState())).toEqual(
          State.serializeState(ref)
        )

        // Step 8: clearFailedUploadsForRetry
        store.clearFailedUploadsForRetry(spaceDID)
        State.clearFailedUploadsForRetry(ref, spaceDID)
        expect(State.serializeState(store.getState())).toEqual(
          State.serializeState(ref)
        )

        // Step 9: recordCommit (copy 0, pull shard) — pulled first in step 4
        const commitInput = {
          spaceDID,
          copyIndex: 0,
          shardCid: 'bafy-mut-shard-1',
          root: 'bafy-mut-root-1',
          dataSetId: 42n,
          shardRoots: ['bafy-mut-root-1'],
        }
        store.recordCommit(commitInput)
        State.recordCommit(ref, commitInput)
        expect(State.serializeState(store.getState())).toEqual(
          State.serializeState(ref)
        )

        // Step 10: removeCommit (helper-driven stale commit correction)
        store.removeCommit(spaceDID, 0, 'bafy-mut-shard-1', 'bafy-mut-root-1')
        State.removeCommit(
          ref,
          spaceDID,
          0,
          'bafy-mut-shard-1',
          'bafy-mut-root-1'
        )
        expect(State.serializeState(store.getState())).toEqual(
          State.serializeState(ref)
        )

        // Step 11: clearPullProgress (helper-driven stale pull correction)
        store.clearPullProgress(spaceDID, 0, 'bafy-mut-shard-1')
        State.clearPullProgress(ref, spaceDID, 0, 'bafy-mut-shard-1')
        expect(State.serializeState(store.getState())).toEqual(
          State.serializeState(ref)
        )

        // Step 12: finalizeSpace
        store.finalizeSpace(spaceDID)
        State.finalizeSpace(ref, spaceDID)
        expect(State.serializeState(store.getState())).toEqual(
          State.serializeState(ref)
        )

        // Step 13: finalizeMigration
        store.finalizeMigration()
        State.finalizeMigration(ref)
        expect(State.serializeState(store.getState())).toEqual(
          State.serializeState(ref)
        )

        await store.close()
        untrack()
      })

      // ── Layer B: Durability across shutdown paths ──────────────────────────

      it('mutation + checkpoint() survives reopen', async () => {
        const store = await open()
        store.checkpointInventoryPage(pageInput)
        await store.checkpoint()
        await store.close()
        untrack()

        const reopened = await open()
        const rows = [...reopened.iterateShards(spaceDID)]
        expect(rows).toHaveLength(2)
        await reopened.close()
        untrack()
      })

      it('mutation + close() (no explicit checkpoint) survives reopen', async () => {
        const store = await open()
        store.checkpointInventoryPage(pageInput)
        await store.close()
        untrack()

        const reopened = await open()
        const rows = [...reopened.iterateShards(spaceDID)]
        expect(rows).toHaveLength(2)
        await reopened.close()
        untrack()
      })

      it('mutation + closeSync() survives reopen', async () => {
        const store = await open()
        store.checkpointInventoryPage(pageInput)
        store.closeSync()
        untrack()

        const reopened = await open()
        const rows = [...reopened.iterateShards(spaceDID)]
        expect(rows).toHaveLength(2)
        await reopened.close()
        untrack()
      })
    })

    describe('initial state + roundtrip', () => {
      const spaceDID = /** @type {API.SpaceDID} */ ('did:key:zRoundtripTest')

      /** @type {API.ResolvedShard} */
      const pullShard = {
        root: 'bafy-rt-root-1',
        cid: 'bafy-rt-shard-1',
        pieceCID: 'bafkz-rt-piece-1',
        sourceURL: 'https://example.com/rt/1',
        sizeBytes: 100n,
      }

      /** @type {API.ResolvedShard} */
      const pullShard2 = {
        root: 'bafy-rt-root-2',
        cid: 'bafy-rt-shard-2',
        pieceCID: 'bafkz-rt-piece-2',
        sourceURL: 'https://example.com/rt/2',
        sizeBytes: 100n,
      }

      /** @type {API.StoreShard} — has pieceCID */
      const storeShardWithPiece = {
        root: 'bafy-rt-root-3',
        cid: 'bafy-rt-shard-3',
        pieceCID: 'bafkz-rt-piece-3',
        sourceURL: 'https://example.com/rt/3',
        sizeBytes: 200n,
      }

      /** @type {API.StoreShard} — no pieceCID */
      const storeShardNoPiece = {
        root: 'bafy-rt-root-4',
        cid: 'bafy-rt-shard-4',
        sourceURL: 'https://example.com/rt/4',
        sizeBytes: 150n,
      }

      const perSpaceCost = /** @type {any} */ ([
        {
          spaceDID,
          isResumed: false,
          bytesToMigrate: 300n,
          currentDataSetSize: 0n,
          lockupUSDFC: 0n,
          sybilFee: 0n,
          cdnFixedLockup: 0n,
          rateLockupDelta: 0n,
          ratePerEpoch: 0n,
          ratePerMonth: 0n,
          copies: [
            {
              copyIndex: 0,
              spaceDID,
              providerId: 10n,
              serviceProvider: /** @type {`0x${string}`} */ ('0xAAAA'),
              dataSetId: null,
              context: {},
              withCDN: false,
              isResumed: false,
              bytesToMigrate: 300n,
              currentDataSetSize: 0n,
              lockupUSDFC: 0n,
              sybilFee: 0n,
              cdnFixedLockup: 0n,
              rateLockupDelta: 0n,
              ratePerEpoch: 0n,
              ratePerMonth: 0n,
            },
            {
              copyIndex: 1,
              spaceDID,
              providerId: 20n,
              serviceProvider: /** @type {`0x${string}`} */ ('0xBBBB'),
              dataSetId: null,
              context: {},
              withCDN: false,
              isResumed: false,
              bytesToMigrate: 300n,
              currentDataSetSize: 0n,
              lockupUSDFC: 0n,
              sybilFee: 0n,
              cdnFixedLockup: 0n,
              rateLockupDelta: 0n,
              ratePerEpoch: 0n,
              ratePerMonth: 0n,
            },
          ],
        },
      ])

      it('fresh store yields the canonical initial state', async () => {
        const store = await open()
        const state = store.getState()
        expect(State.serializeState(state)).toEqual(
          State.serializeState(State.createInitialState())
        )
        // Also assert raw structural equality to catch non-serialized cruft
        // (Symbols, undefined fields, etc.) that serializeState would smooth over.
        expect(state).toEqual(State.createInitialState())
        await store.close()
        untrack()
      })

      it('record pulls/commits round-trip through close → reopen', async () => {
        // ── Build live state ──────────────────────────────────────────────────
        const store = await open()

        const pageInput = {
          spaceDID,
          shards: [pullShard],
          shardsToStore: [storeShardWithPiece],
          uploads: ['bafy-rt-root-1'],
          skippedUploads: [],
          totalBytes: 300n,
          totalSizeToMigrate: 300n,
          cursor: undefined,
        }

        store.checkpointInventoryPage(pageInput)
        store.transitionToApproved(perSpaceCost)
        store.transitionToFunded()

        const pullInput = {
          spaceDID,
          copyIndex: 0,
          shardCid: 'bafy-rt-shard-1',
          shardRoots: ['bafy-rt-root-1'],
        }
        store.recordPull(pullInput)

        const commitInput = {
          spaceDID,
          copyIndex: 0,
          shardCid: 'bafy-rt-shard-1',
          root: 'bafy-rt-root-1',
          dataSetId: 99n,
          shardRoots: ['bafy-rt-root-1'],
        }
        store.recordCommit(commitInput)

        await store.close()
        untrack()

        // ── Reopen and capture serialized state + iterator output ────────────
        const reopened = await open()
        const reopenedSerialized = State.serializeState(reopened.getState())
        // Iterator output is the public contract surface — assert it survives
        // the round-trip alongside the state snapshot.
        const reopenedRows = [...reopened.iterateShards(spaceDID)]
        await reopened.close()
        untrack()

        // ── Build reference state via state.js helpers ────────────────────────
        const ref = State.createInitialState()
        State.checkpointInventoryPage(ref, pageInput)
        State.transitionToApproved(ref, perSpaceCost)
        State.transitionToFunded(ref)
        State.recordPull(ref, pullInput)
        State.recordCommit(ref, commitInput)

        expect(reopenedSerialized).toEqual(State.serializeState(ref))

        // 1 pull shard + 1 store shard survives reopen; pull row's pieceCID
        // matches the seed.
        expect(reopenedRows).toHaveLength(2)
        const reopenedPull = reopenedRows.find(
          (r) => r.shardCid === 'bafy-rt-shard-1'
        )
        expect(reopenedPull?.kind).toBe('pull')
        expect(reopenedPull?.pieceCID).toBe('bafkz-rt-piece-1')
      })

      it('iterateShards({ kind: "pull" }) returns pull rows with non-null pieceCID', async () => {
        const store = await open()

        store.checkpointInventoryPage({
          spaceDID,
          shards: [pullShard, pullShard2],
          shardsToStore: [storeShardNoPiece],
          uploads: ['bafy-rt-root-1', 'bafy-rt-root-2'],
          skippedUploads: [],
          totalBytes: 350n,
          totalSizeToMigrate: 350n,
          cursor: undefined,
        })

        const rows = [...store.iterateShards(spaceDID, { kind: 'pull' })]

        expect(rows).toHaveLength(2)
        for (const row of rows) {
          expect(row.kind).toBe('pull')
          if (row.kind !== 'pull') {
            throw new Error('expected pull row from kind filter')
          }
          expect(row.pieceCID.length).toBeGreaterThan(0)
        }

        await store.close()
        untrack()
      })

      it('iterateShards({ kind: "store" }) returns store rows including null pieceCID', async () => {
        const store = await open()

        store.checkpointInventoryPage({
          spaceDID,
          shards: [pullShard],
          shardsToStore: [storeShardWithPiece, storeShardNoPiece],
          uploads: ['bafy-rt-root-1'],
          skippedUploads: [],
          totalBytes: 450n,
          totalSizeToMigrate: 450n,
          cursor: undefined,
        })

        const rows = [...store.iterateShards(spaceDID, { kind: 'store' })]

        expect(rows).toHaveLength(2)
        for (const row of rows) {
          expect(row.kind).toBe('store')
        }

        const withPiece = rows.find((r) => r.shardCid === 'bafy-rt-shard-3')
        const withoutPiece = rows.find((r) => r.shardCid === 'bafy-rt-shard-4')

        expect(withPiece).toBeDefined()
        expect(withPiece?.kind).toBe('store')
        expect(typeof withPiece?.pieceCID).toBe('string')
        expect(withPiece?.pieceCID?.length).toBeGreaterThan(0)

        expect(withoutPiece).toBeDefined()
        expect(withoutPiece?.kind).toBe('store')
        expect(withoutPiece?.pieceCID).toBeNull()

        await store.close()
        untrack()
      })
    })
  })
}

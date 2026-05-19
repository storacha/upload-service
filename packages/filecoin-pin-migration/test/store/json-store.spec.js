import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Writer } from 'steno'
import { JsonFileStore } from '../../src/store/json-store.js'
import { runStoreContractTests } from './contract.js'
import * as State from '../../src/state.js'

/**
 * @import * as API from '../../src/api.js'
 */

runStoreContractTests('JsonFileStore', (path) => JsonFileStore.open({ path }))

describe('JsonFileStore lock file', () => {
  /** @type {string} */
  let dir
  /** @type {string} */
  let storePath
  /** @type {string} */
  let lockPath
  /** @type {JsonFileStore | undefined} */
  let activeStore

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'json-store-lock-'))
    storePath = join(dir, 'state.json')
    lockPath = `${storePath}.lock`
    activeStore = undefined
  })

  afterEach(async () => {
    const store = activeStore
    activeStore = undefined
    try {
      if (store) await store.close()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('lock file is created on open with current PID written into it', async () => {
    activeStore = await JsonFileStore.open({ path: storePath })
    expect(existsSync(lockPath)).toBe(true)
    const contents = await readFile(lockPath, 'utf8')
    expect(contents.trim()).toBe(String(process.pid))
  })

  it('second open while first is alive throws with a message naming the holder PID', async () => {
    activeStore = await JsonFileStore.open({ path: storePath })
    /** @type {unknown} */
    let thrown
    try {
      await JsonFileStore.open({ path: storePath })
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(Error)
    const error = /** @type {Error} */ (thrown)
    expect(error.message).toMatch(/already exists/i)
    expect(error.message).toContain(String(process.pid))
  })

  it('lock is removed on close', async () => {
    activeStore = await JsonFileStore.open({ path: storePath })
    await activeStore.close()
    activeStore = undefined
    expect(existsSync(lockPath)).toBe(false)
  })

  it('lock is removed on closeSync', async () => {
    activeStore = await JsonFileStore.open({ path: storePath })
    activeStore.closeSync()
    activeStore = undefined
    expect(existsSync(lockPath)).toBe(false)
  })
})

describe('JsonFileStore SIGINT-style sync flush', () => {
  /** @type {string} */
  let dir
  /** @type {string} */
  let storePath
  /** @type {JsonFileStore | undefined} */
  let activeStore

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'json-store-sigint-'))
    storePath = join(dir, 'state.json')
    activeStore = undefined
  })

  afterEach(async () => {
    const store = activeStore
    activeStore = undefined
    try {
      if (store) await store.close()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('1000 recordPull burst + closeSync survives reopen with all mutations present', async () => {
    const spaceDID = /** @type {API.SpaceDID} */ ('did:key:zSigintStress')
    const N = 1000
    const copy0ServiceProvider = /** @type {const} */ (
      '0x1111111111111111111111111111111111111111'
    )
    const copy1ServiceProvider = /** @type {const} */ (
      '0x2222222222222222222222222222222222222222'
    )

    // Build 1000 ResolvedShards
    /** @type {API.ResolvedShard[]} */
    const shards = Array.from({ length: N }, (_, i) => ({
      root: `bafy-stress-root-${i}`,
      cid: `bafy-stress-shard-${i}`,
      pieceCID: `bafkz-stress-piece-${i}`,
      sourceURL: `https://example.com/stress/${i}`,
      sizeBytes: 100n,
    }))

    const store = await JsonFileStore.open({ path: storePath })
    activeStore = store

    store.checkpointInventoryPage({
      spaceDID,
      shards,
      shardsToStore: [],
      uploads: shards.map((s) => s.root),
      skippedUploads: [],
      totalBytes: BigInt(N * 100),
      totalSizeToMigrate: BigInt(N * 100),
      cursor: undefined,
    })

    /** @type {API.PerSpaceCost[]} */
    const perSpaceCost = [
      {
        spaceDID,
        isResumed: false,
        bytesToMigrate: BigInt(N * 100),
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
            serviceProvider: copy0ServiceProvider,
            dataSetId: null,
            context: /** @type {API.StorageContext} */ ({}),
            withCDN: false,
            isResumed: false,
            bytesToMigrate: BigInt(N * 100),
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
            serviceProvider: copy1ServiceProvider,
            dataSetId: null,
            context: /** @type {API.StorageContext} */ ({}),
            withCDN: false,
            isResumed: false,
            bytesToMigrate: BigInt(N * 100),
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
    ]

    store.transitionToApproved(perSpaceCost)
    store.transitionToFunded()

    // Burst of 1000 recordPulls with NO checkpoint between them
    for (const shard of shards) {
      store.recordPull({
        spaceDID,
        copyIndex: 0,
        shardCid: shard.cid,
        shardRoots: [shard.root],
      })
    }

    // SIGINT-style: sync flush, no await
    store.closeSync()
    activeStore = undefined

    // Reopen and verify all 1000 pulls survived
    const reopened = await JsonFileStore.open({ path: storePath })
    activeStore = reopened
    const state = reopened.getState()
    const copy0 = state.spaces[spaceDID].copies[0]
    expect(copy0.pulled.size).toBe(N)
    expect(copy0.pulled.has('bafy-stress-shard-0')).toBe(true)
    expect(copy0.pulled.has(`bafy-stress-shard-${N - 1}`)).toBe(true)
  })

  it('closeSync supersedes an in-flight close() rejection without reopening the store', async () => {
    const originalWrite = Writer.prototype.write
    /** @type {(error: Error) => void} */
    let rejectWrite = () => {}

    Writer.prototype.write = function () {
      return new Promise((_, reject) => {
        rejectWrite = reject
      })
    }

    try {
      const store = await JsonFileStore.open({ path: storePath })
      activeStore = store

      const closePromise = store.close()
      store.closeSync()
      activeStore = undefined

      rejectWrite(new Error('simulated async close failure'))
      await expect(closePromise).rejects.toThrow(
        'simulated async close failure'
      )
      expect(() => store.getState()).toThrow(/MigrationStore has been closed/)
      expect(existsSync(`${storePath}.lock`)).toBe(false)

      const reopened = await JsonFileStore.open({ path: storePath })
      activeStore = reopened
      expect(reopened.getState().version).toBe(State.STATE_VERSION)
    } finally {
      Writer.prototype.write = originalWrite
    }
  })
})

describe('JsonFileStore backward compatibility', () => {
  /** @type {string} */
  let dir
  /** @type {string} */
  let storePath
  /** @type {JsonFileStore | undefined} */
  let activeStore

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'json-store-compat-'))
    storePath = join(dir, 'state.json')
    activeStore = undefined
  })

  afterEach(async () => {
    const store = activeStore
    activeStore = undefined
    try {
      if (store) await store.close()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('loads a pre-refactor state file and preserves its JSON shape on close', async () => {
    const fixtureURL = new URL(
      '../fixtures/store-pre-refactor-state.json',
      import.meta.url
    )
    const fixtureJSON = await readFile(fixtureURL, 'utf8')
    const fixtureState = JSON.parse(fixtureJSON)
    const spaceDID = /** @type {any} */ ('did:key:zCompatStoreFixture')

    await writeFile(storePath, fixtureJSON)

    const store = await JsonFileStore.open({ path: storePath })
    activeStore = store

    const state = store.getState()
    expect(state.phase).toBe('reading')
    expect(state.readerProgressCursors?.[spaceDID]).toBe('cursor-compat-1')
    expect(state.spaces[spaceDID].copies[0].providerId).toBe(101n)
    expect(state.spaces[spaceDID].copies[0].dataSetId).toBe(9001n)
    expect(
      state.spaces[spaceDID].copies[0].storedShards.bafycompatstoreshard
    ).toBe('bafkzcompatstoredpiece')

    const shardRows = [...store.iterateShards(spaceDID)]
    expect(shardRows).toEqual([
      {
        kind: 'pull',
        spaceDID,
        shardCid: 'bafycompatpullshard',
        root: 'bafycompatrootpull',
        sourceURL: 'https://source.example.test/pull.car',
        sizeBytes: 111n,
        pieceCID: 'bafkzcompatpullpiece',
      },
      {
        kind: 'store',
        spaceDID,
        shardCid: 'bafycompatstoreshard',
        root: 'bafycompatrootstore',
        sourceURL: 'https://source.example.test/store.car',
        sizeBytes: 222n,
        pieceCID: null,
      },
    ])

    const committableRows = [...store.iterateCommittableShards(spaceDID, 0)]
    expect(committableRows).toEqual([
      {
        kind: 'store',
        spaceDID,
        shardCid: 'bafycompatstoreshard',
        root: 'bafycompatrootstore',
        sourceURL: 'https://source.example.test/store.car',
        sizeBytes: 222n,
        pieceCID: 'bafkzcompatstoredpiece',
      },
    ])

    await store.close()
    activeStore = undefined

    const onDiskJSON = await readFile(storePath, 'utf8')
    expect(JSON.parse(onDiskJSON)).toEqual(fixtureState)

    const reopened = await JsonFileStore.open({ path: storePath })
    activeStore = reopened
    expect(State.serializeState(reopened.getState())).toEqual(fixtureState)
  })
})

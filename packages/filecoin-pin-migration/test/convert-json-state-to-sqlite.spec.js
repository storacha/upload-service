import { createRequire } from 'node:module'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { convertJsonStateFileToSqlite } from '../src/helper/index.js'
import {
  createInitialState,
  recordCommit,
  recordFailedUpload,
  recordPull,
  recordStoredShard,
  serializeState,
  transitionToApproved,
  transitionToFunded,
} from '../src/state.js'
import { serializeStoreState } from '../src/store/serialize-store-state.js'
import { SqliteStore } from '../src/store/sqlite-store.js'

const require = createRequire(import.meta.url)
const hasBetterSqlite3 = hasUsableOptionalDependency('better-sqlite3')
const maybeDescribe = hasBetterSqlite3 ? describe : describe.skip

/** @import * as API from '../src/api.js' */

const SPACE_DID = /** @type {API.SpaceDID} */ ('did:key:z6MkJsonToSqliteState')

maybeDescribe('convertJsonStateFileToSqlite', () => {
  it('converts a legacy JSON state-file into an equivalent SQLite store', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'json-to-sqlite-'))
    const jsonPath = join(dir, 'state.json')
    const sqlitePath = join(dir, 'state.db')
    const serialized = createSerializedStateFixture()

    await writeFile(jsonPath, JSON.stringify(serialized), 'utf8')

    const result = await convertJsonStateFileToSqlite({
      sourcePath: jsonPath,
      targetPath: sqlitePath,
    })

    const store = await SqliteStore.open({ path: sqlitePath })
    try {
      expect(result).toMatchObject({
        sourcePath: jsonPath,
        targetPath: sqlitePath,
        spaces: 1,
        uploads: 1,
        skippedUploads: 1,
        shards: 2,
        shardsToStore: 1,
        copies: 2,
        pulledProgress: 2,
        storedShards: 1,
        commits: 2,
        failedUploads: 1,
      })
      expect(serializeStoreState(store)).toEqual(serialized)
    } finally {
      await store.close()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('fails safely when the target file already exists unless overwrite=true', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'json-to-sqlite-overwrite-'))
    const jsonPath = join(dir, 'state.json')
    const sqlitePath = join(dir, 'state.db')
    const serialized = createSerializedStateFixture()

    await writeFile(jsonPath, JSON.stringify(serialized), 'utf8')
    await writeFile(sqlitePath, 'old-sqlite-placeholder', 'utf8')

    await expect(
      convertJsonStateFileToSqlite({
        sourcePath: jsonPath,
        targetPath: sqlitePath,
      })
    ).rejects.toThrow(/target already exists/)

    expect(await readFile(sqlitePath, 'utf8')).toBe('old-sqlite-placeholder')

    await convertJsonStateFileToSqlite({
      sourcePath: jsonPath,
      targetPath: sqlitePath,
      overwrite: true,
    })

    const store = await SqliteStore.open({ path: sqlitePath })
    try {
      expect(serializeStoreState(store)).toEqual(serialized)
    } finally {
      await store.close()
      await rm(dir, { recursive: true, force: true })
    }
  })
})

function createSerializedStateFixture() {
  const state = createInitialState()
  const inventory = {
    did: SPACE_DID,
    name: 'JSON Import Space',
    uploads: ['bafy-json-root-1'],
    shards: [
      {
        root: 'bafy-json-root-1',
        cid: 'bafy-json-shard-1',
        pieceCID: 'bafkz-json-piece-1',
        sourceURL: 'https://example.com/json/shard-1',
        sizeBytes: 100n,
      },
      {
        root: 'bafy-json-root-1',
        cid: 'bafy-json-shard-2',
        pieceCID: 'bafkz-json-piece-2',
        sourceURL: 'https://example.com/json/shard-2',
        sizeBytes: 200n,
      },
    ],
    shardsToStore: [
      {
        root: 'bafy-json-root-2',
        cid: 'bafy-json-shard-store-1',
        pieceCID: 'bafkz-json-piece-store-1',
        sourceURL: 'https://example.com/json/shard-store-1',
        sizeBytes: 300n,
      },
    ],
    skippedUploads: ['bafy-json-root-skipped'],
    totalBytes: 600n,
    totalSizeToMigrate: 600n,
  }

  state.spacesInventories[SPACE_DID] = inventory
  state.spaceMigrationInventories ??= {}
  state.spaceMigrationInventories[SPACE_DID] = {
    did: inventory.did,
    name: inventory.name,
    totalBytes: inventory.totalBytes,
    totalSizeToMigrate: inventory.totalSizeToMigrate,
    uploadsCount: inventory.uploads.length,
    shardsCount: inventory.shards.length,
    shardsToStoreCount: inventory.shardsToStore.length,
    skippedUploadsCount: inventory.skippedUploads.length,
  }
  state.readerProgressCursors = { [SPACE_DID]: 'cursor-1' }

  transitionToApproved(state, /** @type {[API.PerSpaceCost]} */ ([
    createPerSpaceCost({
      spaceDID: SPACE_DID,
      copies: [
        createCopyCost({
          copyIndex: 0,
          providerId: 1n,
          serviceProvider: '0x0000000000000000000000000000000000000001',
          dataSetId: 10n,
        }),
        createCopyCost({
          copyIndex: 1,
          providerId: 2n,
          serviceProvider: '0x0000000000000000000000000000000000000002',
          dataSetId: null,
        }),
      ],
    }),
  ]))
  transitionToFunded(state)
  recordPull(state, {
    spaceDID: SPACE_DID,
    copyIndex: 0,
    shardCid: 'bafy-json-shard-1',
    shardRoots: ['bafy-json-root-1'],
  })
  recordPull(state, {
    spaceDID: SPACE_DID,
    copyIndex: 0,
    shardCid: 'bafy-json-shard-store-1',
    shardRoots: ['bafy-json-root-2'],
  })
  recordStoredShard(
    state,
    SPACE_DID,
    'bafy-json-shard-store-1',
    'bafkz-json-piece-store-1'
  )
  recordCommit(state, {
    spaceDID: SPACE_DID,
    copyIndex: 0,
    shardCid: 'bafy-json-shard-1',
    root: 'bafy-json-root-1',
    dataSetId: 10n,
    shardRoots: ['bafy-json-root-1'],
  })
  recordCommit(state, {
    spaceDID: SPACE_DID,
    copyIndex: 0,
    shardCid: 'bafy-json-shard-store-1',
    root: 'bafy-json-root-2',
    dataSetId: 10n,
    shardRoots: ['bafy-json-root-2'],
  })
  recordFailedUpload(state, SPACE_DID, 1, 'bafy-json-root-skipped')

  return serializeState(state)
}

/**
 * @param {object} input
 * @param {API.SpaceDID} input.spaceDID
 * @param {[ReturnType<typeof createCopyCost>, ReturnType<typeof createCopyCost>]} input.copies
 */
function createPerSpaceCost({ spaceDID, copies }) {
  return /** @type {API.PerSpaceCost} */ ({
    spaceDID,
    copies,
    isResumed: false,
    bytesToMigrate: 600n,
    currentDataSetSize: 0n,
    lockupUSDFC: 0n,
    sybilFee: 0n,
    cdnFixedLockup: 0n,
    rateLockupDelta: 0n,
    ratePerEpoch: 0n,
    ratePerMonth: 0n,
  })
}

/**
 * @param {object} input
 * @param {number} input.copyIndex
 * @param {bigint} input.providerId
 * @param {`0x${string}`} input.serviceProvider
 * @param {bigint | null} input.dataSetId
 */
function createCopyCost({ copyIndex, providerId, serviceProvider, dataSetId }) {
  return {
    copyIndex,
    spaceDID: SPACE_DID,
    providerId,
    serviceProvider,
    dataSetId,
    context: /** @type {API.StorageContext} */ ({
      provider: { pdp: { serviceURL: `https://provider-${copyIndex}.example` } },
    }),
    withCDN: false,
    isResumed: false,
    bytesToMigrate: 600n,
    currentDataSetSize: 0n,
    lockupUSDFC: 0n,
    sybilFee: 0n,
    cdnFixedLockup: 0n,
    rateLockupDelta: 0n,
    ratePerEpoch: 0n,
    ratePerMonth: 0n,
  }
}

/**
 * @param {string} specifier
 */
function hasUsableOptionalDependency(specifier) {
  try {
    const Database = require(specifier)
    const db = new Database(':memory:')
    db.close()
    return true
  } catch {
    return false
  }
}

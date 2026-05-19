import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { JsonFileStore } from '../../src/store/json-store.js'
import { SqliteStore } from '../../src/store/sqlite-store.js'

const require = createRequire(import.meta.url)
const hasBetterSqlite3 = hasUsableOptionalDependency('better-sqlite3')
const maybeDescribe = hasBetterSqlite3 ? describe : describe.skip

maybeDescribe('SQLite upload filter parity', () => {
  it('reopen preserves the same uploadsCount/skippedUploadsCount as JSON when store-only roots create synthetic upload parents', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sqlite-upload-parity-'))
    const jsonPath = join(dir, 'state.json')
    const sqlitePath = join(dir, 'state.db')
    const spaceDID = /** @type {import('../../src/api.js').SpaceDID} */ (
      'did:key:zUploadParity'
    )

    const page = {
      spaceDID,
      shards: [
        {
          root: 'bafy-parity-root-pull',
          cid: 'bafy-parity-shard-pull',
          pieceCID: 'bafkz-parity-piece-pull',
          sourceURL: 'https://example.com/parity/pull',
          sizeBytes: 100n,
        },
      ],
      shardsToStore: [
        {
          root: 'bafy-parity-root-store',
          cid: 'bafy-parity-shard-store',
          sourceURL: 'https://example.com/parity/store',
          sizeBytes: 200n,
        },
      ],
      uploads: ['bafy-parity-root-pull'],
      skippedUploads: ['bafy-parity-root-skipped'],
      totalBytes: 300n,
      totalSizeToMigrate: 300n,
      cursor: undefined,
    }

    const json = await JsonFileStore.open({ path: jsonPath })
    const sqlite = await SqliteStore.open({ path: sqlitePath })

    try {
      json.checkpointInventoryPage(page)
      sqlite.checkpointInventoryPage(page)
      await json.close()
      await sqlite.close()

      const reopenedJson = await JsonFileStore.open({ path: jsonPath })
      const reopenedSqlite = await SqliteStore.open({ path: sqlitePath })

      try {
        expect(reopenedSqlite.getSpaceInventorySummary(spaceDID)).toEqual(
          reopenedJson.getSpaceInventorySummary(spaceDID)
        )
      } finally {
        await reopenedJson.close()
        await reopenedSqlite.close()
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

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

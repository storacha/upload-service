import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { MissingSqliteDependencyError } from '../../src/errors.js'
import { createStore } from '../../src/store/factory.js'
import { SqliteStore } from '../../src/store/sqlite-store.js'
import { runStoreContractTests } from './contract.js'

const require = createRequire(import.meta.url)
const hasBetterSqlite3 = hasUsableOptionalDependency('better-sqlite3')

if (hasBetterSqlite3) {
  runStoreContractTests('SqliteStore', (path) => SqliteStore.open({ path }), {
    compareSerializedInventoryState: false,
  })
}

describe('sqlite factory', () => {
  const maybeIt = hasBetterSqlite3 ? it.skip : it

  maybeIt(
    'throws MissingSqliteDependencyError when better-sqlite3 is absent',
    async () => {
      await expect(
        createStore({
          type: 'sqlite',
          path: '/tmp/filecoin-pin-migration-missing-sqlite.db',
        })
      ).rejects.toBeInstanceOf(MissingSqliteDependencyError)
    }
  )
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

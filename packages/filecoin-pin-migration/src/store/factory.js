/**
 * @import * as API from '../api.js'
 */

import { JsonFileStore } from './json-store.js'
import { MissingSqliteDependencyError } from '../errors.js'

/**
 * Open a {@link API.MigrationStore} at the given on-disk path using the
 * selected backend.
 *
 * @param {API.CreateStoreOptions} options
 * @returns {Promise<API.MigrationStore>}
 */
export function createStore({ type, path }) {
  switch (type) {
    case 'json':
      return JsonFileStore.open({ path })
    case 'sqlite':
      return openSqliteStore(path)
    default:
      throw new Error(`Unknown store type: ${type}`)
  }
}

/**
 * @param {string} path
 * @returns {Promise<API.MigrationStore>}
 */
async function openSqliteStore(path) {
  try {
    const { SqliteStore } = await import('./sqlite-store.js')
    return await SqliteStore.open({ path })
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

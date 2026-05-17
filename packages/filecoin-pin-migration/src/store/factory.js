/**
 * @import * as API from '../api.js'
 */

import { JsonFileStore } from './json-store.js'

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
      throw new Error('SQLite backend not yet implemented; use type: "json"')
    default:
      throw new Error(`Unknown store type: ${type}`)
  }
}

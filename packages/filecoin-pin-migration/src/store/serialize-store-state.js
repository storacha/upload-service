import { getInventorySummaryMap, serializeState } from '../state.js'
import { materializeSpaceInventory } from './materialize-space-inventory.js'

/**
 * Serialize a store-backed migration state into the legacy JSON wire format.
 *
 * Unlike `serializeState(state)`, this helper rebuilds any omitted full
 * inventory arrays through the store query surface first. This preserves the
 * existing state-file format while allowing summary-first runtime states.
 *
 * @param {import('../api.js').MigrationStore} store
 * @returns {ReturnType<typeof serializeState>}
 */
export function serializeStoreState(store) {
  const state = store.getState()
  /** @type {Record<import('../api.js').SpaceDID, import('../api.js').SpaceInventory>} */
  const spacesInventories = {}

  for (const did of /** @type {import('../api.js').SpaceDID[]} */ (
    Object.keys(getInventorySummaryMap(state))
  )) {
    const inventory = materializeSpaceInventory(store, did)
    if (!inventory) {
      throw new TypeError(
        `serializeStoreState: failed to materialize inventory for ${did}`
      )
    }
    spacesInventories[did] = inventory
  }

  return serializeState(state, { spacesInventories })
}

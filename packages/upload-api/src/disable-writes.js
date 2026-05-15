import * as SpaceBlob from '@storacha/capabilities/space/blob'
import * as SpaceIndex from '@storacha/capabilities/space/index'
import * as Upload from '@storacha/capabilities/upload'
import * as Store from '@storacha/capabilities/store'
import { ServiceUnavailable } from './errors.js'

// `store/add` is a legacy capability whose schema lives in
// `@web3-storage/capabilities` (not a direct dep here). It is stripped from the
// service tree by `lib.js` today; this list keeps the path defensively so a
// future re-exposure is automatically guarded. Only the `.can` string is read
// at runtime, so a literal stand-in suffices.
/** @type {{ can: string }} */
const StoreAddCan = { can: 'store/add' }

/**
 * Paths into the service tree (built by `./lib.js#createService`) for the
 * user-facing write capabilities that should be disabled when
 * `context.writesDisabled` is `true`.
 *
 * The list is enumerated here so a future change that adds a new write
 * capability has a single, code-reviewable site to update. `store/add` is kept
 * for defense-in-depth even though `lib.js` currently strips it via a
 * destructure-rest (the walker is missing-tolerant).
 *
 * @type {ReadonlyArray<{ path: string[], capability: { can: string } }>}
 */
export const WRITE_PATHS = [
  { path: ['space', 'blob', 'add'], capability: SpaceBlob.add },
  { path: ['space', 'blob', 'remove'], capability: SpaceBlob.remove },
  { path: ['space', 'blob', 'replicate'], capability: SpaceBlob.replicate },
  { path: ['space', 'index', 'add'], capability: SpaceIndex.add },
  { path: ['upload', 'add'], capability: Upload.add },
  { path: ['upload', 'remove'], capability: Upload.remove },
  { path: ['store', 'add'], capability: StoreAddCan },
  { path: ['store', 'remove'], capability: Store.remove },
]

/**
 * Builds a leaf handler that ucanto's server dispatcher will invoke in place
 * of the original provider. The returned function short-circuits before any
 * capability schema validation or fork/effect machinery, so the receipt
 * carries `out.error` with `name === 'ServiceUnavailable'` regardless of
 * whether the invocation's `nb` would otherwise validate.
 *
 * @param {{ can: string }} capability
 */
const disabledHandler = (capability) => async () => {
  console.warn(`write capability disabled: ${capability.can}`)
  return {
    error: new ServiceUnavailable(
      `The "${capability.can}" capability is currently disabled.`
    ),
  }
}

/**
 * Walks `service` at every path in `WRITE_PATHS` and replaces each present
 * leaf with a disabled handler. Mutates and returns the same object. Missing
 * paths are silently skipped.
 *
 * @template {Record<string, any>} S
 * @param {S} service
 * @returns {S}
 */
export const applyWritesDisabled = (service) => {
  for (const { path, capability } of WRITE_PATHS) {
    const leaf = path[path.length - 1]
    /** @type {any} */
    let node = service
    for (let i = 0; i < path.length - 1; i++) {
      const seg = path[i]
      if (node == null || typeof node !== 'object' || !(seg in node)) {
        node = null
        break
      }
      node = node[seg]
    }
    if (node && leaf in node) {
      node[leaf] = disabledHandler(capability)
    }
  }
  return service
}

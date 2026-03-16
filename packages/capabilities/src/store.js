/**
 * Store Capabilities
 *
 * These can be imported directly with:
 * ```js
 * import * as Store from '@storacha/capabilities/store'
 * ```
 *
 * @module
 */
import { capability, Link, Schema, ok, fail } from '@ucanto/validator'
import { equalLink, equalWith, SpaceDID } from './utils.js'

// @see https://github.com/multiformats/multicodec/blob/master/table.csv#L140
export const code = 0x0202

export const CARLink = Schema.link({ code, version: 1 })

/**
 * Capability can only be delegated (but not invoked) allowing audience to
 * derived any `store/` prefixed capability for the (memory) space identified
 * by DID in the `with` field.
 *
 * @deprecated
 */
export const store = capability({
  can: 'store/*',
  /**
   * DID of the (memory) space where CAR is intended to
   * be stored.
   */
  with: SpaceDID,
  derives: equalWith,
})

/**
 * Capability to get store metadata by shard CID.
 * Use to check for inclusion, or get shard size and origin
 *
 * `nb.link` is optional to allow delegation of `store/get`
 * capability for any shard CID. If link is specified, then the
 * capability only allows a get for that specific CID.
 *
 * When used as as an invocation, `nb.link` must be specified.
 *
 * @deprecated
 */
export const get = capability({
  can: 'store/get',
  with: SpaceDID,
  nb: Schema.struct({
    /**
     * shard CID to fetch info about.
     */
    link: CARLink.optional(),
  }),
  derives: equalLink,
})

/**
 * Capability can be used to remove the stored CAR file from the (memory)
 * space identified by `with` field.
 *
 * @deprecated
 */
export const remove = capability({
  can: 'store/remove',
  /**
   * DID of the (memory) space where CAR is intended to
   * be stored.
   */
  with: SpaceDID,
  nb: Schema.struct({
    /**
     * CID of the CAR file to be removed from the store.
     */
    link: CARLink,
  }),
  derives: equalLink,
})

/**
 * Capability can be invoked to request a list of stored CAR files in the
 * (memory) space identified by `with` field.
 *
 * @deprecated
 */
export const list = capability({
  can: 'store/list',
  /**
   * DID of the (memory) space where CAR is intended to
   * be stored.
   */
  with: SpaceDID,
  nb: Schema.struct({
    /**
     * A pointer that can be moved back and forth on the list.
     * It can be used to paginate a list for instance.
     */
    cursor: Schema.string().optional(),
    /**
     * Maximum number of items per page.
     */
    size: Schema.integer().optional(),
    /**
     * If true, return page of results preceding cursor. Defaults to false.
     */
    pre: Schema.boolean().optional(),
  }),
  derives: (claimed, delegated) => {
    if (claimed.with !== delegated.with) {
      return fail(
        `Expected 'with: "${delegated.with}"' instead got '${claimed.with}'`
      )
    }
    return ok({})
  },
})

/** @deprecated */
export const all = remove.or(list)

// ⚠️ We export imports here so they are not omitted in generated typedes
// @see https://github.com/microsoft/TypeScript/issues/51548
export { Schema, Link }

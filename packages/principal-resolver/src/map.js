import { DIDResolutionError } from '@ucanto/validator'

/**
 * @import { PrincipalResolver } from './types.js'
 * @import { DID } from '@ucanto/interface'
 */

/**
 * Creates a new resolver that resolves any DID to a DID key via the provided
 * mapping object.
 *
 * @param {Record<DID, DID<'key'>>} principalMapping
 * @returns {PrincipalResolver}
 */
export const create = (principalMapping) => ({
  resolveDIDKey: (did) =>
    principalMapping[did]
      ? { ok: [principalMapping[did]] }
      : { error: new DIDResolutionError(did) },
})

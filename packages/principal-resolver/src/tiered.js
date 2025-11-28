import { DIDResolutionError } from '@ucanto/validator'

/** @import { PrincipalResolver } from './types.js' */

/**
 * Creates a new resolver that tries each of the provided resolvers in order
 * until one successfully resolves the DID to a DID key.
 *
 * @param {Iterable<PrincipalResolver>} resolvers
 * @returns {PrincipalResolver}
 */
export const create = (resolvers) => ({
  resolveDIDKey: async (did) => {
    let result
    for (const resolver of resolvers) {
      result = await resolver.resolveDIDKey(did)
      if (result.ok) return result
    }
    return result ?? { error: new DIDResolutionError(did) }
  }
})

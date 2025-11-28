/**
 * @import { PrincipalResolver } from './types.js'
 * @import { DID } from '@ucanto/interface'
 */

const defaultTTL = 60 * 60 * 1000 // 1 hour

/**
 * Creates a new resolver that caches the result from the passed resolver for
 * the configured time-to-live (TTL). Note: entries are not purged from the
 * cache after they expire.
 *
 * @param {Required<PrincipalResolver>} resolver
 * @param {{ ttl?: number }} [options]
 * @returns {Required<PrincipalResolver>}
 */
export const create = (resolver, options) => {
  const ttl = options?.ttl ?? defaultTTL
  /** @type {Map<DID, { keys: Array<DID<'key'>>, expiresAt: number }>} */
  const cache = new Map()
  return {
    async resolveDIDKey(did) {
      const entry = cache.get(did)
      if (entry && entry.expiresAt > Date.now()) {
        return { ok: entry.keys }
      }
      const result = await resolver.resolveDIDKey(did)
      if (result.ok) {
        cache.set(did, { keys: result.ok, expiresAt: Date.now() + ttl })
      }
      return result
    },
  }
}

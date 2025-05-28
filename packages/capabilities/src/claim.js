import { capability, URI, Schema, ok, fail } from '@ucanto/validator'
import * as Bytes from 'multiformats/bytes'
import { and, equal, equalWith } from './utils.js'

/** @import * as API from '@ucanto/interface' */

const multiaddr = Schema.bytes()

export const claim = capability({
  can: 'claim/*',
  with: URI.match({ protocol: 'did:' }),
})

/**
 * Cache the provided content claim.
 */
export const cache = capability({
  can: 'claim/cache',
  with: URI.match({ protocol: 'did:' }),
  nb: Schema.struct({
    claim: Schema.link({ version: 1 }),
    provider: Schema.struct({
      addresses: Schema.array(multiaddr),
    }),
  }),
  derives: (claimed, delegated) =>
    and(equalWith(claimed, delegated)) ||
    and(equal(claimed.nb.claim, delegated.nb.claim, 'claim')) ||
    and(equalProviderAddresses(claimed, delegated)) ||
    ok({}),
})

/**
 * @template {API.ParsedCapability<API.Ability, API.URI, { provider: { addresses: Uint8Array[] } }>} T
 * @param {T} claimed
 * @param {T} delegated
 * @returns {API.Result<{}, API.Failure>}
 */
const equalProviderAddresses = (claimed, delegated) => {
  if (delegated.nb?.provider?.addresses) {
    const delegatedAddrs = delegated.nb.provider.addresses
    const claimedAddrs = claimed.nb?.provider?.addresses ?? []
    if (claimedAddrs.length !== delegatedAddrs.length) {
      return fail(
        `Constraint violation: ${claimedAddrs.length} provider addresses violates imposed constraint ${delegatedAddrs.length} provider addresses`
      )
    }
    for (let i = 0; i < delegatedAddrs.length; i++) {
      const addr = delegatedAddrs[i]
      const found = claimedAddrs.some((a) => Bytes.equals(addr, a))
      if (!found) {
        return fail(
          `Constraint violation: provider address ${i} is not an allowed provider address`
        )
      }
    }
  }
  return ok({})
}

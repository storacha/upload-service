import assert from 'assert'
import { DIDResolutionError } from '@ucanto/validator'
import * as TieredResolver from '../src/tiered.js'

/** @import { PrincipalResolver } from '../src/types.js' */

describe('tiered', () => {
  it('should resolve from tiered resolvers', async () => {
    /** @type {PrincipalResolver} */
    const mockResolverTier0 = {
      resolveDIDKey: async (did) =>
        did === 'did:web:alice.example.com'
          ? { ok: ['did:key:alice'] }
          : { error: new DIDResolutionError(did) },
    }

    /** @type {PrincipalResolver} */
    const mockResolverTier1 = {
      resolveDIDKey: async (did) =>
        did === 'did:web:bob.example.com'
          ? { ok: ['did:key:bob'] }
          : { error: new DIDResolutionError(did) },
    }

    const resolver = TieredResolver.create([
      mockResolverTier0,
      mockResolverTier1,
    ])

    // resolve from tier 0
    let result = await resolver.resolveDIDKey('did:web:alice.example.com')
    assert.deepStrictEqual(result, { ok: ['did:key:alice'] })

    // resolve from tier 1
    result = await resolver.resolveDIDKey('did:web:bob.example.com')
    assert.deepStrictEqual(result, { ok: ['did:key:bob'] })

    // not found
    result = await resolver.resolveDIDKey('did:web:carol.example.com')
    assert(result.error)
    assert.equal(result.error.name, 'DIDKeyResolutionError')
  })

  it('should return error when no resolvers are provided', async () => {
    const resolver = TieredResolver.create([])
    const result = await resolver.resolveDIDKey('did:web:alice.example.com')
    assert(result.error)
    assert.equal(result.error.name, 'DIDKeyResolutionError')
  })
})

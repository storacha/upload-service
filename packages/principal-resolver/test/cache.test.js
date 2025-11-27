import assert from 'assert'
import { DIDResolutionError } from '@ucanto/validator'
import * as CacheResolver from '../src/cache.js'

/** @import { PrincipalResolver } from '../src/types.js' */

describe('cache', () => {
  it('should cache resolved principals', async () => {
    let resolveCount = 0
    /** @type {PrincipalResolver} */
    const mockResolver = {
      resolveDIDKey: async (did) => {
        resolveCount++
        return did === 'did:web:alice.example.com'
          ? { ok: ['did:key:alice'] }
          : { error: new DIDResolutionError(did) }
      }
    }
    const resolver = CacheResolver.create(mockResolver, { ttl: 1000 })

    // First resolution should call the underlying resolver
    let result = await resolver.resolveDIDKey('did:web:alice.example.com')
    assert.deepStrictEqual(result, { ok: ['did:key:alice'] })
    assert.strictEqual(resolveCount, 1)

    // Second resolution within TTL should use cache
    result = await resolver.resolveDIDKey('did:web:alice.example.com')
    assert.deepStrictEqual(result, { ok: ['did:key:alice'] })
    assert.strictEqual(resolveCount, 1)

    // Wait for TTL to expire
    await new Promise((r) => setTimeout(r, 1100))

    // Third resolution after TTL should call the underlying resolver again
    result = await resolver.resolveDIDKey('did:web:alice.example.com')
    assert.deepStrictEqual(result, { ok: ['did:key:alice'] })
    assert.strictEqual(resolveCount, 2)
  })

  it('should not cache errors', async () => {
    let resolveCount = 0
    /** @type {PrincipalResolver} */
    const mockResolver = {
      resolveDIDKey: async (did) => {
        resolveCount++
        return { error: new DIDResolutionError(did) }
      }
    }
    const resolver = CacheResolver.create(mockResolver, { ttl: 1000 })

    // First resolution should call the underlying resolver
    let result = await resolver.resolveDIDKey('did:web:bob.example.com')
    assert(result.error)
    assert.strictEqual(resolveCount, 1)

    // Second resolution should call the underlying resolver again
    result = await resolver.resolveDIDKey('did:web:bob.example.com')
    assert(result.error)
    assert.strictEqual(resolveCount, 2)
  })
})
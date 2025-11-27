import assert from 'assert'
import * as MapResolver from '../src/map.js'

describe('map', () => {
  it('should resolve mapped principals', async () => {
    const resolver = MapResolver.create({
      'did:web:alice.example.com': 'did:key:alice'
    })
    const result = resolver.resolveDIDKey('did:web:alice.example.com')
    assert.deepStrictEqual(result, { ok: ['did:key:alice'] })
  })

  it('should return error for unmapped principals', async () => {
    const resolver = MapResolver.create({
      'did:web:alice.example.com': 'did:key:alice'
    })
    const result = await resolver.resolveDIDKey('did:web:bob.example.com')
    assert(result.error)
    assert.equal(result.error.name, 'DIDKeyResolutionError')
  })
})
import assert from 'assert'
import * as HTTPResolver from '../src/http.js'

describe('http', () => {
  /** @type {typeof globalThis.fetch} */
  const mockFetch = async (url) => {
    assert.strictEqual(
      url.toString(),
      'https://alice.example.com/.well-known/did.json'
    )
    return new Response(JSON.stringify({
      '@context': 'https://www.w3.org/ns/did/v1',
      id: 'did:web:alice.example.com',
      verificationMethod: [{
        id: 'did:web:alice.example.com#key-1',
        type: 'Ed25519VerificationKey2020',
        controller: 'did:web:alice.example.com',
        publicKeyMultibase: 'z6MkvUM1Par5bDJtWHHa9dMx6eniRXo8eQdn7kL788xt9ipi'
      }]
    }))
  }

  it('should resolve allowed DID', async () => {
    const resolver = HTTPResolver.create(
      ['did:web:alice.example.com'],
      { fetch: mockFetch }
    )
    const result = await resolver.resolveDIDKey('did:web:alice.example.com')
    assert.deepStrictEqual(result, { ok: ['did:key:z6MkvUM1Par5bDJtWHHa9dMx6eniRXo8eQdn7kL788xt9ipi'] })
  })

  it('should resolve allowed RegExp DID', async () => {
    const resolver = HTTPResolver.create(
      [/did:web:[a-z]*\.example\.com/],
      { fetch: mockFetch }
    )
    const result = await resolver.resolveDIDKey('did:web:alice.example.com')
    assert.deepStrictEqual(result, { ok: ['did:key:z6MkvUM1Par5bDJtWHHa9dMx6eniRXo8eQdn7kL788xt9ipi'] })
  })

  it('should return error if not allowed', async () => {
    const resolver = HTTPResolver.create(
      ['did:web:alice.example.com'],
      { fetch: mockFetch }
    )
    const result = await resolver.resolveDIDKey('did:web:bob.example.com')
    assert(result.error)
    assert.equal(result.error.name, 'DIDKeyResolutionError')
  })

  it('should return error for bad status', async () => {
    const resolver = HTTPResolver.create(
      ['did:web:alice.example.com'],
      { fetch: async () => new Response(null, { status: 404 }) }
    )
    const result = await resolver.resolveDIDKey('did:web:alice.example.com')
    assert(result.error)
    assert.equal(result.error.name, 'DIDKeyResolutionError')
  })

  it('should return error for fetch failure', async () => {
    const resolver = HTTPResolver.create(
      ['did:web:alice.example.com'],
      { fetch: async () => { throw new Error('Fetch failed') } }
    )
    const result = await resolver.resolveDIDKey('did:web:alice.example.com')
    assert(result.error)
    assert.equal(result.error.name, 'DIDKeyResolutionError')
  })

  it('should return error for invalid DID document', async () => {
    const invalidDocuments = [
      null,
      42,
      { id: 'did:web:alice.example.com' }, // missing verificationMethod
      { id: 'did:web:alice.example.com', verificationMethod: 'not-an-array' }, // invalid verificationMethod
      { verificationMethod: [] }, // empty verificationMethod
      { verificationMethod: [null] }, // null verificationMethod
      { verificationMethod: [{ id: 'vm1' }] }, // missing publicKeyMultibase
      { verificationMethod: [{ publicKeyMultibase: 'invalid-key' }] } // invalid publicKeyMultibase
    ]

    for (const doc of invalidDocuments) {
      const resolver = HTTPResolver.create(
        ['did:web:alice.example.com'],
        { fetch: async () => new Response(JSON.stringify(doc)) }
      )
      const result = await resolver.resolveDIDKey('did:web:alice.example.com')
      assert(result.error, `Expected error for document: ${JSON.stringify(doc)}`)
      assert.equal(result.error.name, 'DIDKeyResolutionError')
    }
  })
})
import { describe, it, expect } from 'vitest'
import { RoundaboutResolver, ClaimsResolver, createResolver } from '../src/source-url.js'

/** @type {import('../src/api.js').ResolvedShard} */
const shard = {
  root: 'bafyroot1',
  cid: 'bafyshard1',
  pieceCID: 'bafkzcibPIECE123',
  sourceURL: 'https://r2.example/shard1',
  sizeBytes: 1024n,
}

describe('RoundaboutResolver', () => {
  it('builds URL from shard pieceCID', () => {
    const resolver = new RoundaboutResolver()
    expect(resolver.resolve(shard)).toBe(
      'https://roundabout.web3.storage/piece/bafkzcibPIECE123'
    )
  })

  it('uses custom baseURL when provided', () => {
    const resolver = new RoundaboutResolver('https://custom.roundabout.io/')
    expect(resolver.resolve(shard)).toBe(
      'https://custom.roundabout.io/piece/bafkzcibPIECE123'
    )
  })
})

describe('ClaimsResolver', () => {
  it('returns shard.sourceURL unchanged', () => {
    const resolver = new ClaimsResolver()
    expect(resolver.resolve(shard)).toBe('https://r2.example/shard1')
  })
})

describe('createResolver', () => {
  it('returns RoundaboutResolver for strategy roundabout', () => {
    const resolver = createResolver({ strategy: 'roundabout' })
    expect(resolver).toBeInstanceOf(RoundaboutResolver)
  })

  it('returns ClaimsResolver for strategy claims', () => {
    const resolver = createResolver({ strategy: 'claims' })
    expect(resolver).toBeInstanceOf(ClaimsResolver)
  })

  it('passes roundaboutURL override to RoundaboutResolver', () => {
    const resolver = createResolver({
      strategy: 'roundabout',
      roundaboutURL: 'https://my-roundabout.io',
    })
    expect(resolver.resolve(shard)).toBe(
      'https://my-roundabout.io/piece/bafkzcibPIECE123'
    )
  })
})

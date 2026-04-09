import { describe, it, expect } from 'vitest'
import { RoundaboutResolver, ClaimsResolver, createResolver } from '../src/source-url.js'

/** @type {import('../src/api.js').ResolvedShard} */
const shard = {
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
  /**
   * @param {'roundabout' | 'claims'} strategy
   * @param {string} [roundaboutURL]
   */
  const configFor = (strategy, roundaboutURL) =>
    /** @type {import('../src/api.js').MigrationConfig} */ ({
      storacha: { client: {} },
      foc: { synapse: {} },
      sourceURL: { strategy, roundaboutURL },
    })

  it('returns RoundaboutResolver for strategy roundabout', () => {
    const resolver = createResolver(configFor('roundabout'))
    expect(resolver).toBeInstanceOf(RoundaboutResolver)
  })

  it('returns ClaimsResolver for strategy claims', () => {
    const resolver = createResolver(configFor('claims'))
    expect(resolver).toBeInstanceOf(ClaimsResolver)
  })

  it('passes roundaboutURL override to RoundaboutResolver', () => {
    const resolver = createResolver(
      configFor('roundabout', 'https://my-roundabout.io')
    )
    expect(resolver.resolve(shard)).toBe(
      'https://my-roundabout.io/piece/bafkzcibPIECE123'
    )
  })
})

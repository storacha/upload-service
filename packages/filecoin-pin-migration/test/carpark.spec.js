import { describe, expect, it } from 'vitest'
import { base58btc } from 'multiformats/bases/base58'

import { findCarparkLocation } from '../src/reader/carpark.js'
import { createTestCID, createMockFallbackFetch } from './helpers.js'

/**
 * @import * as API from '../src/api.js'
 */

/**
 * @param {API.UnknownLink} shardCid
 * @returns {API.ShardEntry}
 */
function createShardEntry(shardCid) {
  return {
    cidStr: shardCid.toString(),
    multihash: shardCid.multihash,
    b58: base58btc.encode(shardCid.multihash.bytes),
  }
}

describe('findCarparkLocation', () => {
  it('finds the cid/cid.car object on the first host', async () => {
    const shardCid = await createTestCID('carpark-cid-path')
    const shard = createShardEntry(shardCid)
    const url = `https://carpark-prod-0.r2.w3s.link/${shard.cidStr}/${shard.cidStr}.car`
    const fetcher = createMockFallbackFetch({
      headResponses: new Map([[url, { contentLength: 1024 }]]),
    })

    const match = await findCarparkLocation(shard, fetcher)

    expect(match).toEqual({
      locationURL: url,
      size: 1024n,
    })
  })

  it('falls back to the multihash blob path on the same host', async () => {
    const shardCid = await createTestCID('carpark-blob-path')
    const shard = createShardEntry(shardCid)
    const url = `https://carpark-prod-0.r2.w3s.link/${shard.b58}/${shard.b58}.blob`
    const fetcher = createMockFallbackFetch({
      headResponses: new Map([[url, { contentLength: '2048' }]]),
    })

    const match = await findCarparkLocation(shard, fetcher)

    expect(match).toEqual({
      locationURL: url,
      size: 2048n,
    })
  })

  it('tries the second host when the first host misses', async () => {
    const shardCid = await createTestCID('carpark-second-host')
    const shard = createShardEntry(shardCid)
    const url = `https://carpark-prod-1.r2.w3s.link/${shard.cidStr}/${shard.cidStr}.car`
    const fetcher = createMockFallbackFetch({
      headResponses: new Map([[url, { contentLength: 4096 }]]),
    })

    const match = await findCarparkLocation(shard, fetcher)

    expect(match).toEqual({
      locationURL: url,
      size: 4096n,
    })
  })

  it('returns 0n when the object exists but Content-Length is missing', async () => {
    const shardCid = await createTestCID('carpark-no-content-length')
    const shard = createShardEntry(shardCid)
    const url = `https://carpark-prod-0.r2.w3s.link/${shard.cidStr}/${shard.cidStr}.car`
    const fetcher = createMockFallbackFetch({
      headResponses: new Map([[url, {}]]),
    })

    const match = await findCarparkLocation(shard, fetcher)

    expect(match).toEqual({
      locationURL: url,
      size: 0n,
    })
  })

  it('returns 0n when Content-Length is malformed', async () => {
    const shardCid = await createTestCID('carpark-bad-content-length')
    const shard = createShardEntry(shardCid)
    const url = `https://carpark-prod-0.r2.w3s.link/${shard.cidStr}/${shard.cidStr}.car`
    const fetcher = createMockFallbackFetch({
      headResponses: new Map([[url, { contentLength: 'not-a-number' }]]),
    })

    const match = await findCarparkLocation(shard, fetcher)

    expect(match).toEqual({
      locationURL: url,
      size: 0n,
    })
  })

  it('returns null when every candidate misses', async () => {
    const shardCid = await createTestCID('carpark-miss')
    const shard = createShardEntry(shardCid)
    const fetcher = createMockFallbackFetch()

    const match = await findCarparkLocation(shard, fetcher)

    expect(match).toBeNull()
  })
})

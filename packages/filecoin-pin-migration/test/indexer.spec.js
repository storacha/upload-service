import { describe, expect, it } from 'vitest'
import { base58btc } from 'multiformats/bases/base58'

import { resolveClaimsIndex } from '../src/reader/indexer.js'
import {
  createPieceCID,
  createTestCID,
  createMockFetch,
  createMockIndexer,
  buildCIDContactProviderAddr,
  buildEqualsClaimMetadata,
  buildExpectedCIDContactURL,
  buildIPNIFindResponse,
  buildLocationCommitmentMetadata,
} from './helpers.js'

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

describe('resolveClaimsIndex', () => {
  it('prefers full multihash bytes over digest-only content.digest when merging primary claims', async () => {
    const shardCid = await createTestCID('shard-primary-keying')
    const pieceCid = createPieceCID()
    const shard = createShardEntry(shardCid)

    const claims = new Map([
      [
        'location-claim',
        {
          type: /** @type {const} */ ('assert/location'),
          content: {
            digest: shardCid.multihash.digest,
            multihash: shardCid.multihash,
          },
          location: [new URL('https://r2.example/shard-primary-keying')],
        },
      ],
      [
        'equals-claim',
        {
          type: /** @type {const} */ ('assert/equals'),
          content: {
            digest: shardCid.multihash.digest,
            multihash: shardCid.multihash,
          },
          equals: pieceCid,
        },
      ],
    ])
    const indexer = createMockIndexer(new Map([[shard.b58, { claims }]]))

    const index = await resolveClaimsIndex({
      indexer,
      shards: [shard],
      fetcher: undefined,
    })

    const entry = index.get(shard.b58)
    expect(entry).toBeDefined()
    expect(entry?.locationURL).toBe('https://r2.example/shard-primary-keying')
    expect(entry?.piece?.link.toString()).toBe(pieceCid.toString())
  })

  it('repairs missing location URL from cid.contact', async () => {
    const shardCid = await createTestCID('shard-ipni-location')
    const pieceCid = createPieceCID()
    const shard = createShardEntry(shardCid)
    const locationHost = 'carpark.example'

    const indexer = createMockIndexer(
      new Map([
        [
          shard.b58,
          {
            claims: new Map([
              [
                'equals-claim',
                {
                  type: /** @type {const} */ ('assert/equals'),
                  content: { multihash: shardCid.multihash },
                  equals: pieceCid,
                },
              ],
            ]),
          },
        ],
      ])
    )
    const fetcher = createMockFetch(
      new Map([
        [
          shard.b58,
          buildIPNIFindResponse([
            {
              Metadata: buildLocationCommitmentMetadata({ size: 2048n }),
              Provider: {
                Addrs: [buildCIDContactProviderAddr(locationHost)],
              },
            },
          ]),
        ],
      ])
    )

    const index = await resolveClaimsIndex({
      indexer,
      shards: [shard],
      fetcher,
    })

    const entry = index.get(shard.b58)
    expect(entry).toBeDefined()
    expect(entry?.locationURL).toBe(
      buildExpectedCIDContactURL(shardCid, locationHost)
    )
    expect(entry?.piece?.link.toString()).toBe(pieceCid.toString())
    expect(entry?.size).toBe(2048n)
  })

  it('repairs missing pieceCID from cid.contact', async () => {
    const shardCid = await createTestCID('shard-ipni-piece')
    const pieceCid = createPieceCID()
    const shard = createShardEntry(shardCid)

    const indexer = createMockIndexer(
      new Map([
        [
          shard.b58,
          {
            claims: new Map([
              [
                'location-claim',
                {
                  type: /** @type {const} */ ('assert/location'),
                  content: { multihash: shardCid.multihash },
                  location: [new URL('https://r2.example/shard-ipni-piece')],
                },
              ],
            ]),
          },
        ],
      ])
    )
    const fetcher = createMockFetch(
      new Map([
        [
          shard.b58,
          buildIPNIFindResponse([
            {
              Metadata: buildEqualsClaimMetadata(pieceCid),
              Provider: { Addrs: [] },
            },
          ]),
        ],
      ])
    )

    const index = await resolveClaimsIndex({
      indexer,
      shards: [shard],
      fetcher,
    })

    const entry = index.get(shard.b58)
    expect(entry).toBeDefined()
    expect(entry?.locationURL).toBe('https://r2.example/shard-ipni-piece')
    expect(entry?.piece?.link.toString()).toBe(pieceCid.toString())
  })

  it('falls back to cid.contact when the primary claim query fails entirely', async () => {
    const shardCid = await createTestCID('shard-ipni-total-failure')
    const pieceCid = createPieceCID()
    const shard = createShardEntry(shardCid)
    const locationHost = 'fallback.example'

    const indexer = /** @type {API.IndexingServiceReader} */ ({
      async queryClaims() {
        throw new Error('indexer unavailable')
      },
    })
    const fetcher = createMockFetch(
      new Map([
        [
          shard.b58,
          buildIPNIFindResponse([
            {
              Metadata: buildLocationCommitmentMetadata({ size: 4096n }),
              Provider: {
                Addrs: [buildCIDContactProviderAddr(locationHost)],
              },
            },
            {
              Metadata: buildEqualsClaimMetadata(pieceCid),
              Provider: { Addrs: [] },
            },
          ]),
        ],
      ])
    )

    const index = await resolveClaimsIndex({
      indexer,
      shards: [shard],
      fetcher,
    })

    const entry = index.get(shard.b58)
    expect(entry).toBeDefined()
    expect(entry?.locationURL).toBe(
      buildExpectedCIDContactURL(shardCid, locationHost)
    )
    expect(entry?.piece?.link.toString()).toBe(pieceCid.toString())
    expect(entry?.size).toBe(4096n)
  })

  it('expands {blob} using multibase-prefixed base32upper in cid.contact paths', async () => {
    const shardCid = await createTestCID('shard-ipni-blob-template')
    const pieceCid = createPieceCID()
    const shard = createShardEntry(shardCid)
    const locationHost = 'carpark-template.example'

    const indexer = /** @type {API.IndexingServiceReader} */ ({
      async queryClaims() {
        throw new Error('indexer unavailable')
      },
    })
    const fetcher = createMockFetch(
      new Map([
        [
          shard.b58,
          buildIPNIFindResponse([
            {
              Metadata: buildLocationCommitmentMetadata({ size: 1024n }),
              Provider: {
                Addrs: [buildCIDContactProviderAddr(locationHost)],
              },
            },
            {
              Metadata: buildEqualsClaimMetadata(pieceCid),
              Provider: { Addrs: [] },
            },
          ]),
        ],
      ])
    )

    const index = await resolveClaimsIndex({
      indexer,
      shards: [shard],
      fetcher,
    })

    const entry = index.get(shard.b58)
    expect(entry).toBeDefined()
    expect(entry?.locationURL).toBe(
      buildExpectedCIDContactURL(shardCid, locationHost)
    )
    expect(entry?.locationURL).toContain('/B')
  })
})

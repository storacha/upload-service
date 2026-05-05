const CARPARK_HOSTS = [
  'carpark-prod-0.r2.w3s.link',
  'carpark-prod-1.r2.w3s.link',
]

/**
 * @import { ShardEntry } from '../api.js'
 */

/**
 * Best-effort Storacha-specific location fallback for shards that are still
 * missing a usable source URL after claims and cid.contact repair.
 *
 * It probes the known public carpark buckets with HEAD and returns the first
 * matching object URL plus its Content-Length when available.
 *
 * @param {ShardEntry} shard
 * @param {typeof fetch} fetcher
 * @returns {Promise<{ locationURL: string, size: bigint } | null>}
 */
export async function findCarparkLocation(shard, fetcher) {
  for (const url of createCarparkCandidateURLs(shard)) {
    const response = await headObject(fetcher, url)
    if (!response?.ok) continue

    return {
      locationURL: url,
      size: parseContentLength(response),
    }
  }

  return null
}

/**
 * @param {ShardEntry} shard
 * @returns {string[]}
 */
function createCarparkCandidateURLs(shard) {
  /** @type {string[]} */
  const urls = []

  for (const host of CARPARK_HOSTS) {
    urls.push(`https://${host}/${shard.cidStr}/${shard.cidStr}.car`)
    urls.push(`https://${host}/${shard.b58}/${shard.b58}.blob`)
  }

  return urls
}

/**
 * @param {typeof fetch} fetcher
 * @param {string} url
 * @returns {Promise<Response | null>}
 */
async function headObject(fetcher, url) {
  try {
    return await fetcher(url, { method: 'HEAD' })
  } catch {
    return null
  }
}

/**
 * @param {Response} response
 * @returns {bigint}
 */
function parseContentLength(response) {
  const value = response.headers.get('content-length')
  if (!value) return 0n

  try {
    return BigInt(value)
  } catch {
    return 0n
  }
}

import { isAbortError } from '../errors.js'

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
 * This races all candidate URLs for a shard in parallel. That improves tail
 * latency for a frequently used fallback path, at the cost of issuing more
 * HEAD requests.
 *
 * @param {ShardEntry} shard
 * @param {typeof fetch} fetcher
 * @param {AbortSignal | undefined} [signal]
 * @returns {Promise<{ locationURL: string, size: bigint } | null>}
 */
export async function findCarparkLocation(shard, fetcher, signal) {
  const probes = createCarparkCandidateURLs(shard).map((url) =>
    createCarparkProbe(fetcher, url, signal)
  )

  try {
    return await new Promise((resolve, reject) => {
      let settled = false
      let pending = probes.length

      for (const probe of probes) {
        probe.promise
          .then((response) => {
            if (settled) return

            if (response?.ok) {
              settled = true
              abortSiblingProbes(probes, probe)
              resolve({
                locationURL: probe.url,
                size: parseContentLength(response),
              })
              return
            }

            pending -= 1
            if (pending === 0) {
              settled = true
              resolve(null)
            }
          })
          .catch((error) => {
            if (settled) return
            if (isAbortError(error, signal)) {
              settled = true
              abortSiblingProbes(probes, probe)
              reject(error)
              return
            }

            pending -= 1
            if (pending === 0) {
              settled = true
              resolve(null)
            }
          })
      }
    })
  } finally {
    releaseProbeListeners(probes)
  }
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
 * @param {AbortSignal | undefined} [signal]
 * @param {AbortSignal | undefined} [parentSignal]
 * @returns {Promise<Response | null>}
 */
async function headObject(fetcher, url, signal, parentSignal) {
  try {
    return await fetcher(url, { method: 'HEAD', signal })
  } catch (error) {
    // The per-probe signal may abort because a sibling already won the race.
    // Only propagate abort when the whole outer operation was cancelled.
    if (parentSignal?.aborted) throw error
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

/**
 * @param {typeof fetch} fetcher
 * @param {string} url
 * @param {AbortSignal | undefined} [parentSignal]
 */
function createCarparkProbe(fetcher, url, parentSignal) {
  const controller = new AbortController()
  const release = linkAbortSignal(parentSignal, controller)

  return {
    url,
    controller,
    release,
    promise: headObject(fetcher, url, controller.signal, parentSignal),
  }
}

/**
 * @param {Array<{ controller: AbortController }>} probes
 * @param {{ controller: AbortController }} winner
 */
function abortSiblingProbes(probes, winner) {
  for (const probe of probes) {
    if (probe === winner) continue
    probe.controller.abort()
  }
}

/**
 * @param {Array<{ release: () => void }>} probes
 */
function releaseProbeListeners(probes) {
  for (const probe of probes) {
    probe.release()
  }
}

/**
 * @param {AbortSignal | undefined} signal
 * @param {AbortController} controller
 * @returns {() => void}
 */
function linkAbortSignal(signal, controller) {
  if (!signal) return () => {}
  if (signal.aborted) {
    controller.abort()
    return () => {}
  }

  const abort = () => controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  return () => signal.removeEventListener('abort', abort)
}

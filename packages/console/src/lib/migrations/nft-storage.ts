import { NFTStorage } from 'nft.storage'
import * as Link from 'multiformats/link'
import { sha256 } from 'multiformats/hashes/sha2'
import * as Claims from '@web3-storage/content-claims/client'
import { CarBlockIterator } from '@ipld/car'
import { LinkIndexer } from 'linkdex'
import { DataSourceConfiguration, Shard, Upload } from './api'
import { carCode } from './constants'

export const id = 'classic.nft.storage'

export const checkToken = async (token: string) => {
  const client = new NFTStorage({ token })
  try {
    await client.status(crypto.randomUUID())
  } catch (err: any) {
    if (!err.message.startsWith('Invalid CID')) {
      throw err
    }
  }
}

interface Service {
  endpoint: URL
  token: string
}

interface ListOptions {
  before?: string
}

interface UploadListItem {
  /** The root CID of the upload */
  cid: string
  /** CIDs of CARs the upload was sharded into. */
  parts: string[]
  /**
   * Type of the upload.
   * "remote" = Pinning Service API
   * "nft" = Multipart upload of NFT data
   */
  type: string
}

export const createReader = (conf: DataSourceConfiguration) => new Reader(conf)

class Reader {
  #token
  #cursor
  #client
  #started

  constructor ({ token, cursor }: DataSourceConfiguration) {
    this.#token = token
    this.#cursor = cursor
    this.#client = new NFTStorage({ token })
    this.#started = false
  }

  async count () {
    const headers = NFTStorage.auth({ token: this.#token })
    const res = await fetch(this.#client.endpoint, { headers })
    const count = res.headers.get('count')
    if (!count) throw new Error('missing count in headers')
    return parseInt(count)
  }

  [Symbol.asyncIterator] () {
    return this.list()
  }

  async* list () {
    const listPage = async ({ endpoint, token }: Service, { before }: ListOptions) => {
      const params = new URLSearchParams()
      if (before) params.append('before', before)
      params.append('limit', String(1000))
      const url = new URL(`?${params}`, endpoint)
      return fetch(url, { headers: NFTStorage.auth({ token }) })
    }

    for await (const res of paginator(listPage, this.#client, {})) {
      for (const raw of res.value) {
        if (this.#cursor && !this.#started) {
          if (raw.cid === this.#cursor) {
            this.#started = true
          }
          continue
        }

        const root = Link.parse(raw.cid)

        let parts = raw.parts
        if (!parts.length && raw.type === 'remote') {
          try {
            // If no parts, and this was a pin request, then pickup may have
            // dealt with it.
            //
            // Pickup downloads the data, writes a CAR, calculates the CAR CID
            // and then copies the CAR to carpark, using the CAR CID as the key.
            // Format: `<carCID>/<carCID>.car`.
            //
            // If so we should be able to get a location claim, and key in the
            // claim should be the CAR CID.
            const claims = await Claims.read(root)
            const locationClaims = []
            for (const c of claims) {
              if (c.type === 'assert/location') {
                locationClaims.push(c)
              }
            }
            // It needs to be the _only_ location claim because someone else may
            // have uploaded the same root CID sharded across multiple CARs
            if (locationClaims.length === 1) {
              const url = locationClaims[0].location.find(url => url.endsWith('.car'))
              if (url) {
                const part = url.split('/').pop()?.slice(0, -4)
                if (part) parts.push(part)
              }
            }
          } catch (err) {
            console.error(`failed to read content claims for PSA item: ${root}`, err)
          }
        } 

        const shards: Shard[] = []
        for (const p of parts) {
          shards.push({
            link: Link.parse(p),
            size: async () => {
              const res = await fetch(`https://${p}.ipfs.w3s.link/`, { method: 'HEAD' })
              if (!res.ok) throw new Error(`failed to get size: ${p}`, { cause: { status: res.status } })
              const contentLength = res.headers.get('Content-Length')
              if (!contentLength) throw new Error('missing content length')
              return parseInt(contentLength)
            },
            bytes: async () => {
              // Should not be necessary - service should signal this shard
              // already exists and does not need re-upload.
              const res = await fetch(`https://${p}.ipfs.w3s.link/`)
              if (!res.ok) throw new Error(`failed to get shard: ${p}`, { cause: { status: res.status } })
              return new Uint8Array(await res.arrayBuffer())
            }
          })
        }

        // Add a synthetic shard that is the entire DAG.
        // Attempt to download from gateway.
        // TODO: fetch from /complete?
        if (!shards.length) {
          try {
            const res = await fetch(`https://w3s.link/ipfs/${root}?format=car`)
            if (!res.ok) throw new Error('failed to get DAG as CAR', { cause: { status: res.status } })
            const bytes = new Uint8Array(await res.arrayBuffer())
            // Verify CAR is complete
            const iterator = await CarBlockIterator.fromBytes(bytes)
            const index = new LinkIndexer()
            for await (const block of iterator) {
              index.decodeAndIndex(block)
            }
            if (!index.isCompleteDag()) {
              throw new Error('CAR does not contain a complete DAG')
            }
            const link = Link.create(carCode, await sha256.digest(bytes))
            shards.push({ link, size: async () => bytes.length, bytes: async () => bytes })
          } catch (err) {
            console.error(`failed to download CAR for item: ${root}`, err)
          }
        }

        yield { root, shards } as Upload
      }
    }
  }
}

/**
 * Follow before with last item, to fetch all the things.
 */
async function * paginator (fn: (service: Service, opts: ListOptions) => Promise<Response>, service: Service, opts: ListOptions): AsyncGenerator<{ value: UploadListItem[] }> {
  let res = await fn(service, opts)
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error('rate limited')
    }
    const errorMessage = await res.json()
    throw new Error(`${res.status} ${res.statusText} ${errorMessage ? '- ' + errorMessage.message : ''}`)
  }
  let body = await res.json()
  yield body

  // Iterate through next pages
  while (body && body.value.length) {
    // Get before timestamp with less 1ms
    const before = (new Date((new Date(body.value[body.value.length-1].created)).getTime() - 1)).toISOString()
    res = await fn(service, { ...opts, before })
    body = await res.json()
    yield body
  }
}

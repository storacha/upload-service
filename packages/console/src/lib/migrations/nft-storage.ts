import { NFTStorage } from 'nft.storage'
import * as Link from 'multiformats/link'
import { MigrationSourceConfiguration, Shard, Upload } from './api'

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

export class NFTStorageMigrator {
  #token
  #cursor
  #client
  #started

  constructor ({ token, cursor }: MigrationSourceConfiguration) {
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

        const shards: Shard[] = []
        for (const p of raw.parts) {
          shards.push({
            link: Link.parse(p),
            size: async () => {
              const res = await fetch(`https://w3s.link/ipfs/${p}`, { method: 'HEAD' })
              if (!res.ok) throw new Error(`failed to get size: ${p}`, { cause: { status: res.status } })
              const contentLength = res.headers.get('Content-Length')
              if (!contentLength) throw new Error('missing content length')
              return parseInt(contentLength)
            },
            bytes: async () => {
              // TODO: fetch from /complete?
              throw new Error('not implemented')
            }
          })
        }

        yield { root: Link.parse(raw.cid), shards } as Upload
      }
    }
  }
}

/**
 * Follow before with last item, to fetch all the things.
 */
async function * paginator (fn: (service: Service, opts: ListOptions) => Promise<Response>, service: Service, opts: ListOptions) {
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

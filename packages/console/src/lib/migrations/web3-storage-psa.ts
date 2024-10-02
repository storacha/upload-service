import * as Link from 'multiformats/link'
import { UnknownLink } from 'multiformats'
import * as dagJSON from '@ipld/dag-json'
import { DataSourceConfiguration, Shard, Upload } from './api'
import * as Gateway from './gateway'
import { Result, Failure } from '@ucanto/interface'
import { CARLink } from '@w3ui/react'

export const id = 'psa.old.web3.storage'

export const checkToken = async (token: string) => {
  await createReader({ token }).count()
}

export const createReader = (conf: DataSourceConfiguration) => new Reader(conf)

const endpoint = new URL('https://api.web3.storage')
const hasherEndpoint = new URL('https://hash-psa-old.web3.storage')
const downloadEndpoint = new URL('https://download-psa-old.web3.storage')
const pageSize = 1000

class Reader {
  #token
  #cursor
  #started

  constructor ({ token, cursor }: DataSourceConfiguration) {
    this.#token = token
    this.#cursor = cursor
    this.#started = false
  }

  async count () {
    const url = new URL('/user/pins?status=queued,pinning,pinned,failed&size=1', endpoint)
    const res = await fetch(url, { headers: { Authorization: `Bearer ${this.#token}` } })
    if (!res.ok) {
      throw new Error(`requesting pin count: ${res.status}`)
    }
    const data = await res.json()
    const count = data?.count
    if (typeof count !== 'number') {
      throw new Error(`unexpected type for pin count: ${typeof count}`)
    }
    return count
  }

  [Symbol.asyncIterator] () {
    return this.list()
  }

  async* list (): AsyncIterator<Upload> {
    let page = 1
    while (true) {
      const url = new URL('/user/pins', endpoint)
      url.searchParams.set('status', 'queued,pinning,pinned,failed')
      url.searchParams.set('page', page.toString())
      url.searchParams.set('size', pageSize.toString())

      const res = await fetch(url, { headers: { Authorization: `Bearer ${this.#token}` } })
      if (!res.ok) throw new Error(`requesting pin count: ${res.status}`)

      const data: PinsResponse = await res.json()
      for (const result of data.results) {
        if (this.#cursor && !this.#started) {
          if (result.pin.cid === this.#cursor) {
            this.#started = true
          }
          continue
        }

        const root = Link.parse(result.pin.cid)
        const shards: Shard[] = []

        try {
          const hasherURL = new URL(hasherEndpoint)
          hasherURL.searchParams.set('root', root.toString())
          const res = await fetch(hasherURL)
          const data: Result<HasherSuccess, Failure> = dagJSON.parse(await res.text())
          if (data.error) {
            throw new Error('fetching CAR hash', { cause: data.error })
          }
          shards.push({
            link: data.ok.link,
            size: async () => data.ok.size,
            bytes: async () => {
              const downloadURL = new URL(downloadEndpoint)
              downloadURL.searchParams.set('root', root.toString())
              const downloadRes = await fetch(downloadURL)
              const data: Result<DownloadSuccess, Failure> = dagJSON.parse(await downloadRes.text())
              if (data.error) {
                throw new Error('getting download URL', { cause: data.error })
              }
              const bytesRes = await fetch(data.ok.url)
              if (!bytesRes.ok) {
                throw new Error(`downloading from: ${data.ok.url}, status: ${bytesRes.status}`)
              }
              return new Uint8Array(await bytesRes.arrayBuffer())
            }
          })
        } catch (err) {
          console.error(`determining CAR hash for root: ${root}`, err)
        }

        // Add a synthetic shard that is the entire DAG.
        // Attempt to download from gateway.
        if (!shards.length) {
          try {
            const shard = await Gateway.fetchCAR(root)
            shards.push(shard)
          } catch (err) {
            console.error(`downloading CAR for root: ${root}`, err)
          }
        }

        yield { root, shards }
      }

      if (!res.headers.get('Link')?.includes('rel="next"')) break
      page++
    }
  }
}

interface PinsResponse {
  count: number
  results: PinItem[]
}

interface PinItem {
  created: string
  delegates: string[]
  pin: {
    cid: string
    name?: string
  }
  requestid: string
  status: 'queued'|'pinning'|'pinned'|'failed'
}

interface HasherSuccess {
  root: UnknownLink
  link: CARLink
  size: number
}

interface DownloadSuccess {
  root: UnknownLink
  url: string
}

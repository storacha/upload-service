import { Web3Storage } from 'web3.storage'
import * as Link from 'multiformats/link'
import { DataSourceConfiguration, Shard, Upload } from './api'
import { fetchCAR } from './gateway'
import { logAndCaptureError } from '@/sentry'

export const id = 'old.web3.storage'

export const checkToken = async (token: string) => {
  await new Web3Storage({ token }).list()[Symbol.asyncIterator]().next()
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
    this.#client = new Web3Storage({ token })
    this.#started = false
  }

  async count () {
    const headers = Web3Storage.headers(this.#token)
    const res = await fetch(`${this.#client.endpoint}user/uploads`, { headers })
    const count = res.headers.get('count')
    if (!count) throw new Error('missing count in headers')
    return parseInt(count)
  }

  [Symbol.asyncIterator] () {
    return this.list()
  }

  async* list () {
    for await (const raw of this.#client.list()) {
      if (this.#cursor && !this.#started) {
        if (raw.cid === this.#cursor) {
          this.#started = true
        }
        continue
      }

      const root = Link.parse(raw.cid)
      const parts: string[] = raw.parts

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
      if (!shards.length) {
        try {
          const shard = await fetchCAR(root)
          shards.push(shard)
        } catch (err) {
          logAndCaptureError(new Error(`failed to download CAR for item: ${root}`, {cause: err}))
        }
      }

      yield { root, shards } as Upload
    }
  }
}

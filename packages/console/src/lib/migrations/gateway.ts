import { UnknownLink } from 'multiformats'
import * as Link from 'multiformats/link'
import { sha256 } from 'multiformats/hashes/sha2'
import { CarBlockIterator } from '@ipld/car'
import { LinkIndexer } from 'linkdex'
import { carCode } from './constants'
import { Shard } from './api'

export const fetchCAR = async (root: UnknownLink, options?: { timeout?: number }): Promise<Shard> => {
  const controller = new AbortController()
  const timeoutID = setTimeout(() => controller.abort(), options?.timeout ?? 30_000)
  try {
    const res = await fetch(`https://w3s.link/ipfs/${root}?format=car`, { signal: controller.signal })
    if (!res.ok) throw new Error('failed to get DAG as CAR', { cause: { status: res.status } })
    clearTimeout(timeoutID)

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
    return { link, size: async () => bytes.length, bytes: async () => bytes }
  } finally {
    clearTimeout(timeoutID)
  }
}

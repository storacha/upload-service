import * as Link from 'multiformats/link'
import * as raw from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'

export { toCAR } from './car.js'

/** @param {Uint8Array} bytes */
export const toFilepackData = async (bytes) => {
  const blob = new Blob([bytes])
  const root = Link.create(raw.code, await sha256.digest(bytes))
  return Object.assign(blob, { cid: root, root })
}

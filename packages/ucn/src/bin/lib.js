import os from 'node:os'
import fs from 'node:fs/promises'
import path from 'node:path'
import childProcess from 'node:child_process'
import * as ed25519 from '@ucanto/principal/ed25519'
import * as Delegation from '@ucanto/core/delegation'
import * as dagJSON from '@ipld/dag-json'
import * as DID from '@ipld/dag-ucan/did'
import * as Revision from '../revision.js'
import * as Value from '../value.js'

/** @import * as API from './api.js' */

export const getAgent = async () => {
  const keyPath = path.join(await getDataDir(), 'id')
  let keyBytes
  try {
    keyBytes = await fs.readFile(keyPath)
  } catch {
    const signer = await ed25519.generate()
    const data = dagJSON.encode({
      default: signer.did(),
      [signer.did()]: signer.encode()
    })
    await fs.writeFile(keyPath, data, { mode: 0o600 })
    return signer
  }
  const data = dagJSON.decode(keyBytes)
  return ed25519.decode(data[data['default']])
}

/** @returns {Promise<Record<API.DID, API.Delegation>>} */
export const getNames = async () => {
  const namesPath = path.join(await getDataDir(), 'names.json')
  let namesBytes
  try {
    namesBytes = await fs.readFile(namesPath)
  } catch {
    await setNames({})
    return {}
  }
  const data = dagJSON.decode(namesBytes)
  /** @type {Record<API.DID, API.Delegation>} */
  const result = {}
  for (const [k, v] of Object.entries(data)) {
    const extracted = await Delegation.extract(v)
    if (extracted.error) throw extracted.error
    result[DID.parse(k).did()] = extracted.ok
  }
  return result
}

/** @param {Record<API.DID, API.Delegation>} names */
export const setNames = async (names) => {
  const namesPath = path.join(await getDataDir(), 'names.json')
  /** @type {Record<string, Uint8Array>} */
  const data = {}
  for (const [k, v] of Object.entries(names)) {
    const archived = await Delegation.archive(v)
    if (archived.error) throw archived.error
    data[k] = archived.ok
  }
  await fs.writeFile(namesPath, dagJSON.encode(data), { mode: 0o770 })
}

/** @param {API.Name} name */
export const addName = async (name) => {
  const names = await getNames()
  names[name.did()] = name.proof
  await setNames(names)
}

/** @param {API.DID} id */
export const removeName = async (id) => {
  const names = await getNames()
  delete names[id]
  await setNames(names)
}

/** @param {API.Revision} revision */
export const storeRevision = async (revision) => {
  const bytes = await revision.archive()
  const tmpPath = path.join(os.tmpdir(), revision.event.cid.toString())
  await fs.writeFile(tmpPath, bytes)
  childProcess.execFileSync('w3', ['up', '--car', '--json', tmpPath])
}

/**
 * @param {API.Name} name
 * @returns {Promise<API.Value|undefined>}
 */
export const getValue = async (name) => {
  const valuePath = await getValuePath(name)
  let valueBytes
  try {
    valueBytes = await fs.readFile(valuePath)
  } catch {
    return
  }
  /** @type {{ revision: Uint8Array[] }} */
  const data = dagJSON.decode(valueBytes)
  const revision = []
  for (const bytes of data.revision) {
    revision.push(await Revision.extract(bytes))
  }
  return Value.from(name, ...revision)
}

/** @param {API.Value} value */
export const setValue = async (value) => {
  const valuePath = await getValuePath(value.name)
  const data = { revision: /** @type {Uint8Array[]} */ ([]) }
  for (const r of value.revision) {
    data.revision.push(await r.archive())
  }
  return fs.writeFile(valuePath, dagJSON.encode(data), { mode: 0o770 })
}

/** @param {API.Name} name */
const getValuePath = async (name) => {
  const dir = path.join(await getDataDir(), 'values')
  await fs.mkdir(dir, { recursive: true, mode: 0o700 })
  return path.join(dir, String(name.did().split(':').pop()))
}

const getDataDir = async () => {
  const dir = path.join(os.homedir(), '.ucn')
  await fs.mkdir(dir, { recursive: true, mode: 0o700 })
  return dir
}

/** @param {API.Capability} c */
const isWritable = c => ['*', 'clock/*', 'clock/advance'].includes(c.can)

/** @param {API.Delegation} delegation */
export const isReadOnly = (delegation) => !delegation.capabilities.some(isWritable)


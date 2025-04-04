import { getAgent, getNames, isReadOnly } from '../lib.js'

/** @param {{ l?: boolean }} [options] */
export const handler = async (options) => {
  const [agent, names] = await Promise.all([getAgent(), getNames()])
  if (options?.l)
    console.log(`total ${Object.keys(names).length.toLocaleString()}`)
  for (const [k, v] of Object.entries(names)) {
    if (v.audience.did() !== agent.did()) continue
    if (options?.l) {
      console.log(`${isReadOnly(v) ? 'r-' : 'rw'}\t${k}`)
    } else {
      console.log(k)
    }
  }
}

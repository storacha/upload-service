import { getAgent, getNames, isReadOnly } from '../lib.js'

/** @param {{ l?: boolean }} [options] */
export const handler = async (options) => {
  const agent = await getAgent()
  const names = await getNames(agent)
  if (options?.l)
    console.log(`total ${Object.keys(names).length.toLocaleString()}`)
  for (const [k, v] of Object.entries(names)) {
    if (options?.l) {
      console.log(`${isReadOnly(v.proofs) ? 'r-' : 'rw'}\t${k}`)
    } else {
      console.log(k)
    }
  }
}

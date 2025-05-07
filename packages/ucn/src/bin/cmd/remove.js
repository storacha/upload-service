import * as DID from '@ipld/dag-ucan/did'
import { getAgent, getNames, removeName } from '../lib.js'

/** @param {string} id */
export const handler = async (id) => {
  const agent = await getAgent()
  const names = await getNames(agent)
  const nameID = DID.parse(id).did()
  if (!names[nameID]) {
    console.error(`unknown name: ${nameID}`)
    process.exit(1)
  }
  await removeName(names[nameID])
}

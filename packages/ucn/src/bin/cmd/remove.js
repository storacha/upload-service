import * as DID from '@ipld/dag-ucan/did'
import { removeName } from '../lib.js'

/** @param {string} id */
export const handler = async (id) => {
  await removeName(DID.parse(id).did())
}

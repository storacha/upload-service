import * as DID from '@ipld/dag-ucan/did'
import { getAgent, getNames } from '../lib.js'
import * as Name from '../../name.js'
import * as Proof from '../../proof.js'

/**
 * @param {string} id
 * @param {string} recipient
 * @param {{ 'read-only'?: boolean }} [options]
 */
export const handler = async (id, recipient, options) => {
  const [agent, names] = await Promise.all([getAgent(), getNames()])
  const nameID = DID.parse(id).did()
  if (!names[nameID]) {
    console.error(`unknown name: ${nameID}`)
    process.exit(1)
  }
  const name = Name.from(agent, names[nameID])
  const delegation = await name.grant(DID.parse(recipient).did(), {
    readOnly: options?.['read-only']
  })
  console.log(await Proof.format(delegation))
}

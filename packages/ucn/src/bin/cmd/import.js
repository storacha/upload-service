import { addName, getAgent, isReadOnly } from '../lib.js'
import * as Name from '../../name.js'
import * as Proof from '../../proof.js'

/**
 * @param {string} b64proof
 */
export const handler = async (b64proof) => {
  const agent = await getAgent()
  const proof = await Proof.parse(b64proof)

  if (proof.audience.did() !== agent.did()) {
    console.error('proof is not valid for this agent')
    process.exit(1)
  }

  const name = Name.from(agent, [proof])
  await addName(name)

  console.log(`${isReadOnly([proof]) ? 'r-' : 'rw'}\t${name.did()}`)
}

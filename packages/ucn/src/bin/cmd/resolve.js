import * as DID from '@ipld/dag-ucan/did'
import { getAgent, getValue, getNames, setValue } from '../lib.js'
import * as Name from '../../name.js'

/**
 * @param {string} id
 * @param {{ local?: boolean }} [options]
 */
export const handler = async (id, options) => {
  const [agent, names] = await Promise.all([getAgent(), getNames()])
  const nameID = DID.parse(id).did()
  if (!names[nameID]) {
    console.error(`unknown name: ${nameID}`)
    process.exit(1)
  }

  const name = Name.from(agent, names[nameID])
  const base = await getValue(name)

  let current
  if (options?.local) {
    current = base
  } else {
    try {
      current = await Name.resolve(name, { base })
    } catch {
      current = base
    }
  }

  if (!current) {
    console.error('unable to resolve')
    process.exit(1)
  }

  await setValue(current)
  console.log(current.value)
}

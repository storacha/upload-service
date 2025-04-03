import * as DID from '@ipld/dag-ucan/did'
import {
  getAgent,
  getValue,
  getNames,
  setValue,
  storeRevision,
  isReadOnly,
} from '../lib.js'
import * as Name from '../../name.js'

/**
 * @param {string} id
 * @param {string} value
 */
export const handler = async (id, value) => {
  const [agent, names] = await Promise.all([getAgent(), getNames()])
  const nameID = DID.parse(id).did()
  if (!names[nameID]) {
    console.error(`unknown name: ${nameID}`)
    process.exit(1)
  }
  if (isReadOnly(names[nameID])) {
    console.error('unable to update read only name')
    process.exit(1)
  }

  const name = Name.from(agent, names[nameID])
  const base = await getValue(name)

  let current
  try {
    current = await Name.resolve(name, { base })
  } catch {
    current = base
  }

  if (current && current.value === value) {
    // no need to update
  } else {
    const revision = current
      ? await Name.increment(current, value)
      : await Name.v0(value)

    await storeRevision(revision)

    current = await Name.publish(name, revision)
    await setValue(current)
  }

  console.log('Revision:')
  for (const r of current.revision) {
    console.log(`  ${r.event.cid}`)
    if (r.event.value.parents.length) {
      console.log(`    Parents:`)
      for (const p of r.event.value.parents) {
        console.log(`      ${p}`)
      }
    }
  }
  console.log(
    `Value${current.revision.length > 1 ? ' (resolved from conflict)' : ''}:`
  )
  console.log(`  ${current.value}`)
}

import { addName, getAgent } from '../lib.js'
import * as Name from '../../name.js'

export const handler = async () => {
  const agent = await getAgent()
  const name = await Name.create(agent)
  await addName(name)
  console.log(name.did())
}

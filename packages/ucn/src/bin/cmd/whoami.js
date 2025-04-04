import { getAgent } from '../lib.js'

export const handler = async () => {
  const agent = await getAgent()
  console.log(agent.did())
}

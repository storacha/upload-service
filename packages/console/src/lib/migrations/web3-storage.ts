// @ts-expect-error not sure why types not working for old client!?
import { Web3Storage } from 'web3.storage'

export const checkToken = async (token: string) => {
  await new Web3Storage({ token }).list().next()
}

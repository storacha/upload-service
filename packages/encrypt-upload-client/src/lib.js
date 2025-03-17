import { LitNodeClient } from '@lit-protocol/lit-node-client'
import env from './env.js'

export async function getLit() {
    const litNodeClient = new LitNodeClient({
      litNetwork: env.LIT_NETWORK,
      debug: env.LIT_DEBUG
    })
  
    await litNodeClient.connect()
    return litNodeClient
  }
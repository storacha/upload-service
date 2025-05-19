import * as fs from 'fs'
import dotenv from 'dotenv'
import { CID } from 'multiformats'
import * as Client from '@storacha/client'
import * as Signer from '@ucanto/principal/ed25519'
import { StoreMemory } from '@storacha/client/stores/memory'

import { create, Wallet } from '../src/index.js'
import { serviceConf, receiptsEndpoint } from '../src/config/service.js'
import { NodeCryptoAdapter } from '../src/crypto-adapters/node-crypto-adapter.js'

dotenv.config()

async function main() {
  // set up storacha client with a new agent
  const cid = CID.parse(
    'bafyreifhwqmspdjsy6rgcmcizgodv7bwskgiehjhdx7wukax3z5r7tz5ji'
  )

  const delegationCarBuffer = fs.readFileSync('delegation.car')

  const wallet = new Wallet(process.env.WALLET_PK || '')

  const principal = Signer.parse(process.env.DELEGATEE_AGENT_PK || '')
  const store = new StoreMemory()

  const client = await Client.create({
    principal,
    store,
    serviceConf,
    receiptsEndpoint,
  })

  const encryptedClient = await create({
    storachaClient: client,
    cryptoAdapter: new NodeCryptoAdapter(),
  })

  const signer = { wallet }
  const decryptedContent = await encryptedClient.retrieveAndDecryptFile(
    signer,
    cid,
    delegationCarBuffer
  )

  const reader = decryptedContent.getReader()
  const decoder = new TextDecoder()
  let result = ''

  let done = false
  while (!done) {
    const { value, done: isDone } = await reader.read()
    done = isDone
    if (value) {
      result += decoder.decode(value, { stream: true })
    }
  }

  console.log('================ RESULT ===================')
  console.log(result)
  console.log('===========================================')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })

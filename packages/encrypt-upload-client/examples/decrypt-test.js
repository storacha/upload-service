import * as fs from 'fs'
import dotenv from 'dotenv'
import { CID } from 'multiformats'
import * as Client from '@storacha/client'
import * as Signer from '@ucanto/principal/ed25519'
import { StoreMemory } from '@storacha/client/stores/memory'

import { create } from '../src/index.js'
import { Wallet } from 'ethers'
import { serviceConf, receiptsEndpoint } from '../src/config/service.js'
import { createNodeLitAdapter } from '../src/crypto/factories.node.js'
import { LitNodeClient } from '@lit-protocol/lit-node-client'
import { extract } from '@ucanto/core/delegation'

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

  // Set up Lit client
  const litClient = new LitNodeClient({
    litNetwork: 'datil-dev',
  })
  await litClient.connect()

  const encryptedClient = await create({
    storachaClient: client,
    cryptoAdapter: createNodeLitAdapter(litClient),
  })

  const res = await extract(delegationCarBuffer)
  if (res.error) {
    throw new Error(`Failed to extract delegation: ${res.error.message}`)
  }
  const decryptDelegation = res.ok
  const decryptionCapability = decryptDelegation.capabilities.find(
    (c) => c.can === 'space/content/decrypt'
  )
  if (!decryptionCapability) {
    throw new Error('Failed to find decryption capability')
  }

  const spaceDID = /** @type {`did:key:${string}`} */ (
    decryptionCapability.with
  )

  const decryptionConfig = {
    wallet,
    decryptDelegation,
    spaceDID,
  }
  const decryptedContent = await encryptedClient.retrieveAndDecryptFile(
    cid,
    decryptionConfig
  )

  const reader = decryptedContent.stream.getReader()
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

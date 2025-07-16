import * as fs from 'fs'
import dotenv from 'dotenv'
import { CarReader } from '@ipld/car'
import * as Client from '@storacha/client'
import { importDAG } from '@ucanto/core/delegation'
import * as Signer from '@ucanto/principal/ed25519'
import { StoreMemory } from '@storacha/client/stores/memory'

import * as EncryptClient from '../src/index.js'
import { serviceConf, receiptsEndpoint } from '../src/config/service.js'
import { createNodeLitAdapter } from '../src/crypto/factories.node.js'
import { LitNodeClient } from '@lit-protocol/lit-node-client'

dotenv.config()

/** @param {string} data Base64 encoded CAR file */
export async function parseProof(data) {
  const blocks = []
  const reader = await CarReader.fromBytes(Buffer.from(data, 'base64'))
  for await (const block of reader.blocks()) {
    blocks.push(block)
  }
  return importDAG(blocks)
}

async function main() {
  // set up storacha client with a new agent
  const principal = Signer.parse(process.env.AGENT_PK || '')
  const store = new StoreMemory()

  const client = await Client.create({
    principal,
    store,
    serviceConf,
    receiptsEndpoint,
  })

  // now give Agent the delegation from the Space
  const proof = await parseProof(process.env.PROOF || '')
  const space = await client.addSpace(proof)
  await client.setCurrentSpace(space.did())

  // Set up Lit client
  const litClient = new LitNodeClient({
    litNetwork: 'datil-dev',
  })
  await litClient.connect()

  const encryptedClient = await EncryptClient.create({
    storachaClient: client,
    cryptoAdapter: createNodeLitAdapter(litClient),
  })

  const fileContent = await fs.promises.readFile('./README.md')
  const blob = new Blob([fileContent])

  // Create encryption config
  const encryptionConfig = {
    issuer: principal,
    spaceDID: space.did(),
  }

  const link = await encryptedClient.encryptAndUploadFile(
    blob,
    encryptionConfig
  )
  console.log(link)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })

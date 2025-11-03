import * as fs from 'fs'
import dotenv from 'dotenv'
import { DID } from '@ucanto/server'
import * as Client from '@storacha/client'
import * as Proof from '@storacha/client/proof'
import * as Signer from '@ucanto/principal/ed25519'
import { StoreMemory } from '@storacha/client/stores/memory'
import { decrypt } from '@storacha/capabilities/space'

import { nagaTest } from '@lit-protocol/networks'
import { createLitClient } from '@lit-protocol/lit-client'

import * as EncryptClient from '../src/index.js'
import { serviceConf, receiptsEndpoint } from '../src/config/service.js'
import { createGenericLitAdapter } from '../src/crypto/factories.node.js'
import { CID } from 'multiformats'

dotenv.config()

const PROOF = process.env.PROOF || ''
const AGENT_PK = process.env.AGENT_PK || ''
const AUDIENCE_DID = process.env.AUDIENCE_DID || ''

async function main() {
  console.log('Starting encrypt-upload-client example...')
  // set up storacha client with a new agent
  const principal = Signer.parse(AGENT_PK)
  console.log(`Using agent: ${principal.did()}`)
  const store = new StoreMemory()

  const client = await Client.create({
    principal,
    store,
    serviceConf,
    receiptsEndpoint,
  })

  // now give Agent the delegation from the Space
  const proof = await Proof.parse(PROOF)
  const space = await client.addSpace(proof)
  await client.setCurrentSpace(space.did())

  console.log(`Using space: ${space.did()}, creating lit client...`)

  // Set up Lit client
  const litClient = await createLitClient({
    network: nagaTest,
  })

  const encryptedClient = await EncryptClient.create({
    storachaClient: client,
    cryptoAdapter: createGenericLitAdapter(litClient),
  })

  const fileContent = await fs.promises.readFile('./README.md')
  const blob = new Blob([Uint8Array.from(fileContent)])

  // Create encryption config
  const encryptionConfig = {
    issuer: principal,
    spaceDID: space.did(),
  }

  console.log('Encrypting and uploading file...')

  const link = await encryptedClient.encryptAndUploadFile(
    blob,
    encryptionConfig
  )

  console.log('Finished uploading file:', link)

  // If we already have a CID
  // const link = CID.parse(
  //   'bafyreid6euzw23b5puazg6epubzaxibim7fioavoe6xydffibbzju4feae'
  // )

  console.log('🔄 Creating decrypt delegation with:')

  const delegationOptions = {
    issuer: principal,
    audience: DID.parse(AUDIENCE_DID),
    with: space.did(),
    nb: {
      resource: link,
    },
    expiration: new Date(Date.now() + 1000 * 60 * 10).getTime(), // 10 min,
    proofs: [proof],
  }

  console.log({
    ...delegationOptions,
    issuer: principal.did(),
    audience: AUDIENCE_DID,
  })

  const delegation = await decrypt.delegate(delegationOptions)
  const { ok: bytes } = await delegation.archive()

  fs.writeFileSync(
    'delegation.car',
    Buffer.from(/** @type Uint8Array<ArrayBufferLike>**/ (bytes))
  )
  console.log(`✅ Delegation written to delegation.car`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })

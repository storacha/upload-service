import * as fs from 'fs'
import dotenv from 'dotenv'
import { ethers } from 'ethers'
import * as Client from '@storacha/client'
import * as Signer from '@ucanto/principal/ed25519'
import { StoreMemory } from '@storacha/client/stores/memory'

import * as EncryptClient from '../src/index.js'
import { NodeCryptoAdapter } from '../src/crypto/index.js'
import { serviceConf, receiptsEndpoint } from '../src/config/service.js'

dotenv.config()

async function main(){
    // set up storacha client with a new agent
    const cid = 'bafyreifhwqmspdjsy6rgcmcizgodv7bwskgiehjhdx7wukax3z5r7tz5ji'

    const delegationCarBuffer = fs.readFileSync('delegation.car')

    const wallet = new ethers.Wallet(process.env.WALLET_PK || '')

    const principal = Signer.parse(process.env.DELEGATEE_AGENT_PK || '')
    const store = new StoreMemory()
    
    const client = await Client.create({ principal, store, serviceConf, receiptsEndpoint })


    const encryptedClient = await EncryptClient.create({
        storachaClient: client,
        cryptoAdapter: new NodeCryptoAdapter()
    })

    const decryptedContent = await encryptedClient.retrieveAndDecryptFile(wallet, cid, delegationCarBuffer)

    const reader = decryptedContent.getReader();
    const decoder = new TextDecoder();
    let result = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }

    console.log('================ RESULT ===================')
    console.log(result)
    console.log('===========================================')
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
process.env.LOG_LEVEL = 'info'
import * as fs from 'fs'
import dotenv from 'dotenv'
import { CID } from 'multiformats'
import * as Client from '@storacha/client'
import * as Signer from '@ucanto/principal/ed25519'
import { StoreMemory } from '@storacha/client/stores/memory'
import { nagaTest } from '@lit-protocol/networks'
import { createLitClient } from '@lit-protocol/lit-client'
import { privateKeyToAccount } from 'viem/accounts'

import { create } from '../src/index.js'
import { serviceConf, receiptsEndpoint } from '../src/config/service.js'
import { createGenericLitAdapter } from '../src/crypto/factories.node.js'
import { extract } from '@ucanto/core/delegation'
import { createAuthManager, storagePlugins } from '@lit-protocol/auth'

dotenv.config()

const WALLET_PK = /** @type {`0x${string}`}  */ (process.env.WALLET_PK) || '0x'
const DELEGATEE_AGENT_PK = process.env.DELEGATEE_AGENT_PK || ''

async function main() {
  console.log('Starting encrypt-decrypt test example...')

  // encrypted content CID
  const cid = CID.parse(
    'bafyreigmpvb4rhs6uod7qzxw65fxgruagg5x37swmf5p434cto36nlz7a4'
  )

  const delegationCarBuffer = fs.readFileSync('delegation.car')

  const wallet = privateKeyToAccount(WALLET_PK)

  const principal = Signer.parse(DELEGATEE_AGENT_PK)
  const store = new StoreMemory()

  const client = await Client.create({
    principal,
    store,
    serviceConf,
    receiptsEndpoint,
  })

  // Set up Lit client
  const litClient = await createLitClient({
    network: nagaTest,
  })

  const authManager = createAuthManager({
    storage: storagePlugins.localStorageNode({
      appName: 'my-app',
      networkName: 'naga-local',
      storagePath: './lit-auth-local',
    }),
  })

  const encryptedClient = await create({
    storachaClient: client,
    cryptoAdapter: createGenericLitAdapter(litClient, authManager),
  })

  console.log('Extracting delegation from CAR file...')

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

  const paymentManager = await litClient.getPaymentManager({
    account: wallet,
  })
  const balance = await paymentManager.getBalance({
    userAddress: wallet.address,
  })
  console.log('Current Balance: ', balance.totalBalance)

  /**
   *  Uncomment to deposit funds from your wallet to the Lit Payment Manager contract so you can pay for Lit Actions
   *  If you need testLPX tokens, please visit the faucet: https://chronicle-yellowstone-faucet.getlit.dev/
   */
  // const depositReceipt = await paymentManager.deposit({
  //   amountInEth: '1',
  // })

  // console.log(`Deposit successful: ${depositReceipt.hash}`)

  console.log('Retrieving and decrypting file...')

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

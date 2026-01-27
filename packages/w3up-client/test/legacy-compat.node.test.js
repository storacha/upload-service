import http from 'node:http'
import { Client as LegacyClient } from '@web3-storage/w3up-client'
import { AgentData as LegacyAgentData } from '@web3-storage/access'
import { Client } from '@storacha/client'
import { AgentData } from '@storacha/access'
import * as Link from 'multiformats/link'
import { Message } from '@ucanto/core'
import * as CAR from '@ucanto/transport/car'
import * as Test from './test.js'
import { randomBytes } from './helpers/random.js'

const legacyProviderDID = 'did:web:test.web3.storage'

/** @param {import('@storacha/upload-api').AgentStore} agentStore */
const createReceiptsServer = (agentStore) =>
  http.createServer(async (req, res) => {
    const task = Link.parse(req.url?.split('/').pop() ?? '')
    const receiptGet = await agentStore.receipts.get(task)
    if (receiptGet.error) {
      res.writeHead(404)
      return res.end()
    }
    const message = await Message.build({ receipts: [receiptGet.ok] })
    const request = CAR.request.encode(message)
    res.writeHead(200)
    res.end(request.body)
  })

/** @type {Test.Suite} */
export const testLegacyCompatibility = {
  uploadFile: Test.withContext({
    'should upload a file to the service with legacy client': async (
      assert,
      context
    ) =>
      testUploadFile(assert, {
        ...context,
        legacy: { client: true, space: false },
      }),
    'should upload a file to the service with legacy space': async (
      assert,
      context
    ) =>
      testUploadFile(assert, {
        ...context,
        legacy: { client: false, space: true },
      }),
    'should upload a file to the service with legacy client and space': async (
      assert,
      context
    ) =>
      testUploadFile(assert, {
        ...context,
        legacy: { client: true, space: true },
      }),
  }),
}

/**
 * @param {import('./test.js').Assert} assert
 * @param {import('@storacha/upload-api').UcantoServerTestContext & { legacy: { client?: boolean, space?: boolean } }} context
 */
const testUploadFile = async (
  assert,
  { connection: conn, provisionsStorage, agentStore, legacy }
) => {
  const receiptsServer = createReceiptsServer(agentStore)
  const receiptsEndpoint = await new Promise((resolve) => {
    receiptsServer.listen(() => {
      // @ts-expect-error
      resolve(new URL(`http://127.0.0.1:${receiptsServer.address().port}`))
    })
  })

  try {
    const bytes = await randomBytes(128)
    const file = new Blob([bytes])

    const serviceConf = {
      access: conn,
      upload: conn,
      filecoin: conn,
      gateway: conn,
    }
    const clientOptions = { serviceConf, receiptsEndpoint }
    /** @type {LegacyClient | Client} */
    let alice
    if (legacy.client) {
      // @ts-expect-error store/add removed from Service type but legacy client expects it
      alice = new LegacyClient(await LegacyAgentData.create(), clientOptions)
    } else {
      alice = new Client(await AgentData.create(), clientOptions)
    }

    const space = await alice.createSpace('upload-test', {
      skipGatewayAuthorization: true,
    })
    const auth = await space.createAuthorization(alice)
    await alice.addSpace(auth)
    await alice.setCurrentSpace(space.did())

    await provisionsStorage.put({
      provider:
        /** @type {import('@storacha/upload-api').ProviderDID} */
        (legacy.space ? legacyProviderDID : conn.id.did()),
      // @ts-expect-error not a mailto
      customer: alice.agent.did(),
      consumer: space.did(),
    })

    await assert.doesNotReject(alice.uploadFile(file))
  } finally {
    receiptsServer.close()
  }
}

Test.test({ LegacyCompatibility: testLegacyCompatibility })

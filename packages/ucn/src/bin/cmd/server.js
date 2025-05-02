import * as HTTP from 'node:http'
import { Buffer } from 'node:buffer'
import { createService, createServer } from '../../server/index.js'
import { getAgent, getNames, setValue, getValue } from '../lib.js'
import { GatewayBlockFetcher, MemoryBlockstore, withCache } from '../../block.js'
import { Revision, Value } from '../../index.js'
import { error, ok } from '@ucanto/server'
import { decodeEventBlock } from '@web3-storage/pail/clock'

/** @param {{ p?: string }} [options] */
export const handler = async (options) => {
  const port = options?.p ?? 3000

  const agent = await getAgent()
  const fetcher = withCache(new GatewayBlockFetcher(process.env.UCN_GATEWAY_URL))

  const nameService = createService({
    headStore: {
      // @ts-expect-error
      get: async (nameID) => {
        const names = await getNames(agent)
        const name = names[nameID]
        if (!name) {
          return error({
            name: /** @type {const} */ ('NotFound'),
            message: `Name ${nameID} is not known to this server.`
          })
        }

        const value = await getValue(name)
        if (!value) {
          return error({
            name: /** @type {const} */ ('NotFound'),
            message: `Name ${nameID} is not known to this server.`
          })
        }

        return ok(value.revision.map(r => ({ event: r.event.cid })))
      },
      put: async (nameID, head) => {
        const names = await getNames(agent)
        const name = names[nameID]
        if (!name) {
          return error({
            name: /** @type {const} */ ('NotFound'),
            message: `Name ${nameID} is not known to this server.`
          })
        }
        const revisions = await Promise.all(
          head.map(async (h) => {
            const block = await fetcher.get(h.event)
            if (!block) throw new Error(`fetching event: ${h}`)
            return Revision.from(await decodeEventBlock(block.bytes))
          })
        )

        await setValue(Value.from(name, ...revisions))
        return ok({})
      }
    },
    blockFetcher: fetcher,
    blockCache: new MemoryBlockstore(),
  })
  const ucanServer = createServer(agent, nameService)

  HTTP.createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) {
      chunks.push(chunk)
    }

    const { status, headers, body } = await ucanServer.request({
      // @ts-expect-error
      headers: request.headers,
      body: Buffer.concat(chunks),
    })

    response.writeHead(status ?? 200, headers)
    response.write(body)
    response.end()
  }).listen(port)

  console.log(`Server ID:  ${agent.did()}`)
  console.log(`Server URL: http://localhost:${port}`)
}

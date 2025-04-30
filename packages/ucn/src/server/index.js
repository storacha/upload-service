import * as ClockCaps from '@web3-storage/clock/capabilities'
import * as Clock from '@web3-storage/pail/clock'
import { create, provide, ok } from '@ucanto/server'
import * as CAR from '@ucanto/transport/car'
import * as dagCBOR from '@ipld/dag-cbor'
import * as DID from '@ipld/dag-ucan/did'
import {
  MemoryBlockstore,
  TieredBlockFetcher,
  withCache,
  withInFlight,
} from '../block.js'

/** @import * as API from './api.js' */

/**
 * @param {API.Signer} signer
 * @param {API.Service<API.Value>} service
 */
export const createServer = (signer, service) =>
  create({
    id: signer,
    codec: CAR.inbound,
    service,
    catch: (err) => console.error(err),
    // TODO: wire into revocations
    validateAuthorization: () => ({ ok: {} }),
  })

/**
 * @param {API.Context} context
 * @returns {API.Service<API.Value>}
 */
// TODO: move to w3clock?
export const createService = ({ headStore, blockFetcher, blockCache }) => {
  const baseFetcher = withInFlight(withCache(blockFetcher, blockCache))
  return {
    clock: {
      advance: provide(
        ClockCaps.advance,
        async ({ capability, invocation }) => {
          const event = /** @type {API.EventLink} */ (capability.nb.event)
          const blocks = filterEventBlocks(event, [...invocation.export()])
          const resource = DID.parse(capability.with).did()

          const headGet = await headStore.get(resource)
          if (headGet.error && headGet.error.name !== 'NotFound') {
            return headGet
          }
          const headEvents = headGet.ok ?? []

          const fetcher = new TieredBlockFetcher(
            new MemoryBlockstore(blocks),
            baseFetcher
          )
          const head = await Clock.advance(
            fetcher,
            headEvents.map((h) => h.event),
            event
          )

          for (const b of blocks) {
            blockCache
              .put(b)
              .catch((err) => console.error(`caching block: ${b.cid}`, err))
          }

          const nextHeadEvents = headEvents.filter((nh) =>
            head.some((h) => h.toString() === nh.event.toString())
          )
          if (
            !nextHeadEvents.some((e) => e.event.toString() === event.toString())
          ) {
            nextHeadEvents.push({ event, cause: invocation })
          }

          const headPut = await headStore.put(resource, nextHeadEvents)
          if (headPut.error) {
            return headPut
          }

          let result = ok({
            head,
            // event CID => cause CID
            ...Object.fromEntries(
              nextHeadEvents.map((e) => [e.event, e.cause.cid])
            ),
          })

          // include the stored causes in the response as proof
          for (const e of nextHeadEvents) {
            // @ts-expect-error
            result = result.fork(e.cause)
          }

          return result
        }
      ),
      head: provide(ClockCaps.head, async ({ capability }) => {
        const resource = DID.parse(capability.with).did()
        const headGet = await headStore.get(resource)
        if (headGet.error) {
          if (headGet.error.name === 'NotFound') {
            return ok({ head: [] })
          }
          return headGet
        }

        let result = ok({
          head: headGet.ok.map((d) => d.event),
          // event CID => cause CID
          ...Object.fromEntries(headGet.ok.map((e) => [e.event, e.cause.cid])),
        })

        // include the stored causes in the response as proof
        for (const e of headGet.ok) {
          // @ts-expect-error
          result = result.fork(e.cause)
        }

        return result
      }),
    },
  }
}

/**
 * @param {API.EventLink} event
 * @param {API.Block[]} blocks
 */
const filterEventBlocks = (event, blocks) => {
  /** @type {API.EventBlock[]} */
  const filteredBlocks = []
  const cids = [event]
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const cid = cids.shift()
    if (!cid) break
    const block = blocks.find((b) => b.cid.equals(cid))
    if (!block) continue
    try {
      const value = dagCBOR.decode(block.bytes)
      if (!isEvent(value)) {
        throw new Error(`invalid merkle clock event: ${cid}`)
      }
      cids.push(...value.parents)
    } catch (err) {
      console.warn(err)
    }
    filteredBlocks.push(block)
  }
  return filteredBlocks
}

/**
 * @param {unknown} obj
 * @returns {obj is API.EventView}
 */
const isEvent = (obj) =>
  Boolean(
    obj &&
      typeof obj === 'object' &&
      'data' in obj &&
      'parents' in obj &&
      Array.isArray(obj.parents)
  )

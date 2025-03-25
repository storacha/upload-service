import * as assert from 'assert'
import * as Signer from '@ucanto/principal/ed25519'

import * as AggregatorService from '../src/test/services/aggregator.js'
import * as AggregatorEvents from '../src/test/events/aggregator.js'

import { getStoreImplementations } from '../src/test/context/store-implementations.js'
import { Queue } from '../src/test/context/queue.js'
import { getMockService, getConnection } from '../src/test/context/service.js'
import { validateAuthorization } from '../src/test/utils.js'

describe('Aggregator', () => {
  describe('piece/*', () => {
    for (const [name, test] of Object.entries(AggregatorService.test)) {
      const define = name.startsWith('only ')
        ? it.only
        : name.startsWith('skip ')
        ? it.skip
        : it

      define(name, async () => {
        const aggregatorSigner = await Signer.generate()
        const dealerSigner = await Signer.generate()

        // resources
        /** @type {Map<string, unknown[]>} */
        const queuedMessages = new Map()
        const { pieceQueue } = getQueues(queuedMessages)
        const {
          aggregator: { pieceStore, aggregateStore, inclusionStore },
        } = getStoreImplementations()

        await test(
          {
            equal: assert.strictEqual,
            deepEqual: assert.deepStrictEqual,
            ok: assert.ok,
          },
          {
            id: aggregatorSigner,
            dealerId: dealerSigner,
            errorReporter: {
              catch(error) {
                assert.fail(error)
              },
            },
            pieceStore,
            aggregateStore,
            inclusionStore,
            pieceQueue,
            queuedMessages,
            validateAuthorization,
          }
        )
      })
    }
  })

  describe('events', () => {
    for (const [name, test] of Object.entries(AggregatorEvents.test)) {
      const define = name.startsWith('only ')
        ? it.only
        : name.startsWith('skip ')
        ? it.skip
        : it

      define(name, async () => {
        const aggregatorSigner = await Signer.generate()
        const dealerSigner = await Signer.generate()

        const service = getMockService()
        const aggregatorConnection = getConnection(
          aggregatorSigner,
          service
        ).connection
        const dealerConnection = getConnection(dealerSigner, service).connection

        // resources
        /** @type {Map<string, unknown[]>} */
        const queuedMessages = new Map()
        const { bufferQueue, pieceAcceptQueue, aggregateOfferQueue } =
          getQueues(queuedMessages)
        const {
          aggregator: {
            pieceStore,
            bufferStore,
            aggregateStore,
            inclusionStore,
          },
        } = getStoreImplementations()

        await test(
          {
            equal: assert.strictEqual,
            deepEqual: assert.deepStrictEqual,
            ok: assert.ok,
          },
          {
            id: aggregatorSigner,
            pieceStore,
            bufferStore,
            aggregateStore,
            inclusionStore,
            bufferQueue,
            pieceAcceptQueue,
            aggregateOfferQueue,
            dealerService: {
              connection: dealerConnection,
              invocationConfig: {
                issuer: aggregatorSigner,
                with: aggregatorSigner.did(),
                audience: dealerSigner,
              },
            },
            aggregatorService: {
              connection: aggregatorConnection,
              invocationConfig: {
                issuer: aggregatorSigner,
                with: aggregatorSigner.did(),
                audience: aggregatorSigner,
              },
            },
            queuedMessages,
            service,
            errorReporter: {
              catch(error) {
                assert.fail(error)
              },
            },
            config: {
              maxAggregateSize: 2 ** 35,
              minAggregateSize: 2 ** 34,
              minUtilizationFactor: 4,
            },
            validateAuthorization,
          }
        )
      })
    }
  })
})

/**
 * @param {Map<string, unknown[]>} queuedMessages
 */
function getQueues(queuedMessages) {
  queuedMessages.set('filecoinSubmitQueue', [])
  queuedMessages.set('pieceQueue', [])
  queuedMessages.set('bufferQueue', [])
  queuedMessages.set('pieceAcceptQueue', [])
  queuedMessages.set('aggregateOfferQueue', [])
  const pieceQueue = new Queue({
    onMessage: (message) => {
      const messages = queuedMessages.get('pieceQueue') || []
      messages.push(message)
      queuedMessages.set('pieceQueue', messages)
    },
  })
  const bufferQueue = new Queue({
    onMessage: (message) => {
      const messages = queuedMessages.get('bufferQueue') || []
      messages.push(message)
      queuedMessages.set('bufferQueue', messages)
    },
  })
  const pieceAcceptQueue = new Queue({
    onMessage: (message) => {
      const messages = queuedMessages.get('pieceAcceptQueue') || []
      messages.push(message)
      queuedMessages.set('pieceAcceptQueue', messages)
    },
  })
  const aggregateOfferQueue = new Queue({
    onMessage: (message) => {
      const messages = queuedMessages.get('aggregateOfferQueue') || []
      messages.push(message)
      queuedMessages.set('aggregateOfferQueue', messages)
    },
  })

  return {
    pieceQueue,
    bufferQueue,
    pieceAcceptQueue,
    aggregateOfferQueue,
  }
}

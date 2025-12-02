import * as assert from 'assert'
import * as Signer from '@ucanto/principal/ed25519'
import * as AggregatorCaps from '@storacha/capabilities/filecoin/aggregator'

import * as StorefrontService from '../src/test/services/storefront.js'
import * as StorefrontEvents from '../src/test/events/storefront.js'

import {
  getMockService,
  getConnection,
  getStoreImplementations,
  getQueueImplementations,
  createRouter,
  StorageNode,
  createPDPStore,
} from '../src/test/context/service.js'
import { validateAuthorization } from '../src/test/utils.js'

describe('storefront', () => {
  describe('filecoin/*', () => {
    for (const [name, test] of Object.entries(StorefrontService.test)) {
      const define = name.startsWith('only ')
        ? it.only
        : name.startsWith('skip ')
        ? it.skip
        : it

      define(name, async () => {
        const storefrontSigner = await Signer.generate()
        const aggregatorSigner = await Signer.generate()
        const dealTrackerSigner = await Signer.generate()

        // resources
        /** @type {Map<string, unknown[]>} */
        const queuedMessages = new Map()
        const {
          storefront: { filecoinSubmitQueue, pieceOfferQueue },
        } = getQueueImplementations(queuedMessages)
        const {
          storefront: { pieceStore, receiptStore, taskStore },
        } = getStoreImplementations()
        const service = getMockService()

        const aggregatorServiceConnection = getConnection(
          aggregatorSigner,
          service
        ).connection
        const aggregatorServiceProof = await AggregatorCaps.pieceOffer
          .delegate({
            issuer: aggregatorSigner,
            audience: storefrontSigner,
            with: aggregatorSigner.did(),
            expiration: Infinity,
          })

        const dealTrackerConnection = getConnection(
          dealTrackerSigner,
          service
        ).connection
        const pdpStore = createPDPStore()
        const storageProviders = [await StorageNode.activate({ pdpStore })]
        const router = createRouter(storefrontSigner, storageProviders)
        await test(
          {
            equal: assert.strictEqual,
            deepEqual: assert.deepStrictEqual,
            ok: assert.ok,
          },
          {
            id: storefrontSigner,
            aggregatorId: aggregatorSigner,
            errorReporter: {
              catch(error) {
                assert.fail(error)
              },
            },
            router,
            storageProviders,
            pieceStore,
            filecoinSubmitQueue,
            pieceOfferQueue,
            taskStore,
            receiptStore,
            aggregatorService: {
              connection: aggregatorServiceConnection,
              invocationConfig: {
                issuer: storefrontSigner,
                with: aggregatorSigner.did(),
                audience: aggregatorSigner,
                proofs: [aggregatorServiceProof],
              },
            },
            dealTrackerService: {
              connection: dealTrackerConnection,
              invocationConfig: {
                issuer: storefrontSigner,
                with: storefrontSigner.did(),
                audience: dealTrackerSigner,
              },
            },
            queuedMessages,
            validateAuthorization,
          }
        )
      })
    }
  })

  describe('events', () => {
    for (const [name, test] of Object.entries(StorefrontEvents.test)) {
      const define = name.startsWith('only ')
        ? it.only
        : name.startsWith('skip ')
        ? it.skip
        : it

      define(name, async () => {
        const storefrontSigner = await Signer.generate()
        const aggregatorSigner = await Signer.generate()
        const claimsSigner = await Signer.generate()

        // TODO: Claims service
        const service = getMockService()
        const storefrontConnection = getConnection(
          storefrontSigner,
          service
        ).connection

        const aggregatorServiceConnection = getConnection(
          aggregatorSigner,
          service
        ).connection
        const aggregatorServiceProof = await AggregatorCaps.pieceOffer
          .delegate({
            issuer: aggregatorSigner,
            audience: storefrontSigner,
            with: aggregatorSigner.did(),
            expiration: Infinity,
          })

        const claimsConnection = getConnection(claimsSigner, service).connection

        // context
        const {
          storefront: { pieceStore, taskStore, receiptStore, contentStore },
        } = getStoreImplementations()

        await test(
          {
            equal: assert.strictEqual,
            deepEqual: assert.deepStrictEqual,
            ok: assert.ok,
          },
          {
            id: storefrontSigner,
            aggregatorId: aggregatorSigner,
            pieceStore,
            receiptStore,
            taskStore,
            contentStore,
            testContentStore: contentStore,
            storefrontService: {
              connection: storefrontConnection,
              invocationConfig: {
                issuer: storefrontSigner,
                with: storefrontSigner.did(),
                audience: storefrontSigner,
              },
            },
            aggregatorService: {
              connection: aggregatorServiceConnection,
              invocationConfig: {
                issuer: storefrontSigner,
                with: aggregatorSigner.did(),
                audience: aggregatorSigner,
                proofs: [aggregatorServiceProof],
              },
            },
            claimsService: {
              connection: claimsConnection,
              invocationConfig: {
                issuer: storefrontSigner,
                with: storefrontSigner.did(),
                audience: claimsSigner,
              },
            },
            queuedMessages: new Map(),
            service,
            errorReporter: {
              catch(error) {
                assert.fail(error)
              },
            },
            validateAuthorization,
          }
        )
      })
    }
  })
})

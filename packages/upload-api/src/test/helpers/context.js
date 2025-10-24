import * as Signer from '@ucanto/principal/ed25519'
import {
  getConnection,
  getMockService,
  getStoreImplementations as getFilecoinStoreImplementations,
  getQueueImplementations as getFilecoinQueueImplementations,
} from '@storacha/filecoin-api/test/context/service'
import * as Email from '../../utils/email.js'
import { create as createRevocationChecker } from '../../utils/revocation.js'
import { createServer, connect } from '../../lib.js'
import * as Types from '../../types.js'
import * as TestTypes from '../types.js'
import { confirmConfirmationUrl } from './utils.js'
import { getServiceStorageImplementations } from '../storage/index.js'
import { getExternalServiceImplementations } from '../external-service/index.js'

/**
 * @param {object} options
 * @param {Record<string, number>} [options.providers]
 * @param {boolean} [options.requirePaymentPlan]
 * @param {import('http')} [options.http]
 * @param {{fail(error:unknown): unknown}} [options.assert]
 * @returns {Promise<Types.UcantoServerTestContext>}
 */
export const createContext = async (
  options = { requirePaymentPlan: false }
) => {
  const requirePaymentPlan = options.requirePaymentPlan
  const signer = await Signer.generate()
  const aggregatorSigner = await Signer.generate()
  const dealTrackerSigner = await Signer.generate()
  const id = signer.withDID('did:web:test.up.storacha.network')

  const service = getMockService()
  const dealTrackerConnection = getConnection(
    dealTrackerSigner,
    service
  ).connection

  const serviceStores = await getServiceStorageImplementations(options)

  /** @type {Map<string, unknown[]>} */
  const queuedMessages = new Map()
  const {
    storefront: { filecoinSubmitQueue, pieceOfferQueue },
  } = getFilecoinQueueImplementations(queuedMessages)
  const {
    storefront: { pieceStore, receiptStore, taskStore },
  } = getFilecoinStoreImplementations()
  const email = Email.debug()

  const externalServices = await getExternalServiceImplementations({
    ...options,
    serviceID: id,
  })

  /** @type { import('../../types.js').UcantoServerContext } */
  const serviceContext = {
    id,
    aggregatorId: aggregatorSigner,
    signer: id,
    email,
    requirePaymentPlan,
    url: new URL('http://localhost:8787'),
    ...serviceStores,
    ...externalServices,
    getServiceConnection: () => connection,
    ...createRevocationChecker({
      revocationsStorage: serviceStores.revocationsStorage,
    }),
    errorReporter: {
      catch(error) {
        if (options.assert) {
          options.assert.fail(error)
        } else {
          throw error
        }
      },
    },
    // Filecoin
    filecoinSubmitQueue,
    pieceOfferQueue,
    pieceStore,
    receiptStore,
    taskStore,
    dealTrackerService: {
      connection: dealTrackerConnection,
      invocationConfig: {
        issuer: signer,
        with: signer.did(),
        audience: dealTrackerSigner,
      },
    },
    // Legacy dependencies.
    // The following dependencies are legacy and will eventually be removed.
    maxUploadSize: 5_000_000_000,
  }

  const connection = connect({
    id: serviceContext.id,
    channel: createServer(serviceContext),
  })

  return {
    ...serviceContext,
    ...serviceStores,
    ...externalServices,
    mail: /** @type {TestTypes.DebugEmail} */ (serviceContext.email),
    service: /** @type {TestTypes.ServiceSigner} */ (serviceContext.id),
    connection,
    grantAccess: (mail) => confirmConfirmationUrl(connection, mail),
    fetch,
  }
}

/**
 *
 * @param {Types.UcantoServerTestContext} context
 */
export const cleanupContext = (context) =>
  Promise.all([
    context.carStoreBucket.deactivate(),
    context.blobsStorage.deactivate(),
    context.indexingService.deactivate(),
    context.claimsService.deactivate(),
    ...context.storageProviders.map((p) => p.deactivate()),
  ])

import { ok, error } from '@ucanto/core'
import { DIDResolutionError } from '@ucanto/validator'
import { IPNIService } from './ipni.js'
import * as ClaimsService from './content-claims.js'
import * as IndexingService from './indexing-service.js'
import { BrowserStorageNode, StorageNode } from './storage-node.js'
import * as BlobRetriever from './blob-retriever.js'
import * as RoutingService from '@storacha/router/test/router'

export {
  ClaimsService,
  IndexingService,
  BrowserStorageNode,
  StorageNode,
  BlobRetriever,
  RoutingService,
}

/**
 * @param {object} config
 * @param {import('@ucanto/interface').Signer} config.serviceID
 * @param {import('node:http')} [config.http]
 */
export const getExternalServiceImplementations = async (config) => {
  /** @type {import('@ucanto/interface').PrincipalResolver} */
  let principalResolver = {}
  if (config.serviceID.did().startsWith('did:web')) {
    principalResolver.resolveDIDKey = (did) =>
      did === config.serviceID.did()
        ? ok([config.serviceID.toDIDKey()])
        : error(new DIDResolutionError(did))
  }

  const claimsService = await ClaimsService.activate(config)
  const indexingService = await IndexingService.activate(config)
  const blobRetriever = BlobRetriever.create(indexingService, claimsService)
  const storageProviders = await Promise.all(
    config.http
      ? [
          StorageNode.activate({
            http: config.http,
            indexingService,
            ...principalResolver,
          }),
          StorageNode.activate({
            http: config.http,
            indexingService,
            ...principalResolver,
          }),
          StorageNode.activate({
            http: config.http,
            indexingService,
            ...principalResolver,
          }),
        ]
      : [
          BrowserStorageNode.activate({
            port: 8989,
            indexingService,
            ...principalResolver,
          }),
          BrowserStorageNode.activate({
            port: 8990,
            indexingService,
            ...principalResolver,
          }),
          BrowserStorageNode.activate({
            port: 8991,
            indexingService,
            ...principalResolver,
          }),
        ]
  )
  const router = RoutingService.create(config.serviceID, storageProviders)
  return {
    ipniService: new IPNIService(),
    claimsService,
    indexingService,
    storageProviders,
    blobRetriever,
    router,
    maxReplicas: storageProviders.length,
  }
}

import { ok, error } from '@ucanto/core'
import { DIDResolutionError } from '@ucanto/validator'
import { IPNIService } from './ipni.js'
import * as ClaimsService from './content-claims.js'
import { BrowserStorageNode, StorageNode } from './storage-node.js'
import * as BlobRetriever from './blob-retriever.js'
import * as RoutingService from './router.js'

export {
  ClaimsService,
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
        ? ok(config.serviceID.toDIDKey())
        : error(new DIDResolutionError(did))
  }

  const claimsService = await ClaimsService.activate(config)
  const blobRetriever = BlobRetriever.create(claimsService)
  const storageProviders = await Promise.all(
    config.http
      ? [
          StorageNode.activate({
            http: config.http,
            claimsService,
            ...principalResolver,
          }),
          StorageNode.activate({
            http: config.http,
            claimsService,
            ...principalResolver,
          }),
          StorageNode.activate({
            http: config.http,
            claimsService,
            ...principalResolver,
          }),
        ]
      : [
          BrowserStorageNode.activate({
            port: 8989,
            claimsService,
            ...principalResolver,
          }),
          BrowserStorageNode.activate({
            port: 8990,
            claimsService,
            ...principalResolver,
          }),
          BrowserStorageNode.activate({
            port: 8991,
            claimsService,
            ...principalResolver,
          }),
        ]
  )
  const router = RoutingService.create(config.serviceID, storageProviders)
  return {
    ipniService: new IPNIService(),
    claimsService,
    storageProviders,
    blobRetriever,
    router,
    maxReplicas: 2, // since we have 3 storage nodes, the max replicas is 2
  }
}

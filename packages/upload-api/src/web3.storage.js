import { w3sBlobAllocateProvider } from './web3.storage/blob/allocate.js'
import { w3sBlobAcceptProvider } from './web3.storage/blob/accept.js'
import * as API from './types.js'

/**
 * @deprecated
 * @param {API.LegacyBlobServiceContext} context
 */
export const createService = (context) => ({
  blob: {
    allocate: w3sBlobAllocateProvider(context),
    accept: w3sBlobAcceptProvider(context),
  },
})

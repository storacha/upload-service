import { blobAddProvider } from './blob/add.js'
import { blobListProvider } from './blob/list.js'
import { blobRemoveProvider } from './blob/remove.js'
import { blobReplicateProvider } from './blob/replicate.js'
import { blobGetProvider } from './blob/get.js'
import * as API from './types.js'

export {
  BlobNotFound,
  EntryExists,
  EntryNotFound,
  BlobSizeLimitExceededError,
  AllocatedMemoryNotWrittenError,
} from './blob/lib.js'

/**
 * @param {API.BlobServiceContext & API.LegacyBlobServiceContext} context
 */
export function createService(context) {
  return {
    add: blobAddProvider(context),
    list: blobListProvider(context),
    remove: blobRemoveProvider(context),
    replicate: blobReplicateProvider(context),
    get: {
      0: {
        1: blobGetProvider(context),
      },
    },
  }
}

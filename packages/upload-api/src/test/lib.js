import * as AccessAuthorize from './handlers/access/authorize.js'
import * as AccessClaim from './handlers/access/claim.js'
import * as AccessDelegate from './handlers/access/delegate.js'
import * as AdminUploadInspect from './handlers/admin/upload/inspect.js'
import * as RateLimitAdd from './handlers/rate-limit/add.js'
import * as RateLimitList from './handlers/rate-limit/list.js'
import * as RateLimitRemove from './handlers/rate-limit/remove.js'
import * as BlobAdd from './handlers/space/blob/add.js'
import * as BlobList from './handlers/space/blob/list.js'
import * as BlobRemove from './handlers/space/blob/remove.js'
import * as BlobReplicate from './handlers/space/blob/replicate.js'
import * as Ucan from './handlers/ucan.js'
import * as Subscription from './handlers/subscription.js'
import * as Upload from './handlers/upload.js'
import * as Plan from './handlers/plan.js'
import * as Usage from './handlers/usage.js'
import * as Index from './handlers/index.js'
import { test as blobRegistryTests } from './storage/blob-registry-tests.js'
import { test as agentStoreTests } from './storage/agent-store-tests.js'
import { test as delegationsStorageTests } from './storage/delegations-storage-tests.js'
import { test as provisionsStorageTests } from './storage/provisions-storage-tests.js'
import { test as rateLimitsStorageTests } from './storage/rate-limits-storage-tests.js'
import { test as replicaStorageTests } from './storage/replica-storage-tests.js'
import { test as revocationsStorageTests } from './storage/revocations-storage-tests.js'
import { test as plansStorageTests } from './storage/plans-storage-tests.js'
import { DebugEmail } from '../utils/email.js'
export * as Context from './helpers/context.js'

export * from './util.js'

const Blob = {
  test: {
    ...BlobAdd.test,
    ...BlobList.test,
    ...BlobRemove.test,
    ...BlobReplicate.test,
  },
}

export const test = {
  ...Blob.test,
  ...Index.test,
  ...Upload.test,
  ...Ucan.test,
}

export const storageTests = {
  ...delegationsStorageTests,
  ...provisionsStorageTests,
  ...rateLimitsStorageTests,
  ...replicaStorageTests,
  ...revocationsStorageTests,
  ...plansStorageTests,
  ...blobRegistryTests,
  ...agentStoreTests,
}

export const handlerTests = {
  ...AccessAuthorize,
  ...AccessClaim,
  ...AccessDelegate,
  ...AdminUploadInspect,
  ...RateLimitAdd,
  ...RateLimitList,
  ...RateLimitRemove,
  ...Blob.test,
  ...Index.test,
  ...Ucan.test,
  ...Subscription.test,
  ...Upload.test,
  ...Plan.test,
  ...Usage.test,
}

export {
  Upload,
  Blob,
  Index,
  Ucan,
  delegationsStorageTests,
  provisionsStorageTests,
  rateLimitsStorageTests,
  replicaStorageTests,
  revocationsStorageTests,
  plansStorageTests,
  blobRegistryTests,
  agentStoreTests,
  DebugEmail,
}

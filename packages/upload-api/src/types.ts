import type {
  Failure,
  ServiceMethod,
  UCANLink,
  Link,
  HandlerExecutionError,
  Signer,
  DID,
  DIDKey,
  InboundCodec,
  Result,
  CapabilityParser,
  Match,
  ParsedCapability,
  InferInvokedCapability,
  RevocationChecker,
  ToString,
  UnknownLink,
  MultihashDigest,
  Unit,
  AgentMessage,
  Invocation,
  Receipt,
  AgentMessageModel,
  UCAN,
  Capability,
  ReceiptModel,
  Variant,
  HTTPRequest,
  HTTPResponse,
  PrincipalResolver,
  AuthorityProver,
  Reader,
} from '@ucanto/interface'
import type { ProviderInput, ConnectionView } from '@ucanto/server'
import { Await } from '@ucanto/server'

import { StorefrontService } from '@storacha/filecoin-api/types'
import { ServiceContext as FilecoinServiceContext } from '@storacha/filecoin-api/storefront/api'
import * as LegacyUploadAPI from '@web3-storage/upload-api'
import { DelegationsStorage as Delegations } from './types/delegations.js'
import { ProvisionsStorage as Provisions } from './types/provisions.js'
import { RateLimitsStorage as RateLimits } from './types/rate-limits.js'
import * as AccessCapabilities from '@storacha/capabilities/access'

export type ValidationEmailSend = {
  to: string
  url: string
}

export type SpaceDID = DIDKey
export type ServiceDID = DID<'web'>
export type ServiceSigner = Signer<ServiceDID>
export interface SpaceProviderRegistry {
  hasStorageProvider(space: SpaceDID): Promise<Result<boolean, never>>
}

export interface InsufficientStorage extends Failure {
  name: 'InsufficientStorage'
}

export type AllocationError = InsufficientStorage

export interface Email {
  sendValidation: (input: { to: string; url: string }) => Promise<void>
}

export interface DebugEmail extends Email {
  emails: Array<ValidationEmailSend>
  take: () => Promise<ValidationEmailSend>
}

export interface SSOFact {
  authProvider: string
  externalUserId: string
  externalSessionToken: string
}

/**
 * SSO auth parameters that are used to authorize an user based on a SSO auth provider.
 */
export interface SSOAuthParams {
  /**
   * The SSO auth provider.
   */
  authProvider: string
  /**
   * The email of the user that is requesting access.
   */
  email: string
  /**
   * The external user ID of the user that is requesting access.
   */
  externalUserId: string
  /**
   * The external session token of the user that is requesting access.
   */
  externalSessionToken: string

  /**
   * The Access.authorize invocation that triggered the SSO authorization flow.
   */
  invocation: Input<typeof AccessCapabilities.authorize>['invocation']
}

export interface SSOAuthResponse {
  userData: {
    id: string
    email: string
    accountStatus: string
  }
}

/**
 * SSO service can authorize an user based on a SSO auth provider specified in the SSOAuthParams.authProvider.
 */
export interface SSOService {
  /**
   * Authorize access to and user based on a SSO auth provider specified in the SSOAuthParams.authProvider.
   *
   * @param {Input<typeof AccessCapabilities.authorize>} input - The input of the authorization invocation.
   * @param {SSOAuthParams} ssoAuthParams - The SSO auth request that contains the SSO auth provider and the user email.
   * @returns {Await<Result<InvocationLink, Error>>} - The link to the Access/confirm invocation which confirms that authorization request is valid and authorized.
   */
  authorize: (
    ssoAuthParams: SSOAuthParams
  ) => Await<Result<InvocationLink, Error>>
}

/**
 * SSO provider can validate a SSO auth request.
 */
export interface SSOProvider {
  /**
   * The name of the SSO provider.
   */
  name: string
  /**
   * Validate a SSO auth request.
   */
  validate: (
    ssoAuthParams: SSOAuthParams
  ) => Await<Result<SSOAuthResponse, Error>>
}

import {
  SpaceBlobAdd,
  SpaceBlobAddSuccess,
  SpaceBlobAddFailure,
  SpaceBlobList,
  SpaceBlobListSuccess,
  SpaceBlobListFailure,
  SpaceBlobRemove,
  SpaceBlobRemoveSuccess,
  SpaceBlobRemoveFailure,
  SpaceBlobGet,
  SpaceBlobGetSuccess,
  SpaceBlobGetFailure,
  UploadAdd,
  UploadGet,
  UploadAddSuccess,
  UploadRemove,
  UploadRemoveSuccess,
  UploadList,
  UploadListSuccess,
  UploadListItem,
  AccessAuthorize,
  AccessAuthorizeSuccess,
  AccessDelegate,
  AccessDelegateFailure,
  AccessDelegateSuccess,
  AccessClaim,
  AccessClaimSuccess,
  AccessClaimFailure,
  AccessConfirm,
  AccessConfirmSuccess,
  AccessConfirmFailure,
  ConsumerHas,
  ConsumerHasSuccess,
  ConsumerHasFailure,
  ConsumerGet,
  ConsumerGetSuccess,
  ConsumerGetFailure,
  CustomerGet,
  CustomerGetSuccess,
  CustomerGetFailure,
  SubscriptionGet,
  SubscriptionGetSuccess,
  SubscriptionGetFailure,
  SubscriptionList,
  SubscriptionListSuccess,
  SubscriptionListFailure,
  RateLimitAdd,
  RateLimitAddSuccess,
  RateLimitAddFailure,
  RateLimitRemove,
  RateLimitRemoveSuccess,
  RateLimitRemoveFailure,
  RateLimitList,
  RateLimitListSuccess,
  RateLimitListFailure,
  AdminUploadInspect,
  AdminUploadInspectSuccess,
  AdminUploadInspectFailure,
  ProviderAdd,
  ProviderAddSuccess,
  ProviderAddFailure,
  SpaceInfo,
  ProviderDID,
  UploadGetSuccess,
  UploadGetFailure,
  ListResponse,
  CARLink,
  UCANConclude,
  UCANConcludeSuccess,
  UCANConcludeFailure,
  UCANRevoke,
  UCANRevokeSuccess,
  UCANRevokeFailure,
  PlanGet,
  PlanGetSuccess,
  PlanGetFailure,
  AccessAuthorizeFailure,
  UsageReportSuccess,
  UsageReportFailure,
  UsageReport,
  PlanSetSuccess,
  PlanSetFailure,
  PlanSet,
  PlanCreateAdminSession,
  PlanCreateAdminSessionSuccess,
  PlanCreateAdminSessionFailure,
  PlanCreateCheckoutSession,
  PlanCreateCheckoutSessionSuccess,
  PlanCreateCheckoutSessionFailure,
  SpaceIndexAdd,
  SpaceIndexAddSuccess,
  SpaceIndexAddFailure,
  SpaceBlobReplicate,
  SpaceBlobReplicateSuccess,
  SpaceBlobReplicateFailure,
  AccountUsageGet,
  AccountUsageGetFailure,
  AccountUsageGetSuccess,
} from '@storacha/capabilities/types'
import * as Capabilities from '@storacha/capabilities'
import { RevocationsStorage } from './types/revocations.js'

export * from '@storacha/capabilities/types'
export * from '@ucanto/interface'

export type {
  ProvisionsStorage,
  Provision,
  Subscription,
} from './types/provisions.js'
export type {
  DelegationsStorage,
  Query as DelegationsStorageQuery,
} from './types/delegations.js'
export type {
  Revocation,
  RevocationQuery,
  MatchingRevocations,
  RevocationsStorage,
} from './types/revocations.js'
export type { RateLimitsStorage, RateLimit } from './types/rate-limits.js'
import { PlansStorage } from './types/plans.js'
export type {
  PlansStorage,
  PlanCreateCheckoutSessionOptions,
  PlanID,
} from './types/plans.js'
import { SubscriptionsStorage } from './types/subscriptions.js'
export type { SubscriptionsStorage }
import { UsageStorage } from './types/usage.js'
export type { UsageStorage }
import { StorageGetError } from './types/storage.js'
import {
  Registry as BlobRegistry,
  ReplicaStorage,
  RoutingService,
} from './types/blob.js'
export type * as BlobAPI from './types/blob.js'
import { IPNIService, IndexServiceContext } from './types/index.js'
import { Claim } from '@web3-storage/content-claims/client/api'
export type {
  IndexServiceContext,
  IPNIService,
  BlobRetriever,
  BlobNotFound,
  ShardedDAGIndex,
} from './types/index.js'
import * as IndexingServiceAPI from './types/indexing-service.js'
export type { IndexingServiceAPI }
export type {
  ClaimsInvocationConfig,
  ClaimsClientConfig,
  ClaimsClientContext,
  ClaimsService,
} from '@web3-storage/upload-api'

/** @deprecated */
export type W3sBlobAllocate = LegacyUploadAPI.BlobAllocate
/** @deprecated */
export type W3sBlobAllocateSuccess = LegacyUploadAPI.BlobAllocateSuccess
/** @deprecated */
export type W3sBlobAllocateFailure = LegacyUploadAPI.BlobAllocateFailure
/** @deprecated */
export type W3sBlobAccept = LegacyUploadAPI.BlobAccept
/** @deprecated */
export type W3sBlobAcceptSuccess = LegacyUploadAPI.BlobAcceptSuccess
/** @deprecated */
export type W3sBlobAcceptFailure = LegacyUploadAPI.BlobAcceptFailure

export interface Service extends StorefrontService {
  upload: {
    add: ServiceMethod<UploadAdd, UploadAddSuccess, Failure>
    get: ServiceMethod<UploadGet, UploadGetSuccess, UploadGetFailure>
    remove: ServiceMethod<UploadRemove, UploadRemoveSuccess, Failure>
    list: ServiceMethod<UploadList, UploadListSuccess, Failure>
  }
  console: {
    log: ServiceMethod<
      InferInvokedCapability<typeof Capabilities.Console.log>,
      Unit,
      never
    >
    error: ServiceMethod<
      InferInvokedCapability<typeof Capabilities.Console.error>,
      never,
      Failure & { cause: unknown }
    >
  }
  access: {
    authorize: ServiceMethod<
      AccessAuthorize,
      AccessAuthorizeSuccess,
      AccessAuthorizeFailure
    >
    claim: ServiceMethod<AccessClaim, AccessClaimSuccess, AccessClaimFailure>
    confirm: ServiceMethod<
      AccessConfirm,
      AccessConfirmSuccess,
      AccessConfirmFailure
    >
    delegate: ServiceMethod<
      AccessDelegate,
      AccessDelegateSuccess,
      AccessDelegateFailure
    >
  }
  consumer: {
    has: ServiceMethod<ConsumerHas, ConsumerHasSuccess, ConsumerHasFailure>
    get: ServiceMethod<ConsumerGet, ConsumerGetSuccess, ConsumerGetFailure>
  }
  customer: {
    get: ServiceMethod<CustomerGet, CustomerGetSuccess, CustomerGetFailure>
  }
  subscription: {
    get: ServiceMethod<
      SubscriptionGet,
      SubscriptionGetSuccess,
      SubscriptionGetFailure
    >
    list: ServiceMethod<
      SubscriptionList,
      SubscriptionListSuccess,
      SubscriptionListFailure
    >
  }
  'rate-limit': {
    add: ServiceMethod<RateLimitAdd, RateLimitAddSuccess, RateLimitAddFailure>
    remove: ServiceMethod<
      RateLimitRemove,
      RateLimitRemoveSuccess,
      RateLimitRemoveFailure
    >
    list: ServiceMethod<
      RateLimitList,
      RateLimitListSuccess,
      RateLimitListFailure
    >
  }
  ucan: {
    conclude: ServiceMethod<
      UCANConclude,
      UCANConcludeSuccess,
      UCANConcludeFailure
    >
    revoke: ServiceMethod<UCANRevoke, UCANRevokeSuccess, UCANRevokeFailure>
  }
  admin: {
    store: LegacyUploadAPI.Service['admin']['store']
    upload: {
      inspect: ServiceMethod<
        AdminUploadInspect,
        AdminUploadInspectSuccess,
        AdminUploadInspectFailure
      >
    }
  }
  provider: {
    add: ServiceMethod<ProviderAdd, ProviderAddSuccess, ProviderAddFailure>
  }
  space: {
    info: ServiceMethod<SpaceInfo, SpaceInfoSuccess, SpaceInfoFailure>
    index: {
      add: ServiceMethod<
        SpaceIndexAdd,
        SpaceIndexAddSuccess,
        SpaceIndexAddFailure
      >
    }
    blob: {
      add: ServiceMethod<SpaceBlobAdd, SpaceBlobAddSuccess, SpaceBlobAddFailure>
      remove: ServiceMethod<
        SpaceBlobRemove,
        SpaceBlobRemoveSuccess,
        SpaceBlobRemoveFailure
      >
      replicate: ServiceMethod<
        SpaceBlobReplicate,
        SpaceBlobReplicateSuccess,
        SpaceBlobReplicateFailure
      >
      list: ServiceMethod<
        SpaceBlobList,
        SpaceBlobListSuccess,
        SpaceBlobListFailure
      >
      get: {
        0: {
          1: ServiceMethod<
            SpaceBlobGet,
            SpaceBlobGetSuccess,
            SpaceBlobGetFailure
          >
        }
      }
    }
  }
  plan: {
    get: ServiceMethod<PlanGet, PlanGetSuccess, PlanGetFailure>
    set: ServiceMethod<PlanSet, PlanSetSuccess, PlanSetFailure>
    'create-admin-session': ServiceMethod<
      PlanCreateAdminSession,
      PlanCreateAdminSessionSuccess,
      PlanCreateAdminSessionFailure
    >
    'create-checkout-session': ServiceMethod<
      PlanCreateCheckoutSession,
      PlanCreateCheckoutSessionSuccess,
      PlanCreateCheckoutSessionFailure
    >
  }
  usage: {
    report: ServiceMethod<UsageReport, UsageReportSuccess, UsageReportFailure>
  }
  account: {
    usage: {
      get: ServiceMethod<
        AccountUsageGet,
        AccountUsageGetSuccess,
        AccountUsageGetFailure
      >
    }
  }
  // legacy handlers
  store: LegacyUploadAPI.Service['store']
  ['web3.storage']: {
    blob: {
      allocate: ServiceMethod<
        W3sBlobAllocate,
        W3sBlobAllocateSuccess,
        W3sBlobAllocateFailure
      >
      accept: ServiceMethod<
        W3sBlobAccept,
        W3sBlobAcceptSuccess,
        W3sBlobAcceptFailure
      >
    }
  }
}

/** @deprecated */
export type LegacyStoreServiceContext = LegacyUploadAPI.StoreServiceContext

/** @deprecated */
export interface LegacyCarStoreBucket extends LegacyUploadAPI.CarStoreBucket {}

/** @deprecated */
export interface LegacyCarStoreBucketOptions
  extends LegacyUploadAPI.CarStoreBucketOptions {}

/** @deprecated */
export interface LegacyStoreTable extends LegacyUploadAPI.StoreTable {}

/** @deprecated */
export interface LegacyStoreAddInput extends LegacyUploadAPI.StoreAddInput {}

/** @deprecated */
export type LegacyBlobServiceContext = Omit<
  LegacyUploadAPI.BlobServiceContext,
  'allocationsStorage' | 'getServiceConnection'
> & {
  registry: BlobRegistry
  getServiceConnection: () => ConnectionView<Service>
}

/** @deprecated */
export interface LegacyBlobsStorage extends LegacyUploadAPI.BlobsStorage {}

export type BlobServiceContext = SpaceServiceContext & {
  /**
   * Service signer
   */
  id: Signer
  agentStore: AgentStore
  router: RoutingService
  registry: BlobRegistry
  replicaStore: ReplicaStorage
  /**
   * The maximum number of replicas that can be allocated for a given blob. It
   * includes the original blob that was uploaded, so only values above 1 will
   * allow users to have multiple copies of their data.
   */
  maxReplicas: number
}

export type UploadServiceContext = ConsumerServiceContext &
  SpaceServiceContext &
  RevocationServiceContext &
  ConcludeServiceContext & {
    signer: Signer
    uploadTable: UploadTable
  }

export interface AccessClaimContext {
  signer: Signer
  delegationsStorage: Delegations
}

export interface AccessServiceContext extends AccessClaimContext, AgentContext {
  email: Email
  url: URL
  provisionsStorage: Provisions
  subscriptionsStorage: SubscriptionsStorage
  usageStorage: UsageStorage
  rateLimitsStorage: RateLimits
  ssoService?: SSOService
}

export interface ConsumerServiceContext {
  signer: Signer
  provisionsStorage: Provisions
}

export interface CustomerServiceContext {
  signer: Signer
  provisionsStorage: Provisions
}

export interface AdminServiceContext {
  signer: Signer
  uploadTable: UploadTable
}

/** @deprecated */
export interface LegacyAdminServiceContext
  extends Pick<LegacyUploadAPI.AdminServiceContext, 'storeTable'> {}

/** @deprecated */
export type LegacyAdminStoreInspectResult =
  LegacyUploadAPI.AdminStoreInspectResult

/** @deprecated */
export type LegacyAdminStoreInspectSuccess =
  LegacyUploadAPI.AdminStoreInspectSuccess

/** @deprecated */
export type LegacyAdminStoreInspectFailure =
  LegacyUploadAPI.AdminStoreInspectFailure

export interface ConsoleServiceContext {}

export interface SpaceServiceContext extends AgentContext {
  provisionsStorage: Provisions
  usageStorage: UsageStorage
  subscriptionsStorage: SubscriptionsStorage
  delegationsStorage: Delegations
  rateLimitsStorage: RateLimits
}

export interface ProviderServiceContext {
  provisionsStorage: Provisions
  rateLimitsStorage: RateLimits
  plansStorage: PlansStorage
  requirePaymentPlan?: boolean
}

export interface SubscriptionServiceContext {
  signer: Signer
  provisionsStorage: Provisions
  subscriptionsStorage: SubscriptionsStorage
}

export interface RateLimitServiceContext {
  rateLimitsStorage: RateLimits
}

export interface RevocationServiceContext {
  revocationsStorage: RevocationsStorage
}

/** @deprecated */
export interface LegacyConcludeServiceContext
  extends Pick<LegacyUploadAPI.ConcludeServiceContext, 'id'> {
  registry: BlobRegistry
  getServiceConnection: () => ConnectionView<Service>
}

export interface ConcludeServiceContext {
  /** Upload service signer. */
  id: Signer
  /**
   * Store for invocations & receipts.
   */
  agentStore: AgentStore
  registry: BlobRegistry
  router: RoutingService
  replicaStore: ReplicaStorage
}

export interface UcanServiceContext
  extends RevocationServiceContext,
    ConcludeServiceContext {}

/** @deprecated */
export interface LegacyUcanServiceContext
  extends LegacyConcludeServiceContext {}

export interface PlanServiceContext {
  plansStorage: PlansStorage
}

export interface UsageServiceContext {
  provisionsStorage: Provisions
  usageStorage: UsageStorage
}

export interface AccountUsageServiceContext {
  provisionsStorage: Provisions
  usageStorage: UsageStorage
  subscriptionsStorage: SubscriptionsStorage
}

export interface ServiceContext
  extends AdminServiceContext,
    LegacyAdminServiceContext,
    AgentContext,
    AccessServiceContext,
    ConsoleServiceContext,
    ConsumerServiceContext,
    CustomerServiceContext,
    ProviderServiceContext,
    SpaceServiceContext,
    BlobServiceContext,
    LegacyBlobServiceContext,
    SubscriptionServiceContext,
    RateLimitServiceContext,
    UcanServiceContext,
    LegacyUcanServiceContext,
    PlanServiceContext,
    UploadServiceContext,
    FilecoinServiceContext,
    IndexServiceContext,
    UsageServiceContext,
    LegacyStoreServiceContext {}

export interface UcantoServerContext
  extends ServiceContext,
    RevocationChecker,
    PrincipalResolver,
    Partial<AuthorityProver> {
  id: Signer
  audience?: Reader<DID>
  codec?: InboundCodec
  errorReporter: ErrorReporter
}

export interface AgentContext {
  agentStore: AgentStore
}

/**
 * An agent store used for storing ucanto {@link AgentMessage}s and
 * {@link Invocation} and {@link Receipt} lookups.
 */
export interface AgentStore {
  messages: Writer<ParsedAgentMessage>
  invocations: Accessor<UnknownLink, Invocation>
  receipts: Accessor<UnknownLink, Receipt>
}

export type TaskLink = Link

export type InvocationLink = Link<UCAN.UCAN<[Capability]>>
export type ReceiptLink = Link<ReceiptModel>
export type AgentMessageLink = Link<AgentMessageModel<unknown>>

export interface ParsedAgentMessage {
  source: HTTPRequest | HTTPResponse
  data: AgentMessage
  index: Iterable<AgentMessageIndexRecord>
}

export interface InvocationSource {
  task: TaskLink
  invocation: Invocation
  message: AgentMessageLink
}

export interface ReceiptSource {
  task: TaskLink
  receipt: Receipt
  message: AgentMessageLink
}

export type AgentMessageIndexRecord = Variant<{
  invocation: InvocationSource
  receipt: ReceiptSource
}>

/**
 * Read interface for the key value store.
 */
export interface Accessor<Key, Value> {
  get(key: Key): Promise<Result<Value, StorageGetError>>
}

/**
 * Write interface of some values.
 */
export interface Writer<Value> {
  write(value: Value): Promise<Result<Unit, WriteError<Value>>>
}

export interface NotFoundError {
  name: 'NotFoundError'
  key: unknown
}

export interface WriteError<Payload = unknown> extends Failure {
  name: 'WriteError'

  /**
   * Payload writing which caused an error.
   */
  payload: Payload
  /**
   * Destination writing into which caused an error.
   */
  writer: Writer<Payload>
}

export interface UcantoServerTestContext
  extends UcantoServerContext,
    StoreTestContext,
    BlobServiceContext,
    UploadTestContext {
  connection: ConnectionView<Service>
  mail: DebugEmail
  service: Signer<ServiceDID>
  fetch: typeof fetch

  grantAccess: (mail: { url: string | URL }) => Promise<void>

  ipniService: IPNIService & {
    query(digest: MultihashDigest): Promise<Result<Unit, RecordNotFound>>
  }

  carStoreBucket: LegacyCarStoreBucket & Deactivator
  blobsStorage: LegacyBlobsStorage & Deactivator
  claimsService: LegacyUploadAPI.ClaimsClientConfig & ClaimReader & Deactivator
  indexingService: IndexingServiceAPI.ClientConfig &
    IndexingServiceAPI.Client &
    Deactivator
  storageProviders: Array<{ id: Signer } & Deactivator>
}

export interface ClaimReader {
  read(digest: MultihashDigest): Promise<Result<Claim[], Failure>>
}

export interface Deactivator {
  deactivate: () => Promise<void>
}

export interface StoreTestContext {}

export interface UploadTestContext {}

export interface ErrorReporter {
  catch: (error: HandlerExecutionError | WriteError) => void
}

/**
 * Indicates the requested record was not present in the table.
 */
export interface RecordNotFound extends Failure {
  name: 'RecordNotFound'
}

/**
 * Indicates the inserted record key conflicts with an existing key of a record
 * that already exists in the table.
 */
export interface RecordKeyConflict extends Failure {
  name: 'RecordKeyConflict'
}

export interface UploadTable {
  inspect: (link: UnknownLink) => Promise<Result<UploadInspectSuccess, Failure>>
  exists: (space: DID, root: UnknownLink) => Promise<Result<boolean, Failure>>
  get: (
    space: DID,
    link: UnknownLink
  ) => Promise<Result<UploadGetSuccess, RecordNotFound>>
  /**
   * Inserts an item in the table if it does not already exist or updates an
   * existing item if it does exist.
   */
  upsert: (item: UploadAddInput) => Promise<Result<UploadAddSuccess, Failure>>
  /** Removes an item from the table but fails if the item does not exist. */
  remove: (
    space: DID,
    root: UnknownLink
  ) => Promise<Result<UploadRemoveSuccess, RecordNotFound>>
  list: (
    space: DID,
    options?: ListOptions
  ) => Promise<Result<ListResponse<UploadListItem>, Failure>>
}

export type SpaceInfoSuccess = {
  did: SpaceDID
  providers: ProviderDID[]
}
export type SpaceInfoFailure = Failure | SpaceUnknown

export interface UnknownProvider extends Failure {
  name: 'UnknownProvider'
}
export type CustomerGetResult = Result<CustomerGetSuccess, CustomerGetFailure>
export type SubscriptionGetResult = Result<
  SubscriptionGetSuccess,
  SubscriptionGetFailure
>
export type AdminUploadInspectResult = Result<
  AdminUploadInspectSuccess,
  AdminUploadInspectFailure
>

export interface UploadAddInput {
  space: DID
  root: UnknownLink
  shards?: CARLink[]
  issuer: DID
  cause: UCANLink
}

export interface UploadInspectSuccess {
  spaces: Array<{ did: DID; insertedAt: string }>
}

export interface ListOptions {
  size?: number
  cursor?: string
  pre?: boolean
}

export interface TestSpaceRegistry {
  /**
   * Registers space with the registry.
   */
  registerSpace: (space: DID) => Promise<void>
}

export interface LinkJSON<T extends UnknownLink = UnknownLink> {
  '/': ToString<T>
}
export interface SpaceUnknown extends Failure {
  name: 'SpaceUnknown'
}

export type Input<C extends CapabilityParser<Match<ParsedCapability>>> =
  ProviderInput<InferInvokedCapability<C> & ParsedCapability>

export interface Assert {
  equal: <Actual, Expected extends Actual>(
    actual: Actual,
    expected: Expected,
    message?: string
  ) => unknown
  deepEqual: <Actual, Expected extends Actual>(
    actual: Actual,
    expected: Expected,
    message?: string
  ) => unknown
  ok: <Actual>(actual: Actual, message?: string) => unknown
}

export type Test<C = UcantoServerTestContext> = (
  assert: Assert,
  context: C
) => unknown
export type Tests = Record<string, Test>

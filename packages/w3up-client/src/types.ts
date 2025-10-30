import type { Driver } from '@storacha/access/drivers/types'
import type {
  AccessDelegate,
  AccessDelegateFailure,
  AccessDelegateSuccess,
  Service as AccessService,
  AgentDataExport,
} from '@storacha/access/types'
import type { Service as UploadService } from '@storacha/upload-client/types'
import type {
  ConnectionView,
  Signer,
  DID,
  Ability,
  Resource,
  Unit,
  ServiceMethod,
} from '@ucanto/interface'
import type { Client } from './client.js'
import type { StorefrontService } from '@storacha/filecoin-client/storefront'
export * from '@ucanto/interface'
export * from '@storacha/did-mailto'
export { AppName } from '@storacha/access/types'
export type { SSORequestParams } from '@storacha/access/types'
export type { Agent, CapabilityQuery } from '@storacha/access/agent'
export type {
  Access,
  AccountDID,
  ProviderDID,
  SpaceDID,
  OwnedSpace,
  SharedSpace,
} from '@storacha/access/types'

export type ProofQuery = Record<Resource, Record<Ability, Unit>>

export type Service = AccessService & UploadService & StorefrontService

export interface ServiceConf {
  access: ConnectionView<AccessService>
  upload: ConnectionView<UploadService>
  filecoin: ConnectionView<StorefrontService>
  gateway: ConnectionView<ContentServeService>
}

export interface ServiceConfOptions {
  access:
    | ConnectionView<AccessService>
    | { id?: import('./types.js').Principal<DID>; url: URL }
  upload:
    | ConnectionView<UploadService>
    | { id?: import('./types.js').Principal<DID>; url: URL }
  filecoin:
    | ConnectionView<StorefrontService>
    | { id?: import('./types.js').Principal<DID>; url: URL }
  gateway:
    | ConnectionView<ContentServeService>
    | { id?: import('./types.js').Principal<DID>; url: URL }
}
export interface ContentServeService {
  access: {
    delegate: ServiceMethod<
      AccessDelegate,
      AccessDelegateSuccess,
      AccessDelegateFailure
    >
  }
}
export interface ClientFactoryOptions {
  /**
   * A storage driver that persists exported agent data.
   */
  store?: Driver<AgentDataExport>
  /**
   * Service DID and URL configuration.
   */
  serviceConf?: Partial<ServiceConfOptions>
  /**
   * Use this principal to sign UCANs. Note: if the store is non-empty and the
   * principal saved in the store is not the same principal as the one passed
   * here an error will be thrown.
   */
  principal?: Signer<DID<'key'>>
  /**
   * URL configuration of endpoint where receipts from UCAN Log can be read from.
   */
  receiptsEndpoint?: URL
}

export type ClientFactory = (options?: ClientFactoryOptions) => Promise<Client>

export { Client } from './client.js'

export type { UnknownLink } from 'multiformats'

export type {
  DID,
  Principal,
  Delegation,
  Ability,
  Capability,
  Capabilities,
  UCANOptions,
  UCANBlock,
  Block,
  ConnectionView,
} from '@ucanto/interface'

export type {
  Abilities,
  ServiceAbility,
  SpaceBlobAdd,
  SpaceBlobList,
  SpaceBlobRemove,
  StoreAdd,
  StoreList,
  StoreRemove,
  UploadAdd,
  UploadList,
  UploadRemove,
  PlanGet,
  PlanGetSuccess,
  PlanGetFailure,
  PlanSet,
  PlanSetSuccess,
  PlanSetFailure,
  PlanCreateAdminSession,
  PlanCreateAdminSessionSuccess,
  PlanCreateAdminSessionFailure,
  FilecoinOffer,
  FilecoinOfferSuccess,
  FilecoinOfferFailure,
  FilecoinSubmit,
  FilecoinSubmitSuccess,
  FilecoinSubmitFailure,
  FilecoinAccept,
  FilecoinAcceptSuccess,
  FilecoinAcceptFailure,
  FilecoinInfo,
  FilecoinInfoSuccess,
  FilecoinInfoFailure,
  UCANAttest,
  AccountUsageGet,
  AccountUsageGetSuccess,
  AccountUsageGetFailure,
} from '@storacha/capabilities/types'

export type {
  AgentDataModel,
  AgentDataExport,
  AgentMeta,
  DelegationMeta,
} from '@storacha/access/types'

export type {
  SpaceBlobAddSuccess,
  SpaceBlobAddFailure,
  SpaceBlobListSuccess,
  SpaceBlobListFailure,
  SpaceBlobRemoveSuccess,
  SpaceBlobRemoveFailure,
  SpaceIndexAddSuccess,
  SpaceIndexAddFailure,
  UploadAddSuccess,
  UploadGetSuccess,
  UploadGetFailure,
  UploadRemoveSuccess,
  UploadListSuccess,
  UploadListItem,
  UsageReportSuccess,
  UsageReportFailure,
  EgressData,
  EgressRecord,
  EgressRecordSuccess,
  EgressRecordFailure,
  ListResponse,
  AnyLink,
  CARLink,
  CARFile,
  CARMetadata,
  Retryable,
  Abortable,
  Connectable,
  Pageable,
  RequestOptions,
  ListRequestOptions,
  ShardingOptions,
  ShardStoringOptions,
  UploadOptions,
  UploadFileOptions,
  UploadDirectoryOptions,
  FileLike,
  BlobLike,
  ProgressStatus,
  ReceiptGetOptions,
} from '@storacha/upload-client/types'

export type { UTCUnixTimestamp } from '@ipld/dag-ucan'

import type {
  FetchOptions as IpfsUtilsFetchOptions,
  ProgressStatus as XHRProgressStatus,
} from 'ipfs-utils/src/types.js'
import { Link, UnknownLink, Version, MultihashHasher } from 'multiformats'
import { Block, EncoderSettings } from '@ipld/unixfs'
import {
  ServiceMethod,
  ConnectionView,
  Signer,
  Proof,
  DID,
  Principal,
  Failure,
  Delegation,
  Await,
  Connection,
} from '@ucanto/interface'
import {
  UCANConclude,
  UCANConcludeSuccess,
  UCANConcludeFailure,
  BlobModel,
  SpaceBlobAdd,
  SpaceBlobAddSuccess,
  SpaceBlobAddFailure,
  BlobAllocate,
  BlobAllocateSuccess,
  BlobAllocateFailure,
  BlobAccept,
  BlobAcceptSuccess,
  BlobAcceptFailure,
  SpaceBlobRemove,
  SpaceBlobRemoveSuccess,
  SpaceBlobRemoveFailure,
  SpaceBlobList,
  SpaceBlobListSuccess,
  SpaceBlobListFailure,
  SpaceBlobGet,
  SpaceBlobGetSuccess,
  SpaceBlobGetFailure,
  SpaceBlobReplicate,
  SpaceBlobReplicateSuccess,
  SpaceBlobReplicateFailure,
  SpaceIndexAdd,
  SpaceIndexAddSuccess,
  SpaceIndexAddFailure,
  UploadAdd,
  UploadAddSuccess,
  UploadList,
  UploadListSuccess,
  UploadListItem,
  UploadRemove,
  UploadRemoveSuccess,
  ListResponse,
  CARLink,
  PieceLink,
  UploadGet,
  UploadGetSuccess,
  UploadGetFailure,
  UsageReport,
  UsageReportSuccess,
  UsageReportFailure,
  EgressData,
  EgressRecord,
  EgressRecordSuccess,
  EgressRecordFailure,
  ServiceAbility,
  ShardLink,
} from '@storacha/capabilities/types'
import { StorefrontService } from '@storacha/filecoin-client/storefront'
import { code as pieceHashCode } from '@web3-storage/data-segment/multihash'
import {
  ShardedDAGIndex,
  ShardDigest,
  SliceDigest,
  Position,
} from '@storacha/blob-index/types'
import { AssertLocation } from '@web3-storage/content-claims/capability/api'

type Override<T, R> = Omit<T, keyof R> & R

type FetchOptions = Override<
  IpfsUtilsFetchOptions,
  {
    // `fetch` is a browser API and browsers don't have `Readable`
    body: Exclude<IpfsUtilsFetchOptions['body'], import('node:stream').Readable>
  }
>

export type {
  FetchOptions,
  BlobModel,
  SpaceBlobAddSuccess,
  SpaceBlobAddFailure,
  BlobAllocate,
  BlobAllocateSuccess,
  BlobAllocateFailure,
  BlobAccept,
  BlobAcceptSuccess,
  BlobAcceptFailure,
  SpaceBlobRemove,
  SpaceBlobRemoveSuccess,
  SpaceBlobRemoveFailure,
  SpaceBlobList,
  SpaceBlobListSuccess,
  SpaceBlobListFailure,
  SpaceBlobGet,
  SpaceBlobGetSuccess,
  SpaceBlobGetFailure,
  SpaceIndexAdd,
  SpaceIndexAddSuccess,
  SpaceIndexAddFailure,
  UploadAdd,
  UploadAddSuccess,
  UploadGetSuccess,
  UploadGetFailure,
  UploadList,
  UploadListSuccess,
  UploadListItem,
  UploadRemove,
  UploadRemoveSuccess,
  UsageReport,
  UsageReportSuccess,
  UsageReportFailure,
  EgressData,
  EgressRecord,
  EgressRecordSuccess,
  EgressRecordFailure,
  ListResponse,
  CARLink,
  ShardLink,
  PieceLink,
  ShardedDAGIndex,
  ShardDigest,
  SliceDigest,
  Position,
}

export type {
  Capability,
  Channel,
  Connection,
  DID,
  Failure,
  InferReceipt,
  Invocation,
  Principal,
  Receipt,
  Result,
  Signer,
  SignerArchive,
  UCANLink,
  UnknownLink,
} from '@ucanto/interface'

export interface ProgressStatus extends XHRProgressStatus {
  url?: string
}

export type ProgressFn = (status: ProgressStatus) => void

export interface Service extends StorefrontService {
  ucan: {
    conclude: ServiceMethod<
      UCANConclude,
      UCANConcludeSuccess,
      UCANConcludeFailure
    >
  }
  space: {
    blob: {
      add: ServiceMethod<SpaceBlobAdd, SpaceBlobAddSuccess, SpaceBlobAddFailure>
      remove: ServiceMethod<
        SpaceBlobRemove,
        SpaceBlobRemoveSuccess,
        SpaceBlobRemoveFailure
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
      replicate: ServiceMethod<
        SpaceBlobReplicate,
        SpaceBlobReplicateSuccess,
        SpaceBlobReplicateFailure
      >
    }
    index: {
      add: ServiceMethod<
        SpaceIndexAdd,
        SpaceIndexAddSuccess,
        SpaceIndexAddFailure
      >
    }
  }
  upload: {
    add: ServiceMethod<UploadAdd, UploadAddSuccess, Failure>
    get: ServiceMethod<UploadGet, UploadGetSuccess, UploadGetFailure>
    remove: ServiceMethod<UploadRemove, UploadRemoveSuccess, Failure>
    list: ServiceMethod<UploadList, UploadListSuccess, Failure>
  }
  usage: {
    report: ServiceMethod<UsageReport, UsageReportSuccess, UsageReportFailure>
  }
}

/**
 * The blob service is implemented by storage nodes, but it is used here because
 * the upload service exposes an interface whereby receipts for invocations
 * made by it are available.
 */
export interface BlobService {
  blob: {
    allocate: ServiceMethod<BlobAllocate, BlobAcceptSuccess, BlobAcceptFailure>
    accept: ServiceMethod<BlobAccept, BlobAcceptSuccess, BlobAcceptFailure>
  }
}

export interface InvocationConfig {
  /**
   * Signing authority that is issuing the UCAN invocation(s).
   */
  issuer: Signer
  /**
   * The principal delegated to in the current UCAN.
   */
  audience?: Principal
  /**
   * The resource the invocation applies to.
   */
  with: DID
  /**
   * Proof(s) the issuer has the capability to perform the action.
   */
  proofs: Proof[]
}

export interface CapabilityQuery {
  can: ServiceAbility
  nb?: unknown
}

/** Generates invocation configuration for the requested capabilities. */
export interface InvocationConfigurator {
  (caps: CapabilityQuery[]): Await<InvocationConfig>
}

export interface UnixFSEncodeResult {
  /**
   * Root CID for the DAG.
   */
  cid: UnknownLink
  /**
   * Blocks for the generated DAG.
   */
  blocks: Block[]
}

/**
 * Information present in the CAR file header.
 */
export interface CARHeaderInfo {
  /**
   * CAR version number.
   */
  version: number
  /**
   * Root CIDs present in the CAR header.
   */
  roots: Array<Link<unknown, number, number, Version>>
}

/**
 * A DAG encoded as a CAR.
 */
export interface CARFile extends CARHeaderInfo, Blob {}

/**
 * An indexed blob.
 */
export interface BlobIndex {
  /** Slices and their offset/length within the blob. */
  slices: Map<SliceDigest, Position>
}

/**
 * A serialized DAG with added index information.
 */
export interface IndexedSerializedDAGShard extends Blob, BlobIndex {
  /** Root of the DAG (if known) */
  root?: UnknownLink
}

/**
 * A DAG encoded as a CAR with added index information.
 */
export interface IndexedCARFile extends IndexedSerializedDAGShard, CARFile {}

/**
 * Any IPLD link.
 */
export type AnyLink = Link<unknown, number, number, Version>

/**
 * Metadata pertaining to a DAG shard.
 */
export interface ShardMetadata extends BlobIndex {
  /**
   * CID of the shard (not the root CID of the DAG it contains).
   */
  cid: ShardLink
  /**
   * Piece CID of the CAR file. Note: represents Piece link V2.
   *
   * @see https://github.com/filecoin-project/FIPs/pull/758/files
   */
  piece?: PieceLink
  /**
   * Size of the shard in bytes.
   */
  size: number
}

export interface Retryable {
  retries?: number
}

export interface Abortable {
  signal?: AbortSignal
}

export interface Connectable {
  connection?: ConnectionView<Service>
}

export type FetchWithUploadProgress = (
  url: string,
  init?: FetchOptions
) => Promise<Response>

export interface UploadProgressTrackable {
  fetchWithUploadProgress?: FetchWithUploadProgress
  onUploadProgress?: ProgressFn
}

export interface Pageable {
  /**
   * Opaque string specifying where to start retrival of the next page of
   * results.
   */
  cursor?: string
  /**
   * Maximum number of items to return.
   */
  size?: number
  /**
   * If true, return page of results preceding cursor. Defaults to false.
   */
  pre?: boolean
}

export interface RequestOptions
  extends Retryable,
    Abortable,
    Connectable,
    UploadProgressTrackable {
  fetch?: typeof globalThis.fetch
  nonce?: string
  receiptsEndpoint?: string
}

export interface ListRequestOptions extends RequestOptions, Pageable {}

export type DirectoryEntryLink =
  import('@ipld/unixfs/directory').DirectoryEntryLink

export interface UnixFSDirectoryEncoderOptions {
  /**
   * Callback for every DAG encoded directory entry, including the root.
   */
  onDirectoryEntryLink?: (link: DirectoryEntryLink) => void
}

export interface UnixFSEncoderSettingsOptions {
  /**
   * Settings for UnixFS encoding.
   */
  settings?: EncoderSettings
}

export interface DeduplicationOptions {
  /**
   * Set to `false` to disable deduplication of repeated blocks as they are
   * uploaded. This can reduce upload size if your dataset contains duplicated
   * files/data at the cost of an additional memory overhead. Default: `true`.
   */
  dedupe?: boolean
}

export interface ShardingOptions {
  /**
   * The target shard size. Actual size of CAR output may be bigger due to CAR
   * header and block encoding data.
   */
  shardSize?: number
  /**
   * The root CID of the DAG contained in the shards. By default The last block
   * is assumed to be the DAG root and becomes the CAR root CID for the last CAR
   * output. Set this option to use this CID instead.
   */
  rootCID?: AnyLink
}

export interface ShardStoringOptions
  extends RequestOptions,
    UploadProgressTrackable {}

export interface UploadOptions
  extends RequestOptions,
    ShardingOptions,
    DeduplicationOptions,
    ShardStoringOptions,
    UploadProgressTrackable {
  onShardStored?: (meta: ShardMetadata) => void
  pieceHasher?: MultihashHasher<typeof pieceHashCode>
}

export interface UploadFileOptions
  extends UploadOptions,
    UnixFSEncoderSettingsOptions {}

export interface UploadDirectoryOptions
  extends UploadOptions,
    UnixFSEncoderSettingsOptions,
    UnixFSDirectoryEncoderOptions {
  /**
   * Whether the directory files have already been ordered in a custom way.
   * Indicates that the upload must not use a different order than the one
   * provided.
   */
  customOrder?: boolean
}

export interface BlobLike {
  /**
   * Returns a ReadableStream which yields the Blob data.
   */
  stream: Blob['stream']
  /**
   * Size in bytes of the blob.
   */
  size?: number
}

export interface FileLike extends BlobLike {
  /**
   * Name of the file. May include path information.
   */
  name: string
}

export interface BlobAddOk {
  site: Delegation<[AssertLocation]>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ReceiptGetOptions<S extends Record<string, any>>
  extends Abortable {
  fetch?: typeof globalThis.fetch
  endpoint?: URL
  connection?: Connection<S>
}

/** A receipt was not found for the given task. */
export interface ReceiptNotFound extends Failure {
  name: 'ReceiptNotFound'
}

/** The agent message did not contain a receipt for the task. */
export interface ReceiptMissing extends Failure {
  name: 'ReceiptMissing'
}

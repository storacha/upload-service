import type {
  Capability,
  Failure,
  Result,
  ServiceMethod,
  UCANOptions,
  IssuedInvocationView,
  ConnectionView,
  Principal,
  HTTPRequest,
  AgentMessage,
  Await,
} from '@ucanto/interface'
import type { FetchResponse } from '@ucanto/transport/http'
import type { MultihashDigest } from 'multiformats'
import type {
  BlobAllocate,
  BlobAccept,
  BlobAllocateSuccess,
  BlobAcceptSuccess,
  BlobReplicaAllocate,
  BlobReplicaAllocateSuccess,
  BlobReplicaAllocateFailure,
  PDPInfo,
  PDPInfoSuccess,
  PDPInfoFailure,
} from '@storacha/capabilities/types'

export type {
  Capability,
  Failure,
  Result,
  ServiceMethod,
  UCANOptions,
  IssuedInvocationView,
  ConnectionView,
  Principal,
  HTTPRequest,
  AgentMessage,
  Await,
  FetchResponse,
  MultihashDigest,
  BlobAllocate,
  BlobAccept,
  BlobAllocateSuccess,
  BlobAcceptSuccess,
  BlobReplicaAllocate,
  BlobReplicaAllocateSuccess,
  BlobReplicaAllocateFailure,
  PDPInfo,
  PDPInfoSuccess,
  PDPInfoFailure,
}

/**
 * Service interface for blob operations.
 */
export interface StorageService {
  pdp: {
    info: ServiceMethod<PDPInfo, PDPInfoSuccess, PDPInfoFailure>
  }
  blob: {
    allocate: ServiceMethod<BlobAllocate, BlobAllocateSuccess, Failure>
    accept: ServiceMethod<BlobAccept, BlobAcceptSuccess, Failure>
    replica: {
      allocate: ServiceMethod<
        BlobReplicaAllocate,
        BlobReplicaAllocateSuccess,
        BlobReplicaAllocateFailure
      >
    }
  }
}

/**
 * Configuration for making invocations to storage nodes.
 */
export interface Configuration<C extends Capability> {
  /** Connection to the storage node. */
  connection: ConnectionView<StorageService>
  /** Invocation to execute. */
  invocation: IssuedInvocationView<C>
}

/**
 * An unavailable proof error is returned when the routing does not have a
 * valid unexpired and unrevoked proof available.
 */
export interface ProofUnavailable extends Failure {
  name: 'ProofUnavailable'
}

/**
 * An unavailable candidate error is returned when there are no candidates
 * willing to allocate space for the given blob.
 */
export interface CandidateUnavailable extends Failure {
  name: 'CandidateUnavailable'
}

export interface SelectStorageProviderOptions {
  /**
   * A list of storage providers, in addition to the primary, that should be
   * excluded from the results.
   */
  exclude?: Principal[]
}

export interface SelectReplicationProvidersOptions extends SelectStorageProviderOptions {}

export interface AgentMessageFetch {
  (url: string, init: HTTPRequest<AgentMessage<unknown>>): Await<FetchResponse>
}

export interface ChannelOptions {
  fetch?: AgentMessageFetch
  headers?: Record<string, string>
}

export interface ConfigureInvocationOptions extends Omit<UCANOptions, 'audience'> {
  /**
   * Options for configuring the channel.
   */
  channel?: ChannelOptions
}

/**
 * The routing service is responsible for selecting storage nodes to allocate
 * blobs with.
 */
export interface RoutingService {
  /**
   * Selects a candidate for blob allocation from the current list of available
   * storage nodes.
   */
  selectStorageProvider(
    digest: MultihashDigest,
    size: number,
    options?: SelectStorageProviderOptions
  ): Promise<Result<Principal, CandidateUnavailable | Failure>>
  /**
   * Select multiple storage nodes that can replicate the passed hash.
   */
  selectReplicationProviders(
    /**
     * The storage provider that is storing the primary copy of the data. Used
     * to return a list of nodes that does NOT include this node.
     */
    primary: Principal,
    /** The number of replica nodes required. */
    count: number,
    /** Hash of the blob to be replicated. */
    digest: MultihashDigest,
    /** Size of the blob to be replicated. */
    size: number,
    options?: SelectReplicationProvidersOptions
  ): Promise<Result<Principal[], CandidateUnavailable | Failure>>
  /**
   * Returns information required to make an invocation to the requested storage
   * node.
   */
  configureInvocation<
    C extends PDPInfo | BlobAllocate | BlobAccept | BlobReplicaAllocate
  >(
    provider: Principal,
    capability: C,
    options?: ConfigureInvocationOptions
  ): Promise<Result<Configuration<C>, ProofUnavailable | Failure>>
}

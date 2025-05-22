import type {
  UnknownLink,
  Link,
  Invocation,
  Result,
  Failure,
  Capability,
  ServiceMethod,
  UCANOptions,
  IssuedInvocationView,
  ConnectionView,
  Principal,
  Unit,
} from '@ucanto/interface'
import {
  Multihash,
  BlobAllocate,
  BlobAccept,
  BlobAllocateSuccess,
  BlobAcceptSuccess,
  BlobReplicaAllocate,
  BlobReplicaAllocateSuccess,
  BlobReplicaAllocateFailure,
} from '@storacha/capabilities/types'
import { MultihashDigest } from 'multiformats'
import { DID, ListResponse, SpaceDID, UCANLink } from '../types.js'
import { Storage } from './storage.js'

export interface Blob {
  digest: MultihashDigest
  size: number
}

export interface Entry {
  blob: Blob
  cause: Link
  insertedAt: Date
}

/** Indicates an entry was not found that matches the passed details. */
export interface EntryNotFound extends Failure {
  name: 'EntryNotFound'
}

/** Indicates an entry has already been registered for the passed details. */
export interface EntryExists extends Failure {
  name: 'EntryExists'
}

export type TasksStorage = Storage<UnknownLink, Invocation>

export interface Registry {
  /** Lookup an existing registration. */
  find: (
    space: SpaceDID,
    digest: MultihashDigest
  ) => Promise<Result<Entry, EntryNotFound>>
  /** Adds an item into the registry if it does not already exist. */
  register: (item: RegistrationData) => Promise<Result<Unit, EntryExists>>
  /** List entries in the registry for a given space. */
  entries: (
    space: SpaceDID,
    options?: ListOptions
  ) => Promise<Result<ListResponse<Entry>, Failure>>
  /** Removes an item from the registry if it exists. */
  deregister: (item: DeregistrationData) => Promise<Result<Unit, EntryNotFound>>
}

export interface ListOptions {
  size?: number
  cursor?: string
}

export interface BlobModel {
  digest: Multihash
  size: number
}

export interface DeregistrationData {
  space: SpaceDID
  digest: MultihashDigest
  cause: Link
}

export interface RegistrationData {
  space: SpaceDID
  cause: Link
  blob: Blob
}

export interface BlobService {
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

export interface Configuration<C extends Capability> {
  /** Connection to the storage node. */
  connection: ConnectionView<BlobService>
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

export interface SelectReplicationProvidersOptions {
  /**
   * A list of storage providers, in addition to the primary, that should be
   * excluded from the results.
   */
  exclude?: Principal[]
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
    size: number
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
    C extends BlobAllocate | BlobAccept | BlobReplicaAllocate
  >(
    provider: Principal,
    capability: C,
    options?: Omit<UCANOptions, 'audience'>
  ): Promise<Result<Configuration<C>, ProofUnavailable | Failure>>
}

/**
 * Replication status for a blob.
 *
 * - `allocated` - Initial state, implies the service invoked and received a
 *   success receipt for `blob/replica/allocate` from the replica node.
 * - `transferred` - The service has received a success receipt from the replica
 *   node for the `blob/replica/transfer` task.
 * - `failed` - The service has either failed to allocate on a replica node or
 *   received an error receipt for the `blob/replica/transfer` task or the
 *   receipt was never communicated and the task has expired.
 */
export type ReplicationStatus = 'allocated' | 'transferred' | 'failed'

export interface Replica {
  /** Space the blob is stored in. */
  space: SpaceDID
  /** Hash of the blob. */
  digest: MultihashDigest
  /** The node delegated to store the replica. */
  provider: DID
  /** Status of the replication. */
  status: ReplicationStatus
  /** Link to `blob/replica/allocate` invocation instructing the replication. */
  cause: UCANLink<[BlobReplicaAllocate]>
}

/** Indicates the replica was not found. */
export interface ReplicaNotFound extends Failure {
  name: 'ReplicaNotFound'
}

/** Indicates the replica already exists. */
export interface ReplicaExists extends Failure {
  name: 'ReplicaExists'
}

export interface ReplicaStorage {
  /** Add a replica to the store. */
  add: (data: {
    space: SpaceDID
    digest: MultihashDigest
    provider: DID
    status: ReplicationStatus
    cause: UCANLink<[BlobReplicaAllocate]>
  }) => Promise<Result<Unit, ReplicaExists | Failure>>
  /** Update the replication status. */
  setStatus: (
    key: {
      space: SpaceDID
      digest: MultihashDigest
      provider: DID
    },
    status: ReplicationStatus
  ) => Promise<Result<Unit, ReplicaNotFound | Failure>>
  /** List replicas for the given space/blob. */
  list: (filter: {
    space: SpaceDID
    digest: MultihashDigest
  }) => Promise<Result<Replica[], Failure>>
}

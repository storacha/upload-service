import type {
  UnknownLink,
  Link,
  Invocation,
  Result,
  Failure,
  Unit,
} from '@ucanto/interface'
import { Multihash, BlobReplicaAllocate } from '@storacha/capabilities/types'
import { MultihashDigest } from 'multiformats'
import { DID, ListResponse, SpaceDID, UCANLink } from '../types.js'
import { Storage } from './storage.js'
export type * from '@storacha/router/types'
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

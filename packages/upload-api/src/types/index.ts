import { MultihashDigest } from 'multiformats'
import { Failure, Result, Unit } from '@ucanto/interface'
import { ShardedDAGIndex } from '@storacha/blob-index/types'
import { ProviderDID, SpaceDID } from '@storacha/capabilities/types'
import { Registry } from './blob.js'
import { ClaimsClientContext } from '@web3-storage/upload-api/types'
import { Context as IndexingServiceContext } from './indexing-service.js'
import { ProvisionsStorage } from './provisions.js'

export type { ShardedDAGIndex, IndexingServiceContext }

/**
 * Service that allows publishing a set of multihashes to IPNI for a
 * pre-configured provider.
 */
export interface IPNIService {
  /** Publish the multihashes in the provided index to IPNI. */
  publish(
    /** Space that is storing the index. */
    space: SpaceDID,
    /**
     * Storage providers serbices registered for the space. Allows routing of
     * publish request to particular IPNI chain(s).
     */
    providers: ProviderDID[],
    /** Index to publish multihashes for. */
    index: ShardedDAGIndex
  ): Promise<Result<Unit, Failure>>
}

export interface BlobNotFound extends Failure {
  name: 'BlobNotFound'
  digest: Uint8Array
}

/** Retrieve a blob from the network. */
export interface BlobRetriever {
  stream(
    digest: MultihashDigest
  ): Promise<Result<ReadableStream<Uint8Array>, BlobNotFound>>
}

/** @deprecated */
export type LegacyClaimsClientContext = ClaimsClientContext

export interface IndexServiceContext
  extends IndexingServiceContext,
    LegacyClaimsClientContext {
  blobRetriever: BlobRetriever
  registry: Registry
  /**
   * IPNI service to publish index hashes to. May be `undefined` if the service
   * does not allow public discovery of uploaded content.
   */
  ipniService?: IPNIService
  provisionsStorage: ProvisionsStorage
}

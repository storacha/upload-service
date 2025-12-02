import type {
  Signer,
  Principal,
  UnknownLink,
  Receipt,
  Invocation,
  Failure,
  DID,
  Proof,
  ConnectionView,
  Result,
  MultihashDigest,
} from '@ucanto/interface'
import { PieceLink } from '@web3-storage/data-segment'
import {
  AggregatorService,
  StorefrontService,
  DealTrackerService,
} from '@storacha/filecoin-client/types'
import { RoutingService } from '@storacha/router/types'
import {
  Store,
  UpdatableStore,
  QueryableStore,
  Queue,
  ServiceConfig,
  StoreGetError,
  PDPInfoSuccess,
} from '../types.js'

export type PieceStore = Store<PieceRecordKey, PieceRecord> &
  UpdatableStore<PieceRecordKey, PieceRecord> &
  QueryableStore<Pick<PieceRecord, 'status'>, PieceRecord>
export type FilecoinSubmitQueue = Queue<FilecoinSubmitMessage>
export type PieceOfferQueue = Queue<PieceOfferMessage>
export type TaskStore = Store<UnknownLink, Invocation>
export type ReceiptStore = Store<UnknownLink, Receipt>

export interface ServiceContext {
  /**
   * Service signer
   */
  id: Signer
  /**
   * Stores pieces that have been offered to the Storefront.
   */
  pieceStore: PieceStore
  /**
   * Queues pieces for verification.
   */
  filecoinSubmitQueue: FilecoinSubmitQueue
  /**
   * Queues pieces for offering to an Aggregator.
   */
  pieceOfferQueue: PieceOfferQueue
  /**
   * Stores task invocations.
   */
  taskStore: TaskStore
  /**
   * Stores receipts for tasks.
   */
  receiptStore: ReceiptStore
  /**
   * Aggregator connection to move pieces into the pipeline.
   */
  aggregatorService: ServiceConfig<AggregatorService>
  /**
   * Deal tracker connection to find out available deals for an aggregate.
   */
  dealTrackerService: ServiceConfig<DealTrackerService>
  /**
   * Routing service to configure invocations to storage nodes.
   */
  router: RoutingService
}

export interface TestStorageNode {
  id: Signer
  addPDPInfo(digest: MultihashDigest, info: PDPInfoSuccess): Promise<void>
}

export interface TestServiceContext extends ServiceContext {
  aggregatorId: Signer
  storageProviders: Array<TestStorageNode>
}

export interface FilecoinSubmitMessageContext
  extends Pick<ServiceContext, 'pieceStore'> {
  contentStore: ContentStore<UnknownLink, Uint8Array>
}

export interface PieceOfferMessageContext
  extends Pick<
    ServiceContext,
    'aggregatorService'
  > { }

export interface StorefrontClientContext {
  /**
   * Storefront own connection to issue receipts.
   */
  storefrontService: ServiceConfig<StorefrontService>
}

export interface ClaimsInvocationConfig {
  /**
   * Signing authority that is issuing the UCAN invocation(s).
   */
  issuer: Signer
  /**
   * The principal delegated to in the current UCAN.
   */
  audience: Principal
  /**
   * The resource the invocation applies to.
   */
  with: DID
  /**
   * Proof(s) the issuer has the capability to perform the action.
   */
  proofs?: Proof[]
}

export interface ClaimsClientContext {
  /**
   * Claims own connection to issue claims.
   */
  claimsService: {
    invocationConfig: ClaimsInvocationConfig
    connection: ConnectionView<
      import('@web3-storage/content-claims/server/service/api').Service
    >
  }
}

export interface CronContext
  extends Pick<
    ServiceContext,
    'id' | 'pieceStore' | 'receiptStore' | 'taskStore' | 'aggregatorService'
  > { }

export interface PieceRecord {
  /**
   * Piece CID for the content.
   */
  piece: PieceLink
  /**
   * CAR shard CID.
   */
  content: UnknownLink
  /**
   * Grouping information for submitted piece.
   */
  group: string
  /**
   * Status of the offered filecoin piece.
   * - submitted = verified valid piece and submitted to the aggregation pipeline
   * - accepted = accepted and included in filecoin deal(s)
   * - invalid = content/piece CID mismatch
   */
  status: 'submitted' | 'accepted' | 'invalid'
  /**
   * Insertion date ISO string.
   */
  insertedAt: string
  /**
   * Update date ISO string.
   */
  updatedAt: string
}
export interface PieceRecordKey extends Pick<PieceRecord, 'piece'> { }

export interface FilecoinSubmitMessage {
  /**
   * Piece CID for the content.
   */
  piece: PieceLink
  /**
   * CAR shard CID.
   */
  content: UnknownLink
  /**
   * Grouping information for submitted piece.
   */
  group: string
  /**
   * Info from the PDP node about the piece.
   */
  pdpInfoSuccess?: PDPInfoSuccess
}

export interface PieceOfferMessage {
  /**
   * Piece CID.
   */
  piece: PieceLink
  /**
   * CAR shard CID.
   */
  content: UnknownLink
  /**
   * Grouping information for submitted piece.
   */
  group: string
}

export interface DataAggregationProofNotFound extends Failure {
  name: 'DataAggregationProofNotFound'
}

export interface ContentStore<RecKey, Rec> {
  /**
   * Gets a record from the store.
   */
  stream: (key: RecKey) => Promise<Result<ReadableStream<Rec>, StoreGetError>>
}

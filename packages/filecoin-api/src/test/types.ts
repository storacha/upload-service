import type { Signer, Result, Unit, UnknownLink } from '@ucanto/interface'
import * as AggregatorInterface from '../aggregator/api.js'
import * as DealerInterface from '../dealer/api.js'
import * as StorefrontInterface from '../storefront/api.js'
import { StorePutError } from '../types.js'

export interface AggregatorTestEventsContext
  extends AggregatorInterface.PieceMessageContext,
    AggregatorInterface.PieceAcceptMessageContext,
    AggregatorInterface.AggregateOfferMessageContext,
    AggregatorInterface.PieceInsertEventContext,
    AggregatorInterface.InclusionInsertEventToUpdateState,
    AggregatorInterface.InclusionInsertEventToIssuePieceAccept,
    AggregatorInterface.AggregateInsertEventToAggregateOfferContext,
    AggregatorInterface.AggregateInsertEventToPieceAcceptQueueContext,
    AggregatorInterface.BufferMessageContext {
  id: Signer
  service: Partial<{
    filecoin: Partial<import('../types.js').StorefrontService['filecoin']>
    piece: Partial<import('../types.js').AggregatorService['piece']>
    aggregate: Partial<import('../types.js').DealerService['aggregate']>
    deal: Partial<import('../types.js').DealTrackerService['deal']>
  }>
}

export interface DealerTestEventsContext
  extends DealerInterface.AggregateInsertEventContext,
    DealerInterface.AggregateUpdatedStatusEventContext,
    DealerInterface.CronContext {
  id: Signer
  service: Partial<{
    filecoin: Partial<import('../types.js').StorefrontService['filecoin']>
    piece: Partial<import('../types.js').AggregatorService['piece']>
    aggregate: Partial<import('../types.js').DealerService['aggregate']>
    deal: Partial<import('../types.js').DealTrackerService['deal']>
  }>
}

export interface StorefrontTestEventsContext
  extends StorefrontInterface.FilecoinSubmitMessageContext,
    StorefrontInterface.PieceOfferMessageContext,
    StorefrontInterface.StorefrontClientContext,
    StorefrontInterface.ClaimsClientContext,
    StorefrontInterface.CronContext {
  id: Signer
  aggregatorId: Signer
  testContentStore: TestContentStore<UnknownLink, Uint8Array>
  service: Partial<{
    filecoin: Partial<import('../types.js').StorefrontService['filecoin']>
    piece: Partial<import('../types.js').AggregatorService['piece']>
    aggregate: Partial<import('../types.js').DealerService['aggregate']>
    deal: Partial<import('../types.js').DealTrackerService['deal']>
    assert: Partial<
      import('@web3-storage/content-claims/server/service/api').AssertService
    >
  }>
}

export interface TestContentStore<RecKey, Rec>
  extends StorefrontInterface.ContentStore<RecKey, Rec> {
  /**
   * Puts a record in the store.
   */
  put: (record: Rec) => Promise<Result<Unit, StorePutError>>
}

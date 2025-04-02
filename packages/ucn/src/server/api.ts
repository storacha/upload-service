import { Result, DID, Failure, Unit, Invocation } from '@ucanto/interface'
import { BlockFetcher, BlockPutter, EventLink } from '../api.js'

export type { Service, RawValue, EventLink, EventBlock, EventView, Block, Signer } from '../api.js'

export interface NotFound extends Failure {
  name: 'NotFound'
}

export interface HeadEvent {
  event: EventLink
  cause: Invocation
}

export interface HeadStorage {
  get: (clock: DID) => Promise<Result<HeadEvent[], NotFound>>
  put: (clock: DID, head: HeadEvent[]) => Promise<Result<Unit, Failure>>
}

export interface Context {
  /**
   * Storage for clock head events.
   */
  headStore: HeadStorage
  /**
   * For fetching blocks from the network.
   */
  blockFetcher: BlockFetcher
  /**
   * For fetching and putting blocks to local cache.
   */
  blockCache: BlockFetcher & BlockPutter
}

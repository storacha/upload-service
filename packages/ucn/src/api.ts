import * as Base from './base/api.js' 
import {
  ConnectionView,
  Delegation,
  DID,
  Proof,
  Principal,
  Signer,
  UCANLink,
} from '@ucanto/interface'
import { Service } from '@web3-storage/clock/api'
import { BlockFetcher } from '@web3-storage/pail/api'
import { Block } from 'multiformats'

export type {
  Block,
  BlockFetcher,
  ConnectionView,
  Delegation,
  DID,
  Proof,
  Principal,
  Service,
  Signer,
  UCANLink,
}

export type { NameView, BlockPutter } from './base/api.js'

/**
 * Value of a name. Typically a multibase encoded CID prefixed with `/ipfs/`.
 *
 * e.g. /ipfs/bafkreiem4twkqzsq2aj4shbycd4yvoj2cx72vezicletlhi7dijjciqpui
 */
export type Value = string

export type ClockConnection = Base.ClockConnection<Value>

/**
 * A link to a name mutation event.
 */
export type EventLink = Base.EventLink<Value>

/**
 * A name mutation event.
 */
export type EventView = Base.EventView<Value>

/**
 * A name mutation event block.
 */
export type EventBlock = Base.EventBlock<Value> 
/**
 * A name mutation event block with value.
 */
export type EventBlockView = Base.EventBlockView<Value>

/**
 * The result of resolving the value of one or more revisions.
 */
export interface ValueView extends Base.StateView<Value> {
  /**
   * The resolved value of the name.
   */
  value: Value
}

/**
 * A representation of a past, current or future value for a name.
*/
export type RevisionView = Base.RevisionView<Value>



import * as Base from '../base/api.js' 
import {
  ConnectionView,
  Delegation,
  DID,
  Proof,
  Principal,
  Signer,
  UCANLink,
  UnknownLink
} from '@ucanto/interface'
import { Service } from '@web3-storage/clock/api'
import {ShardDiff, ShardLink, BlockFetcher, ShardBlockView, EntriesOptions } from '@web3-storage/pail/api'
import { Block } from 'multiformats'
import { Operation } from '@web3-storage/pail/crdt/api'
export type { Operation, BatchOperation, PutOperation, DeleteOperation } from '@web3-storage/pail/crdt/api'

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
  UnknownLink,
  ShardDiff,
  ShardLink,
  ShardBlockView,
  EntriesOptions
}

export type { NameView, BlockPutter } from '../base/api.js'

export type ClockConnection = Base.ClockConnection<Operation>

/**
 * A link to a name mutation event.
 */
export type EventLink = Base.EventLink<Operation>

/**
 * A name mutation event.
 */
export type EventView = Base.EventView<Operation>

/**
 * A name mutation event block.
 */
export type EventBlock = Base.EventBlock<Operation> 
/**
 * A name mutation event block with value.
 */
export type EventBlockView = Base.EventBlockView<Operation>

/**
 * The result of resolving the value of one or more revisions.
 */
export type StateView = Base.StateView<Operation>

/**
 * A value view represents the effect of resolving a state in terms of new root as well as additions and deletions
 */
export interface ValueView extends StateView {
  root: ShardLink
}

/**
 * A representation of a past, current or future value for a name.
*/
export type RevisionView = Base.RevisionView<Operation>

export type RevisionResult = { revision: RevisionView } & ShardDiff

export type ValueResult = { value: ValueView } & ShardDiff
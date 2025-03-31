import { ConnectionView, Delegation, DID, Principal, Signer } from '@ucanto/interface'
import { EventLink as ClockEventLink, EventView as ClockEventView, EventBlockView as ClockEventBlockView } from '@web3-storage/pail/clock/api'
import { Service } from '@web3-storage/clock/api'
import { BlockFetcher } from '@web3-storage/pail/api'
import { Block } from 'multiformats'

export type { Block, BlockFetcher, ConnectionView, Delegation, DID, Principal, Signer }

export type ClockConnection = ConnectionView<Service<RawValue>>

/**
 * Name is a merkle clock backed, UCAN authorized, mutable reference to a
 * resource.
 */
export interface Name extends Principal {
  /**
   * The agent that signs request to read/update the mutable reference.
   */
  agent: Signer
  /**
   * Proof that the agent can read/update the mutable reference. For read access
   * the agent must be delegated the `clock/head` capability. For write
   * access the agent must be delegated the `clock/advance` capability.
   */
  proof: Delegation
}

/**
 * Value of a name. Typically a multibase encoded CID prefixed with `/ipfs/`.
 * 
 * e.g. /ipfs/bafkreiem4twkqzsq2aj4shbycd4yvoj2cx72vezicletlhi7dijjciqpui
 */
export type RawValue = string

/**
 * A link to a name mutation event.
 */
export type EventLink = ClockEventLink<RawValue>

/**
 * A name mutation event block.
 */
export type EventBlock = Block<ClockEventView<RawValue>>

/**
 * A name mutation event block with value.
 */
export type EventBlockView = ClockEventBlockView<RawValue>

/**
 * Value is the result of resolving the value of one or more revisions.
 */
export interface Value {
  /**
   * The name the resolved value is associated with.
   */
  name: Name
  /**
   * The resolved value.
   */
  get: () => Promise<RawValue>
  /**
   * Revision(s) this resolution was calculated from.
   */
  revision: Revision[]
}

/**
 * Revision is a representation of a past, current or future value for a name.
 */
export interface Revision {
  /**
   * The value associated with this revision.
   */
  value: RawValue
  /**
   * The mutation event that backs this revision.
   */
  event: EventBlockView
  /**
   * Encode the revision as a CAR file. Note this does not include any known
   * siblings.
   */
  archive: () => Promise<Uint8Array>
}

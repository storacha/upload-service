import {
  BatcherShardEntry,
  ShardBlockView,
  BlockFetcher,
  ShardLink,
  UnknownLink,
} from '@web3-storage/pail/batch/api'
import {
  Operation,
  BatchOperation,
  EventLink,
  ValueView,
  RevisionResult,
} from '../api.js'

export type {
  BatcherShardEntry,
  ShardBlockView,
  BlockFetcher,
  ShardLink,
  UnknownLink,
  Operation,
  BatchOperation,
  EventLink,
  ValueView,
  RevisionResult,
}

export interface Batcher {
  /**
   * Put a value (a CID) for the given key. If the key exists it's value is
   * overwritten.
   */
  put: (key: string, value: UnknownLink) => Promise<void>
  /**
   * Delete the value for the given key. If the key is not found no operation
   * occurs.
   */
  del: (key: string) => Promise<void>
  /**
   * Encode all altered shards in the batch and return the new root CID, new
   * clock head, the new clock event and the difference blocks.
   */
  commit: () => Promise<RevisionResult>
}

import { CARLink, DIDKey, Link, UnknownLink } from '@w3ui/react'

export type MigrationID = string

export type MigrationSource = 'classic.nft.storage' | 'old.web3.storage'

export interface MigrationSourceConfiguration {
  /** API token for data source */
  token: string
  /** Cursor for resuming migration. */
  cursor?: string
}

export interface MigrationConfiguration {
  /** Data source */
  source: MigrationSource
  /** API token for data source */
  token: string
  /** Target space to migrate data to */
  space: DIDKey
}

export interface MigrationProgress {
  /** The current item being migrated. */
  current?: UnknownLink
  /** Cursor for resuming migration. */
  cursor?: string
  /** The number of items that are still to be migrated. */
  pending: number
  /** The number of items that have been migrated successfully. */
  succeeded: number
  /** The items that failed to migrate. */
  failed: UnknownLink[]
}

export interface Migration extends MigrationConfiguration {
  id: MigrationID
  /** The progress of the migration. */
  progress?: MigrationProgress
}

export interface Shard {
  link: CARLink
  size: () => Promise<number>
  bytes: () => Promise<Uint8Array>
}

export interface Upload {
  root: UnknownLink
  shards: Shard[]
}

export interface UploadsSource extends AsyncIterable<Upload> {}

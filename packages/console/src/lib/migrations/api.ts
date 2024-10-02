import { CARLink, DIDKey, UnknownLink } from '@w3ui/react'

/** A data source for a migration. */
export interface DataSource {
  /** Identifier for the migration. */
  id: DataSourceID
  /** Checks a token can be used, throws if invalid. */
  checkToken: (token: string) => Promise<void>
  /** Creates a new reader instance for this migration source */
  createReader: (config: DataSourceConfiguration) => Reader
}

export type DataSourceID = 'classic.nft.storage' | 'old.web3.storage' | 'psa.old.web3.storage'

export interface DataSourceConfiguration {
  /** API token for data source */
  token: string
  /** Cursor for resuming migration. */
  cursor?: string
}

export interface Reader extends AsyncIterable<Upload> {
  /** The total number of uploads to be migrated. */
  count: () => Promise<number>
}

export interface MigrationConfiguration {
  /** Data source */
  source: DataSourceID
  /** API token for data source */
  token: string
  /** Target space to migrate data to */
  space: DIDKey
}

export interface Migration extends MigrationConfiguration {
  id: MigrationID
  /** The progress of the migration. */
  progress?: Progress
}

/** A opaque string used to identify the migration instance. */
export type MigrationID = string

export interface Progress {
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

export interface Shard {
  link: CARLink
  size: () => Promise<number>
  bytes: () => Promise<Uint8Array>
}

export interface Upload {
  root: UnknownLink
  shards: Shard[]
}

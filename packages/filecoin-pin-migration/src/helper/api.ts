import type { SpaceDID } from '../api.js'

export interface StorageRetentionCostInput {
  sizeBytes: bigint
  months: bigint
  copies: number
  withCDN?: boolean
  isNewDataSet?: boolean
  currentDataSetSize?: bigint
}

export interface StorageRetentionCostPricing {
  pricePerTiBPerMonthNoCDN: bigint
  minimumPricePerMonth: bigint
  epochsPerMonth: bigint
}

export interface StorageRetentionCostEstimate {
  withCDN: boolean
  pricePerTiBPerMonthNoCDN: bigint
  minimumPricePerMonth: bigint
  epochsPerMonth: bigint
  ratePerMonthPerCopy: bigint
  ratePerMonthTotal: bigint
  storageSpendPerCopy: bigint
  storageSpendTotal: bigint
  rateDeltaPerEpochPerCopy: bigint
  rateDeltaPerEpochTotal: bigint
  rateLockupDeltaPerCopy: bigint
  rateLockupDeltaTotal: bigint
  sybilFeePerCopy: bigint
  sybilFeeTotal: bigint
  cdnFixedLockupPerCopy: bigint
  cdnFixedLockupTotal: bigint
  lockupPerCopy: bigint
  totalLockedInContract: bigint
  recommendedAvailableForPeriod: bigint
}

export interface CommittedDataSetPiece {
  pieceCID: string
  ipfsRootCID?: string
}

export interface FetchDataSetPiecesResult {
  dataSetId: bigint
  providerURL: string | null
  pieces: CommittedDataSetPiece[]
}

export interface CommittedUpload {
  ipfsRootCID: string
  pieceCount: number
  pieceCIDs: string[]
}

export interface ListCommittedUploadsResult {
  dataSetId: bigint
  providerURL: string | null
  pieceCount: number
  uploads: CommittedUpload[]
  piecesMissingRoot: string[]
}

export interface ReconcileMigrationStateChanges {
  committedAdded: string[]
  committedRemoved: string[]
  pulledRemovedBecauseCommitted: string[]
  removedStagedShardCIDs: string[]
}

export interface ReconcileMigrationStateWarnings {
  committedPiecesNotFoundInInventory: string[]
  unverifiedStagedShardCIDs: string[]
}

export interface ReconcileMigrationStateSPCheck {
  statusBreakdown: Record<string, number>
}

export interface ReconcileMigrationStateCopyReport {
  copyIndex: number
  providerId: bigint
  dataSetId: bigint | null
  skippedReason?: 'missing-data-set-id' | 'missing-provider-url'
  changes: ReconcileMigrationStateChanges
  warnings: ReconcileMigrationStateWarnings
  spCheck?: ReconcileMigrationStateSPCheck
}

export interface ReconcileMigrationStateSpaceReport {
  spaceDID: SpaceDID
  inventoryShardsMissingPieceCID: string[]
  copies: ReconcileMigrationStateCopyReport[]
}

export interface ReconcileMigrationStateResult {
  hasDiscrepancies: boolean
  stateCorrected: boolean
  spaces: ReconcileMigrationStateSpaceReport[]
}

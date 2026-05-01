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

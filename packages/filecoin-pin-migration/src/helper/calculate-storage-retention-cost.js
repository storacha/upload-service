import {
  calculateAdditionalLockupRequired,
  calculateEffectiveRate,
  getServicePrice,
} from '@filoz/synapse-core/warm-storage'
import { LOCKUP_PERIOD } from '@filoz/synapse-core/utils'
import { DEFAULT_ENABLE_CDN } from '../constants.js'

/**
 * @import * as API from './api.js'
 */

/**
 * Fetch live pricing once and calculate the cost of retaining data for a fixed
 * number of months and copies.
 *
 * @param {import('viem').Client<import('viem').Transport, import('viem').Chain>} client
 * @param {API.StorageRetentionCostInput} input
 * @returns {Promise<API.StorageRetentionCostEstimate>}
 */
export async function getStorageRetentionCost(client, input) {
  const pricing = await getServicePrice(client)
  return calculateStorageRetentionCostFromPricing(pricing, input)
}

/**
 * Pure storage-retention cost calculator. Keeps the pricing fetch separate so
 * the CLI can use live prices while tests can inject fixed pricing.
 *
 * @param {API.StorageRetentionCostPricing} pricing
 * @param {API.StorageRetentionCostInput} input
 * @returns {API.StorageRetentionCostEstimate}
 */
export function calculateStorageRetentionCostFromPricing(pricing, input) {
  const normalized = normalizeStorageRetentionCostInput(input)
  const {
    sizeBytes,
    months,
    copies,
    withCDN,
    isNewDataSet,
    currentDataSetSize,
  } = normalized
  const totalSizeBytes = currentDataSetSize + sizeBytes
  const copiesBigInt = BigInt(copies)

  const rate = calculateEffectiveRate({
    sizeInBytes: totalSizeBytes,
    pricePerTiBPerMonth: pricing.pricePerTiBPerMonthNoCDN,
    minimumPricePerMonth: pricing.minimumPricePerMonth,
    epochsPerMonth: pricing.epochsPerMonth,
  })

  const lockup = calculateAdditionalLockupRequired({
    dataSize: sizeBytes,
    currentDataSetSize,
    pricePerTiBPerMonth: pricing.pricePerTiBPerMonthNoCDN,
    minimumPricePerMonth: pricing.minimumPricePerMonth,
    epochsPerMonth: pricing.epochsPerMonth,
    lockupEpochs: LOCKUP_PERIOD,
    isNewDataSet,
    withCDN,
  })

  const ratePerMonthPerCopy = rate.ratePerMonth
  const ratePerMonthTotal = ratePerMonthPerCopy * copiesBigInt
  const storageSpendPerCopy = ratePerMonthPerCopy * months
  const storageSpendTotal = ratePerMonthTotal * months

  const rateDeltaPerEpochPerCopy = lockup.rateDeltaPerEpoch
  const rateDeltaPerEpochTotal = rateDeltaPerEpochPerCopy * copiesBigInt
  const rateLockupDeltaPerCopy = lockup.rateLockupDelta
  const rateLockupDeltaTotal = rateLockupDeltaPerCopy * copiesBigInt
  const sybilFeePerCopy = lockup.sybilFee
  const sybilFeeTotal = sybilFeePerCopy * copiesBigInt
  const cdnFixedLockupPerCopy = lockup.cdnFixedLockup
  const cdnFixedLockupTotal = cdnFixedLockupPerCopy * copiesBigInt
  const lockupPerCopy = lockup.total
  const totalLockedInContract = lockupPerCopy * copiesBigInt
  const recommendedAvailableForPeriod =
    totalLockedInContract + storageSpendTotal

  return {
    withCDN,
    pricePerTiBPerMonthNoCDN: pricing.pricePerTiBPerMonthNoCDN,
    minimumPricePerMonth: pricing.minimumPricePerMonth,
    epochsPerMonth: pricing.epochsPerMonth,
    ratePerMonthPerCopy,
    ratePerMonthTotal,
    storageSpendPerCopy,
    storageSpendTotal,
    rateDeltaPerEpochPerCopy,
    rateDeltaPerEpochTotal,
    rateLockupDeltaPerCopy,
    rateLockupDeltaTotal,
    sybilFeePerCopy,
    sybilFeeTotal,
    cdnFixedLockupPerCopy,
    cdnFixedLockupTotal,
    lockupPerCopy,
    totalLockedInContract,
    recommendedAvailableForPeriod,
  }
}

/**
 * @param {API.StorageRetentionCostInput} input
 */
function normalizeStorageRetentionCostInput(input) {
  const {
    sizeBytes,
    months,
    copies,
    withCDN = DEFAULT_ENABLE_CDN,
    isNewDataSet = true,
    currentDataSetSize = 0n,
  } = input

  if (sizeBytes <= 0n) {
    throw new Error('sizeBytes must be a positive bigint')
  }
  if (months <= 0n) {
    throw new Error('months must be a positive bigint')
  }
  if (!Number.isInteger(copies) || copies <= 0) {
    throw new Error('copies must be a positive integer')
  }
  if (currentDataSetSize < 0n) {
    throw new Error('currentDataSetSize cannot be negative')
  }
  if (isNewDataSet && currentDataSetSize !== 0n) {
    throw new Error('currentDataSetSize must be 0n when isNewDataSet is true')
  }

  return {
    sizeBytes,
    months,
    copies,
    withCDN,
    isNewDataSet,
    currentDataSetSize,
  }
}

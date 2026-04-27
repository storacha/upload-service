import { beforeEach, describe, expect, it, vi } from 'vitest'
import { calibration } from '@filoz/synapse-sdk'
import { createPublicClient, http } from 'viem'

vi.mock('@filoz/synapse-core/warm-storage', async () => {
  const actual = await vi.importActual('@filoz/synapse-core/warm-storage')

  return {
    ...actual,
    getServicePrice: vi.fn(),
  }
})

import { getServicePrice } from '@filoz/synapse-core/warm-storage'
import {
  calculateStorageRetentionCostFromPricing,
  getStorageRetentionCost,
} from '../src/helper/calculate-storage-retention-cost.js'

const pricing = {
  pricePerTiBPerMonthNoCDN: 1_000_000_000_000_000_000n,
  pricePerTiBCdnEgress: 0n,
  pricePerTiBCacheMissEgress: 0n,
  tokenAddress: /** @type {`0x${string}`} */ (
    '0x0000000000000000000000000000000000000000'
  ),
  minimumPricePerMonth: 100_000_000_000_000n,
  epochsPerMonth: 86_400n,
}

describe('storage retention cost helper', () => {
  beforeEach(() => {
    vi.mocked(getServicePrice).mockReset()
  })

  it('scales spend with months but keeps lockup unchanged', () => {
    const sixMonths = calculateStorageRetentionCostFromPricing(pricing, {
      sizeBytes: 5_000_000_000_000n,
      months: 6n,
      copies: 2,
    })
    const twelveMonths = calculateStorageRetentionCostFromPricing(pricing, {
      sizeBytes: 5_000_000_000_000n,
      months: 12n,
      copies: 2,
    })

    expect(twelveMonths.storageSpendTotal).toBe(
      sixMonths.storageSpendTotal * 2n
    )
    expect(twelveMonths.storageSpendPerCopy).toBe(
      sixMonths.storageSpendPerCopy * 2n
    )
    expect(twelveMonths.totalLockedInContract).toBe(
      sixMonths.totalLockedInContract
    )
    expect(twelveMonths.lockupPerCopy).toBe(sixMonths.lockupPerCopy)
  })

  it('scales totals with copies while keeping per-copy values stable', () => {
    const singleCopy = calculateStorageRetentionCostFromPricing(pricing, {
      sizeBytes: 5_000_000_000_000n,
      months: 12n,
      copies: 1,
    })
    const twoCopies = calculateStorageRetentionCostFromPricing(pricing, {
      sizeBytes: 5_000_000_000_000n,
      months: 12n,
      copies: 2,
    })

    expect(twoCopies.ratePerMonthPerCopy).toBe(singleCopy.ratePerMonthPerCopy)
    expect(twoCopies.lockupPerCopy).toBe(singleCopy.lockupPerCopy)
    expect(twoCopies.ratePerMonthTotal).toBe(singleCopy.ratePerMonthTotal * 2n)
    expect(twoCopies.storageSpendTotal).toBe(singleCopy.storageSpendTotal * 2n)
    expect(twoCopies.totalLockedInContract).toBe(
      singleCopy.totalLockedInContract * 2n
    )
  })

  it('returns a fully explained total', () => {
    const estimate = calculateStorageRetentionCostFromPricing(pricing, {
      sizeBytes: 5_000_000_000_000n,
      months: 12n,
      copies: 2,
    })

    expect(estimate.lockupPerCopy).toBe(
      estimate.rateLockupDeltaPerCopy +
        estimate.sybilFeePerCopy +
        estimate.cdnFixedLockupPerCopy
    )
    expect(estimate.totalLockedInContract).toBe(estimate.lockupPerCopy * 2n)
    expect(estimate.storageSpendTotal).toBe(estimate.ratePerMonthTotal * 12n)
    expect(estimate.recommendedAvailableForPeriod).toBe(
      estimate.totalLockedInContract + estimate.storageSpendTotal
    )
  })

  it('uses live pricing once in the async wrapper', async () => {
    vi.mocked(getServicePrice).mockResolvedValue(pricing)
    const client = createPublicClient({
      chain: calibration,
      transport: http('http://127.0.0.1:8545'),
    })

    const estimate = await getStorageRetentionCost(client, {
      sizeBytes: 5_000_000_000_000n,
      months: 12n,
      copies: 2,
    })

    expect(getServicePrice).toHaveBeenCalledWith(client)
    expect(estimate.recommendedAvailableForPeriod).toBe(
      estimate.totalLockedInContract + estimate.storageSpendTotal
    )
  })
})

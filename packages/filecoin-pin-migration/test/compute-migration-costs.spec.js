import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@filoz/synapse-core/pay', () => ({
  accounts: vi.fn(),
  isFwssMaxApproved: vi.fn(),
  calculateAccountDebt: vi.fn(),
  resolveAccountState: vi.fn(),
}))

vi.mock('@filoz/synapse-core/pdp-verifier', () => ({
  getDataSetSizes: vi.fn(),
}))

vi.mock('@filoz/synapse-core/warm-storage', () => ({
  calculateAdditionalLockupRequired: vi.fn(),
  calculateBufferAmount: vi.fn(),
  calculateEffectiveRate: vi.fn(),
  calculateRunwayAmount: vi.fn(),
  getServicePrice: vi.fn(),
}))

vi.mock('@filoz/synapse-core/utils', () => ({
  DEFAULT_BUFFER_EPOCHS: 1n,
  DEFAULT_RUNWAY_EPOCHS: 1n,
  LOCKUP_PERIOD: 1n,
}))

vi.mock('viem/actions', () => ({
  getBlockNumber: vi.fn(),
}))

import {
  accounts,
  isFwssMaxApproved,
  calculateAccountDebt,
  resolveAccountState,
} from '@filoz/synapse-core/pay'
import { getDataSetSizes } from '@filoz/synapse-core/pdp-verifier'
import {
  calculateAdditionalLockupRequired,
  calculateBufferAmount,
  calculateEffectiveRate,
  calculateRunwayAmount,
  getServicePrice,
} from '@filoz/synapse-core/warm-storage'
import { getBlockNumber } from 'viem/actions'
import { computeMigrationCosts } from '../src/planner/compute-migration-costs.js'
import { createMockInventory } from './helpers.js'

/**
 * @import * as API from '../src/api.js'
 */

describe('computeMigrationCosts', () => {
  beforeEach(() => {
    vi.mocked(accounts).mockResolvedValue(
      /** @type {any} */ ({
        funds: 0n,
        availableFunds: 0n,
        lockupCurrent: 0n,
        lockupRate: 0n,
        lockupLastSettledAt: 0n,
      })
    )
    vi.mocked(isFwssMaxApproved).mockResolvedValue(true)
    vi.mocked(calculateAccountDebt).mockReturnValue(0n)
    vi.mocked(resolveAccountState).mockReturnValue({
      availableFunds: 0n,
      fundedUntilEpoch: 0n,
    })
    vi.mocked(getDataSetSizes).mockResolvedValue([100n, 200n])
    vi.mocked(calculateAdditionalLockupRequired).mockReturnValue({
      total: 0n,
      sybilFee: 0n,
      cdnFixedLockup: 0n,
      rateLockupDelta: 0n,
      rateDeltaPerEpoch: 0n,
    })
    vi.mocked(calculateBufferAmount).mockReturnValue(0n)
    vi.mocked(calculateEffectiveRate).mockReturnValue({
      ratePerEpoch: 1n,
      ratePerMonth: 2n,
    })
    vi.mocked(calculateRunwayAmount).mockReturnValue(0n)
    vi.mocked(getServicePrice).mockResolvedValue({
      pricePerTiBPerMonthNoCDN: 1n,
      pricePerTiBCdnEgress: 0n,
      pricePerTiBCacheMissEgress: 0n,
      tokenAddress: /** @type {`0x${string}`} */ (
        '0x0000000000000000000000000000000000000000'
      ),
      minimumPricePerMonth: 1n,
      epochsPerMonth: 1n,
    })
    vi.mocked(getBlockNumber).mockResolvedValue(123n)
  })

  it('passes singular providerId and dataSetId when rebuilding resumed single contexts', async () => {
    const space = createMockInventory({
      did: /** @type {API.SpaceDID} */ ('did:key:z6MkResumeCostSpace1'),
      totalSizeToMigrate: 10n,
    })

    const createContext = vi
      .fn()
      .mockImplementationOnce(async (options) => ({
        provider: { id: 2n },
        serviceProvider: /** @type {`0x${string}`} */ (
          '0x0000000000000000000000000000000000000002'
        ),
        dataSetId: options.dataSetId,
        withCDN: options.withCDN,
      }))
      .mockImplementationOnce(async (options) => ({
        provider: { id: 4n },
        serviceProvider: /** @type {`0x${string}`} */ (
          '0x0000000000000000000000000000000000000004'
        ),
        dataSetId: options.dataSetId,
        withCDN: options.withCDN,
      }))

    const synapse = /** @type {API.Synapse} */ (
      /** @type {unknown} */ ({
        client: {
          account: {
            address: /** @type {`0x${string}`} */ (
              '0x0000000000000000000000000000000000000001'
            ),
          },
        },
        storage: {
          createContext,
        },
      })
    )

    const result = await computeMigrationCosts([space], synapse, {
      resumeState: {
        pinnedProviderIds: new Map([
          [
            space.did,
            new Map([
              [0, 2n],
              [1, 4n],
            ]),
          ],
        ]),
        existingDataSetIds: new Map([
          [
            space.did,
            new Map([
              [0, 13247n],
              [1, 13248n],
            ]),
          ],
        ]),
      },
    })

    expect(createContext).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        providerId: 2n,
        dataSetId: 13247n,
      })
    )
    expect(createContext.mock.calls[0][0]).not.toHaveProperty('providerIds')
    expect(createContext.mock.calls[0][0]).not.toHaveProperty('dataSetIds')

    expect(createContext).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        providerId: 4n,
        dataSetId: 13248n,
        excludeProviderIds: [2n],
      })
    )
    expect(createContext.mock.calls[1][0]).not.toHaveProperty('providerIds')
    expect(createContext.mock.calls[1][0]).not.toHaveProperty('dataSetIds')

    expect(result.perSpace[0].copies[0].dataSetId).toBe(13247n)
    expect(result.perSpace[0].copies[1].dataSetId).toBe(13248n)
    expect(result.perSpace[0].copies[0].providerId).toBe(2n)
    expect(result.perSpace[0].copies[1].providerId).toBe(4n)
  })
})

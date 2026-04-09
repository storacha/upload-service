import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMigrationPlan } from '../src/planner.js'
import { createMockInventory, createMockInventories } from './helpers.js'

/**
 * @import * as API from '../src/api.js'
 */

// Mock computeMigrationCosts so planner tests don't require a live Synapse SDK.
// Cost computation logic is tested separately in compute-migration-costs.spec.js.
vi.mock('../src/compute-migration-costs.js', () => ({
  computeMigrationCosts: vi.fn(),
}))

const { computeMigrationCosts } = await import('../src/compute-migration-costs.js')

/**
 * Build a minimal valid MigrationCostResult for mock use.
 *
 * @param {Partial<API.MigrationCostResult>} [overrides]
 * @returns {API.MigrationCostResult}
 */
function makeCostResult(overrides = {}) {
  return /** @type {API.MigrationCostResult} */ ({
    perSpace: [],
    summary: {
      totalBytes: 0n,
      totalLockupUSDFC: 0n,
      totalRatePerEpoch: 0n,
      totalRatePerMonth: 0n,
      debt: 0n,
      runway: 0n,
      buffer: 0n,
      availableFunds: 10_000n,
      skipBufferApplied: false,
      resumedSpaces: 0,
    },
    totalDepositNeeded: 0n,
    needsFwssMaxApproval: false,
    ready: true,
    warnings: [],
    ...overrides,
  })
}

/** Dummy synapse — never called because computeMigrationCosts is mocked. */
const mockSynapse = /** @type {API.Synapse} */ ({})

const makeConfig = () =>
  /** @type {API.MigrationConfig} */ ({
    storacha: { client: {} },
    foc: { synapse: {} },
    sourceURL: { strategy: 'claims' },
  })

beforeEach(() => {
  vi.mocked(computeMigrationCosts).mockResolvedValue(makeCostResult())
})

describe('createMigrationPlan', () => {
  it('returns correct totals from a single inventory', async () => {
    const inventories = createMockInventories(1)
    const plan = await createMigrationPlan(inventories, mockSynapse, makeConfig())

    expect(plan.totals.uploads).toBe(1)
    expect(plan.totals.shards).toBe(2)
    expect(plan.totals.bytes).toBe(1024n + 2048n)
  })

  it('aggregates totals across multiple spaces', async () => {
    const inventories = createMockInventories(3)
    const plan = await createMigrationPlan(inventories, mockSynapse, makeConfig())

    // 3 spaces x 1 upload x 2 shards
    expect(plan.totals.uploads).toBe(3)
    expect(plan.totals.shards).toBe(6)
    expect(plan.totals.bytes).toBe((1024n + 2048n) * 3n)
    expect(plan.spaces).toHaveLength(3)
  })

  it('carries over skipped shards per space', async () => {
    const inventories = [
      createMockInventory({
        did: /** @type {API.SpaceDID} */ ('did:key:z6MkSkipped1'),
        skippedShards: [{ cid: 'bafymissing', reason: 'MissingPieceCID' }],
      }),
    ]

    const plan = await createMigrationPlan(inventories, mockSynapse, makeConfig())

    expect(plan.spaces[0].skippedShards).toHaveLength(1)
    expect(plan.spaces[0].skippedShards[0].cid).toBe('bafymissing')
  })

  it('surfaces costs from computeMigrationCosts', async () => {
    vi.mocked(computeMigrationCosts).mockResolvedValue(
      makeCostResult({ totalDepositNeeded: 500n, ready: false })
    )

    const plan = await createMigrationPlan(
      createMockInventories(1),
      mockSynapse,
      makeConfig()
    )

    expect(plan.costs.totalDepositNeeded).toBe(500n)
    expect(plan.ready).toBe(false)
  })

  it('sets ready=true when costs.ready is true', async () => {
    const plan = await createMigrationPlan(
      createMockInventories(1),
      mockSynapse,
      makeConfig()
    )

    expect(plan.ready).toBe(true)
  })

  it('sets ready=false when deposit is needed', async () => {
    vi.mocked(computeMigrationCosts).mockResolvedValue(
      makeCostResult({ totalDepositNeeded: 500n, ready: false })
    )

    const plan = await createMigrationPlan(
      createMockInventories(1),
      mockSynapse,
      makeConfig()
    )

    expect(plan.ready).toBe(false)
    expect(plan.costs.totalDepositNeeded).toBe(500n)
  })

  it('sets ready=false when FWSS approval is needed', async () => {
    vi.mocked(computeMigrationCosts).mockResolvedValue(
      makeCostResult({ needsFwssMaxApproval: true, ready: false })
    )

    const plan = await createMigrationPlan(
      createMockInventories(1),
      mockSynapse,
      makeConfig()
    )

    expect(plan.ready).toBe(false)
    expect(plan.costs.needsFwssMaxApproval).toBe(true)
  })

  it('propagates warnings from costs and skipped shards', async () => {
    vi.mocked(computeMigrationCosts).mockResolvedValue(
      makeCostResult({
        ready: false,
        warnings: ['Deposit required', 'Approval needed'],
      })
    )

    const inventories = [
      createMockInventory({
        skippedShards: [{ cid: 'bafymissing', reason: 'MissingPieceCID' }],
      }),
    ]

    const plan = await createMigrationPlan(inventories, mockSynapse, makeConfig())

    expect(plan.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Deposit'),
        expect.stringContaining('Approval'),
        expect.stringContaining('skipped'),
      ])
    )
  })

  it('does not mutate input inventories', async () => {
    const inventories = createMockInventories(1)
    const originalURL = inventories[0].uploads[0].shards[0].sourceURL

    await createMigrationPlan(inventories, mockSynapse, makeConfig())

    expect(inventories[0].uploads[0].shards[0].sourceURL).toBe(originalURL)
  })
})

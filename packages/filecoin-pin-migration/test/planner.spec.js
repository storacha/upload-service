import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMigrationPlan } from '../src/planner.js'
import {
  createMockInventory,
  createMockInventories,
  createMockInitialState,
} from './helpers.js'

/**
 * @import * as API from '../src/api.js'
 */

// Mock computeMigrationCosts so planner tests don't require a live Synapse SDK.
// Cost computation logic is tested separately in compute-migration-costs.spec.js.
vi.mock('../src/compute-migration-costs.js', () => ({
  computeMigrationCosts: vi.fn(),
}))

import { computeMigrationCosts } from '../src/compute-migration-costs.js'

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
      resumedCopies: 0,
    },
    totalDepositNeeded: 0n,
    needsFwssMaxApproval: false,
    ready: true,
    warnings: [],
    ...overrides,
  })
}

/**
 * @param {Partial<API.PerCopyCost> & { copyIndex: number }} overrides
 * @returns {API.PerCopyCost}
 */
function makePerCopyCost(overrides) {
  return /** @type {API.PerCopyCost} */ ({
    copyIndex: overrides.copyIndex,
    spaceDID:
      overrides.spaceDID ??
      /** @type {API.SpaceDID} */ ('did:key:z6MkTestSpace1'),
    context: overrides.context ?? /** @type {API.StorageContext} */ ({}),
    providerId: overrides.providerId ?? 42n,
    serviceProvider:
      overrides.serviceProvider ?? /** @type {`0x${string}`} */ ('0xdeadbeef'),
    dataSetId: overrides.dataSetId ?? null,
    isResumed: overrides.isResumed ?? false,
    bytesToMigrate: overrides.bytesToMigrate ?? 0n,
    currentDataSetSize: overrides.currentDataSetSize ?? 0n,
    lockupUSDFC: overrides.lockupUSDFC ?? 0n,
    sybilFee: overrides.sybilFee ?? 0n,
    rateLockupDelta: overrides.rateLockupDelta ?? 0n,
    ratePerEpoch: overrides.ratePerEpoch ?? 0n,
    ratePerMonth: overrides.ratePerMonth ?? 0n,
  })
}

/**
 * Collect plan and events from the createMigrationPlan generator.
 *
 * @param {AsyncGenerator<API.MigrationEvent>} gen
 */
async function collectPlan(gen) {
  /** @type {API.MigrationPlan | undefined} */
  let plan
  /** @type {API.MigrationEvent[]} */
  const events = []
  for await (const event of gen) {
    events.push(event)
    if (event.type === 'planner:ready') plan = event.plan
  }
  if (!plan) throw new Error('planner:ready event was never yielded')
  return { plan, events }
}

/**
 * Populate state.spacesInventories from an array of inventories.
 *
 * @param {API.MigrationState} state
 * @param {API.SpaceInventory[]} inventories
 */
function withInventories(state, inventories) {
  for (const inv of inventories) {
    state.spacesInventories[inv.did] = inv
  }
  return state
}

/** Dummy synapse — never called because computeMigrationCosts is mocked. */
const mockSynapse = /** @type {API.Synapse} */ ({})

beforeEach(() => {
  vi.mocked(computeMigrationCosts).mockResolvedValue(makeCostResult())
})

describe('createMigrationPlan', () => {
  it('returns correct totals from a single inventory', async () => {
    const state = withInventories(
      createMockInitialState(),
      createMockInventories(1)
    )
    const { plan } = await collectPlan(
      createMigrationPlan({ synapse: mockSynapse, state })
    )

    expect(plan.totals.uploads).toBe(1)
    expect(plan.totals.shards).toBe(2)
    expect(plan.totals.bytes).toBe(1024n + 2048n)
  })

  it('aggregates totals across multiple spaces', async () => {
    const state = withInventories(
      createMockInitialState(),
      createMockInventories(3)
    )
    const { plan } = await collectPlan(
      createMigrationPlan({ synapse: mockSynapse, state })
    )

    // 3 spaces x 1 upload x 2 shards
    expect(plan.totals.uploads).toBe(3)
    expect(plan.totals.shards).toBe(6)
    expect(plan.totals.bytes).toBe((1024n + 2048n) * 3n)
  })

  it('surfaces skipped uploads as plan warnings', async () => {
    const inventory = createMockInventory({
      did: /** @type {API.SpaceDID} */ ('did:key:z6MkSkipped1'),
      skippedUploads: ['bafyroot1'],
    })
    const state = withInventories(createMockInitialState(), [inventory])

    const { plan } = await collectPlan(
      createMigrationPlan({ synapse: mockSynapse, state })
    )

    expect(plan.warnings).toHaveLength(1)
    expect(plan.warnings[0]).toContain('will be skipped')
  })

  it('surfaces costs from computeMigrationCosts', async () => {
    vi.mocked(computeMigrationCosts).mockResolvedValue(
      makeCostResult({ totalDepositNeeded: 500n, ready: false })
    )

    const state = withInventories(
      createMockInitialState(),
      createMockInventories(1)
    )
    const { plan } = await collectPlan(
      createMigrationPlan({ synapse: mockSynapse, state })
    )

    expect(plan.costs.totalDepositNeeded).toBe(500n)
    expect(plan.ready).toBe(false)
  })

  it('sets ready=true when costs.ready is true', async () => {
    const state = withInventories(
      createMockInitialState(),
      createMockInventories(1)
    )
    const { plan } = await collectPlan(
      createMigrationPlan({ synapse: mockSynapse, state })
    )

    expect(plan.ready).toBe(true)
  })

  it('sets ready=false when deposit is needed', async () => {
    vi.mocked(computeMigrationCosts).mockResolvedValue(
      makeCostResult({ totalDepositNeeded: 500n, ready: false })
    )

    const state = withInventories(
      createMockInitialState(),
      createMockInventories(1)
    )
    const { plan } = await collectPlan(
      createMigrationPlan({ synapse: mockSynapse, state })
    )

    expect(plan.ready).toBe(false)
    expect(plan.costs.totalDepositNeeded).toBe(500n)
  })

  it('sets ready=false when FWSS approval is needed', async () => {
    vi.mocked(computeMigrationCosts).mockResolvedValue(
      makeCostResult({ needsFwssMaxApproval: true, ready: false })
    )

    const state = withInventories(
      createMockInitialState(),
      createMockInventories(1)
    )
    const { plan } = await collectPlan(
      createMigrationPlan({ synapse: mockSynapse, state })
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

    const inventory = createMockInventory({
      skippedUploads: ['bafyroot1'],
    })
    const state = withInventories(createMockInitialState(), [inventory])

    const { plan } = await collectPlan(
      createMigrationPlan({ synapse: mockSynapse, state })
    )

    expect(plan.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Deposit'),
        expect.stringContaining('Approval'),
        expect.stringContaining('will be skipped'),
      ])
    )
  })

  it('yields state:checkpoint before planner:ready', async () => {
    const state = withInventories(
      createMockInitialState(),
      createMockInventories(1)
    )
    const { events } = await collectPlan(
      createMigrationPlan({ synapse: mockSynapse, state })
    )

    expect(events).toHaveLength(2)
    expect(events[0].type).toBe('state:checkpoint')
    expect(events[1].type).toBe('planner:ready')
  })

  it('sets state.phase to approved and writes SP bindings', async () => {
    const spaceDID = /** @type {API.SpaceDID} */ ('did:key:z6MkTestSpace1')
    vi.mocked(computeMigrationCosts).mockResolvedValue(
      makeCostResult({
        perSpace: [
          /** @type {API.PerSpaceCost} */ ({
            spaceDID,
            copies: [
              makePerCopyCost({
                copyIndex: 0,
                spaceDID,
                providerId: 42n,
                serviceProvider: /** @type {`0x${string}`} */ ('0xdeadbeef'),
              }),
              makePerCopyCost({
                copyIndex: 1,
                spaceDID,
                providerId: 43n,
                serviceProvider: /** @type {`0x${string}`} */ ('0xbeefdead'),
              }),
            ],
            bytesToMigrate: 0n,
            currentDataSetSize: 0n,
            lockupUSDFC: 0n,
            sybilFee: 0n,
            rateLockupDelta: 0n,
            ratePerEpoch: 0n,
            ratePerMonth: 0n,
            isResumed: false,
          }),
        ],
      })
    )

    const state = withInventories(createMockInitialState(), [
      createMockInventory({ did: spaceDID }),
    ])
    await collectPlan(createMigrationPlan({ synapse: mockSynapse, state }))

    expect(state.phase).toBe('approved')
    expect(state.spaces[spaceDID]).toBeDefined()
    expect(state.spaces[spaceDID].copies).toHaveLength(2)
    expect(state.spaces[spaceDID].copies[0].providerId).toBe(42n)
    expect(state.spaces[spaceDID].copies[0].serviceProvider).toBe('0xdeadbeef')
    expect(state.spaces[spaceDID].copies[1].providerId).toBe(43n)
    expect(state.spaces[spaceDID].copies[1].serviceProvider).toBe('0xbeefdead')
  })

  it('does not mutate inventories in state', async () => {
    const inventory = createMockInventory({})
    const state = withInventories(createMockInitialState(), [inventory])
    const originalURL = inventory.shards[0].sourceURL

    await collectPlan(createMigrationPlan({ synapse: mockSynapse, state }))

    expect(state.spacesInventories[inventory.did].shards[0].sourceURL).toBe(
      originalURL
    )
  })
})

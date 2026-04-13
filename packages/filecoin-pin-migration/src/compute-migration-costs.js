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
import {
  DEFAULT_BUFFER_EPOCHS,
  DEFAULT_RUNWAY_EPOCHS,
  LOCKUP_PERIOD,
} from '@filoz/synapse-core/utils'
import { getBlockNumber } from 'viem/actions'

/**
 * @import * as API from './api.js'
 */

const DATASET_METADATA_BASE = Object.freeze({
  source: 'storacha-migration',
  withIPFSIndexing: '',
})

/**
 * Aggregate per-space upload costs into a single account-level deposit.
 *
 * Mirrors `synapse.storage.calculateMultiContextCosts` (manager.ts:686-810) but
 * loops over heterogeneous per-space sizes — `calculateMultiContextCosts`
 * applies one `dataSize` to every context, which is wrong for a Storacha
 * migration where each space has a different total size.
 *
 * Returns:
 *  - `perSpace[]` — display values + the live StorageContext for the migrator
 *  - `summary` — account-level breakdown for UI
 *  - `totalDepositNeeded` — single fundSync amount
 *  - `needsFwssMaxApproval` — pass through to fundSync
 *
 * Resume contract: passing `resumeState.pinnedProviderIds` forces the SDK to
 * bind every space to the same SP across runs (the lockup is earmarked there).
 * Passing `resumeState.existingDataSetIds` binds to a previously-committed
 * dataset so floor-aware rate deltas are computed correctly.
 *
 * Fail-fast on createContext rejection: a plan with a silently missing space is
 * a trap that lets users approve a partial migration.
 *
 * @param {API.SpaceInventory[]} spaces
 * @param {API.Synapse} synapse
 * @param {object} [opts]
 * @param {API.ResumeState} [opts.resumeState]
 * @param {bigint[]} [opts.configuredProviderIds] - From config.foc.providerIds. Pinned wins on conflict.
 * @returns {Promise<API.MigrationCostResult>}
 */
export async function computeMigrationCosts(spaces, synapse, opts = {}) {
  const { resumeState, configuredProviderIds } = opts
  const client = synapse.client
  const address = client.account.address
  const pinnedProviderIds = resumeState?.pinnedProviderIds
  const existingDataSetIds = resumeState?.existingDataSetIds

  /** @type {string[]} */
  const warnings = [
    'Funding is irreversible. Verify source URLs are reachable before approving — if all commits fail permanently, deposited USDFC is locked until the rail period ends.',
  ]

  // ── Step 1: Resolve/create one StorageContext per space ───────────────────
  // Fail-fast: if any createContext rejects, the whole plan fails with a clear
  // error naming the space. A plan with a silently missing space is a trap.
  const contexts = await Promise.all(
    spaces.map(async (space) => {
      const pinned = pinnedProviderIds?.get(space.did)
      const existingDataSet = existingDataSetIds?.get(space.did)

      // Conflict rule: pinned always wins. The pinned SP holds the lockup
      // from the prior funding tx and cannot be changed without forfeiting it.
      if (
        pinned != null &&
        configuredProviderIds?.length &&
        !configuredProviderIds.includes(pinned)
      ) {
        warnings.push(
          `${space.did}: configured providerIds conflict with pinned providerId ${pinned} from a prior run; pinned wins.`
        )
      }

      const providerIds =
        pinned != null
          ? [pinned]
          : configuredProviderIds?.length
          ? configuredProviderIds
          : undefined

      /** @type {import('@filoz/synapse-sdk').StorageServiceOptions} */
      const options = {
        metadata: {
          ...DATASET_METADATA_BASE,
          space: space.did,
          // TODO: add space name
        },
        ...(providerIds && { providerIds }),
        ...(existingDataSet != null && { dataSetIds: [existingDataSet] }),
      }

      try {
        return await synapse.storage.createContext(options)
      } catch (err) {
        throw new Error(
          `Failed to create context for space ${space.did}: ${
            err instanceof Error ? err.message : String(err)
          }`
        )
      }
    })
  )

  // ── Step 2: Collect existing dataset IDs for on-chain size lookup ─────────
  const existingIds = contexts
    .map((c) => c.dataSetId)
    .filter(
      /** @returns {id is bigint} @param {bigint | undefined} id */ (id) =>
        id != null
    )

  // ── Step 3: Single parallel chain batch (shared across all spaces) ────────
  const [accountInfo, pricing, approved, currentEpoch, sizes] =
    await Promise.all([
      accounts(client, { address }),
      getServicePrice(client),
      isFwssMaxApproved(client, { clientAddress: address }),
      getBlockNumber(client, { cacheTime: 0 }),
      existingIds.length > 0
        ? getDataSetSizes(client, { dataSetIds: existingIds })
        : Promise.resolve(/** @type {bigint[]} */ ([])),
    ])

  /** @type {Map<bigint, bigint>} */
  const dataSetSizes = new Map()
  existingIds.forEach((id, i) => dataSetSizes.set(id, sizes[i]))

  // ── Step 4: Per-space loop (pure) ─────────────────────────────────────────
  let totalLockup = 0n
  let totalRateDelta = 0n
  let totalRatePerEpoch = 0n
  let totalRatePerMonth = 0n
  let totalBytes = 0n
  let resumedSpaces = 0

  /** @type {API.PerSpaceCost[]} */
  const perSpace = spaces.map((space, i) => {
    const ctx = contexts[i]
    const isNewDataSet = ctx.dataSetId == null
    const currentDataSetSize = isNewDataSet
      ? 0n
      : dataSetSizes.get(/** @type {bigint} */ (ctx.dataSetId)) ?? 0n

    const lockup = calculateAdditionalLockupRequired({
      dataSize: space.totalBytes,
      currentDataSetSize,
      pricePerTiBPerMonth: pricing.pricePerTiBPerMonthNoCDN,
      minimumPricePerMonth: pricing.minimumPricePerMonth,
      epochsPerMonth: pricing.epochsPerMonth,
      lockupEpochs: LOCKUP_PERIOD,
      isNewDataSet,
      // Read withCDN from the live context — single source of truth, matches
      // manager.ts:749. Hard-coding `false` would silently miscompute on
      // CDN-enabled spaces.
      withCDN: ctx.withCDN,
    })

    totalLockup += lockup.total
    totalRateDelta += lockup.rateDeltaPerEpoch
    totalBytes += space.totalBytes
    if (!isNewDataSet) resumedSpaces++

    // Display rate is for the post-migration TOTAL size, not the delta.
    const totalSize = currentDataSetSize + space.totalBytes
    const rate = calculateEffectiveRate({
      sizeInBytes: totalSize,
      pricePerTiBPerMonth: pricing.pricePerTiBPerMonthNoCDN,
      minimumPricePerMonth: pricing.minimumPricePerMonth,
      epochsPerMonth: pricing.epochsPerMonth,
    })
    totalRatePerEpoch += rate.ratePerEpoch
    totalRatePerMonth += rate.ratePerMonth

    return {
      spaceDID: space.did,
      context: ctx,
      providerId: ctx.provider.id,
      serviceProvider: ctx.serviceProvider,
      dataSetId: ctx.dataSetId ?? null,
      isResumed: !isNewDataSet,
      bytesToMigrate: space.totalBytes,
      currentDataSetSize,
      lockupUSDFC: lockup.total,
      sybilFee: lockup.sybilFee,
      rateLockupDelta: lockup.rateLockupDelta,
      ratePerEpoch: rate.ratePerEpoch,
      ratePerMonth: rate.ratePerMonth,
    }
  })

  // ── Step 5: Account-level math (once) ─────────────────────────────────────
  const accountParams = {
    funds: accountInfo.funds,
    lockupCurrent: accountInfo.lockupCurrent,
    lockupRate: accountInfo.lockupRate,
    lockupLastSettledAt: accountInfo.lockupLastSettledAt,
    currentEpoch,
  }
  const debt = calculateAccountDebt(accountParams)
  const { availableFunds, fundedUntilEpoch } =
    resolveAccountState(accountParams)

  const netRateAfterUpload = accountInfo.lockupRate + totalRateDelta
  const runway = calculateRunwayAmount({
    netRateAfterUpload,
    extraRunwayEpochs: DEFAULT_RUNWAY_EPOCHS,
  })

  const rawDepositNeeded = totalLockup + runway + debt - availableFunds

  // skipBuffer: mirrors manager.ts:787-793. Safe only when no existing rails
  // are draining funds AND every context is a new dataset (no pre-existing
  // rate locked in). On resume, any context with dataSetId != null means a
  // rail already exists, so skipBuffer naturally evaluates to false.
  const allNewDatasets = contexts.every((c) => c.dataSetId == null)
  const skipBuffer = accountInfo.lockupRate === 0n && allNewDatasets

  const buffer = skipBuffer
    ? 0n
    : calculateBufferAmount({
        rawDepositNeeded,
        netRateAfterUpload,
        fundedUntilEpoch,
        currentEpoch,
        availableFunds,
        bufferEpochs: DEFAULT_BUFFER_EPOCHS,
      })

  const clamped = rawDepositNeeded > 0n ? rawDepositNeeded : 0n
  const totalDepositNeeded = clamped + buffer

  return {
    perSpace,
    summary: {
      totalBytes,
      totalLockupUSDFC: totalLockup,
      totalRatePerEpoch,
      totalRatePerMonth,
      debt,
      runway,
      buffer,
      availableFunds,
      skipBufferApplied: skipBuffer,
      resumedSpaces,
    },
    totalDepositNeeded,
    needsFwssMaxApproval: !approved,
    ready: totalDepositNeeded === 0n && approved,
    warnings,
  }
}

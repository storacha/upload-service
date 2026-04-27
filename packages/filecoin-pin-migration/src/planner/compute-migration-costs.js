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
 * @import * as API from '../api.js'
 */

const DATASET_METADATA_BASE = Object.freeze({
  source: 'storacha-migration',
  withIPFSIndexing: '',
})
const REQUIRED_COPIES = 2

/**
 * @param {API.SpaceDID} spaceDID
 * @param {bigint[] | undefined} configuredProviderIds
 * @returns {[bigint | undefined, bigint | undefined]}
 */
function resolveConfiguredCopyProviders(spaceDID, configuredProviderIds) {
  if (configuredProviderIds && configuredProviderIds.length < REQUIRED_COPIES) {
    throw new Error(
      `At least ${REQUIRED_COPIES} distinct providerIds are required to enforce ${REQUIRED_COPIES} copies per space`
    )
  }
  return [configuredProviderIds?.[0], configuredProviderIds?.[1]]
}

/**
 * @param {API.SpaceInventory} space
 * @param {number} copyIndex
 * @param {API.Synapse} synapse
 * @param {bigint | undefined} providerId
 * @param {bigint | undefined} existingDataSetId
 * @param {bigint[] | undefined} excludeProviderIds
 * @returns {Promise<API.PerCopyCost['context']>}
 */
async function createCopyContext(
  space,
  copyIndex,
  synapse,
  providerId,
  existingDataSetId,
  excludeProviderIds
) {
  /** @type {import('@filoz/synapse-sdk').StorageServiceOptions} */
  const options = {
    metadata: {
      ...DATASET_METADATA_BASE,
      'space-did': space.did,
      ...(space.name && { 'space-name': space.name.slice(0, 100) }), // limiting name to 100 chars to avoid hitting metadata size limit
      //copy: String(copyIndex), // TODO: check with team if this is needed
    },
    ...(providerId != null && { providerIds: [providerId] }),
    ...(existingDataSetId != null && { dataSetIds: [existingDataSetId] }),
    ...(excludeProviderIds?.length && { excludeProviderIds }),
  }

  try {
    return await synapse.storage.createContext(options)
  } catch (err) {
    throw new Error(
      `Failed to create context for space ${space.did} copy ${copyIndex}: ${
        err instanceof Error ? err.message : String(err)
      }`
    )
  }
}

/**
 * Aggregate per-space upload costs into a single account-level deposit.
 *
 * Mirrors `synapse.storage.calculateMultiContextCosts` (manager.ts:686-810) but
 * loops over heterogeneous per-space sizes — `calculateMultiContextCosts`
 * applies one `dataSize` to every context, which is wrong for a Storacha
 * migration where each space has a different total size.
 *
 * Returns:
 *  - `perSpace[]` — display values + the live StorageContext handles for the migrator
 *  - `summary` — account-level breakdown for UI
 *  - `totalDepositNeeded` — single fundSync amount
 *  - `needsFwssMaxApproval` — pass through to fundSync
 *
 * Resume contract: passing `resumeState.pinnedProviderIds` forces the SDK to
 * bind every space copy to the same SP across runs. Passing
 * `resumeState.existingDataSetIds` binds each copy to its existing on-chain
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
  const warnings = []

  // ── Step 1: Resolve/create two StorageContexts per space ──────────────────
  // Fail-fast: if any createContext rejects, the whole plan fails with a clear
  // error naming the space. A plan with a silently missing space is a trap.
  const contextsBySpace = await Promise.all(
    spaces.map(async (space) => {
      const pinned = pinnedProviderIds?.get(space.did)
      const existingDataSets = existingDataSetIds?.get(space.did)
      const [configuredPrimaryProviderId, configuredSecondaryProviderId] =
        resolveConfiguredCopyProviders(space.did, configuredProviderIds)
      const pinnedPrimaryProviderId = pinned?.get(0)
      const pinnedSecondaryProviderId = pinned?.get(1)

      if (
        pinnedPrimaryProviderId != null &&
        configuredPrimaryProviderId != null &&
        pinnedPrimaryProviderId !== configuredPrimaryProviderId
      ) {
        warnings.push(
          `${space.did}: configured providerIds conflict with pinned providerId ${pinnedPrimaryProviderId} for copy 0; pinned wins.`
        )
      }
      if (
        pinnedSecondaryProviderId != null &&
        configuredSecondaryProviderId != null &&
        pinnedSecondaryProviderId !== configuredSecondaryProviderId
      ) {
        warnings.push(
          `${space.did}: configured providerIds conflict with pinned providerId ${pinnedSecondaryProviderId} for copy 1; pinned wins.`
        )
      }

      const primaryContext = await createCopyContext(
        space,
        0,
        synapse,
        pinnedPrimaryProviderId ?? configuredPrimaryProviderId,
        existingDataSets?.get(0),
        undefined
      )
      const secondaryContext = await createCopyContext(
        space,
        1,
        synapse,
        pinnedSecondaryProviderId ?? configuredSecondaryProviderId,
        existingDataSets?.get(1),
        [primaryContext.provider.id]
      )

      if (primaryContext.provider.id === secondaryContext.provider.id) {
        throw new Error(
          `${space.did}: expected ${REQUIRED_COPIES} distinct providers, got the same provider twice`
        )
      }

      return [
        { context: primaryContext, copyIndex: 0 },
        { context: secondaryContext, copyIndex: 1 },
      ]
    })
  )

  // ── Step 2: Collect existing dataset IDs for on-chain size lookup ─────────
  const existingIds = contextsBySpace
    .flatMap((copies) => copies.map((copy) => copy.context.dataSetId))
    .filter(
      /**
       * @param {bigint | undefined} id
       * @returns {id is bigint}
       */
      (id) => id != null
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
  let resumedCopies = 0

  /** @type {API.PerSpaceCost[]} */
  const perSpace = spaces.map((space, i) => {
    const copyContexts = contextsBySpace[i]
    const bytesToMigrate = space.totalSizeToMigrate

    /** @type {API.PerCopyCost[]} */
    const copyCosts = copyContexts.map(({ context, copyIndex }) => {
      const isNewDataSet = context.dataSetId == null
      const currentDataSetSize = isNewDataSet
        ? 0n
        : dataSetSizes.get(/** @type {bigint} */ (context.dataSetId)) ?? 0n

      const lockup = calculateAdditionalLockupRequired({
        dataSize: bytesToMigrate,
        currentDataSetSize,
        pricePerTiBPerMonth: pricing.pricePerTiBPerMonthNoCDN,
        minimumPricePerMonth: pricing.minimumPricePerMonth,
        epochsPerMonth: pricing.epochsPerMonth,
        lockupEpochs: LOCKUP_PERIOD,
        isNewDataSet,
        withCDN: context.withCDN,
      })

      const totalSize = currentDataSetSize + bytesToMigrate
      const rate = calculateEffectiveRate({
        sizeInBytes: totalSize,
        pricePerTiBPerMonth: pricing.pricePerTiBPerMonthNoCDN,
        minimumPricePerMonth: pricing.minimumPricePerMonth,
        epochsPerMonth: pricing.epochsPerMonth,
      })

      totalLockup += lockup.total
      totalRateDelta += lockup.rateDeltaPerEpoch
      totalRatePerEpoch += rate.ratePerEpoch
      totalRatePerMonth += rate.ratePerMonth
      totalBytes += bytesToMigrate
      if (!isNewDataSet) resumedCopies++

      return {
        copyIndex,
        spaceDID: space.did,
        context,
        providerId: context.provider.id,
        serviceProvider: context.serviceProvider,
        dataSetId: context.dataSetId ?? null,
        isResumed: !isNewDataSet,
        bytesToMigrate,
        currentDataSetSize,
        lockupUSDFC: lockup.total,
        sybilFee: lockup.sybilFee,
        rateLockupDelta: lockup.rateLockupDelta,
        ratePerEpoch: rate.ratePerEpoch,
        ratePerMonth: rate.ratePerMonth,
      }
    })

    const [copy0, copy1] = copyCosts
    return {
      spaceDID: space.did,
      copies: /** @type {[API.PerCopyCost, API.PerCopyCost]} */ ([
        copy0,
        copy1,
      ]),
      isResumed: copyCosts.some((copy) => copy.isResumed),
      bytesToMigrate,
      currentDataSetSize: copyCosts.reduce(
        (sum, copy) => sum + copy.currentDataSetSize,
        0n
      ),
      lockupUSDFC: copyCosts.reduce((sum, copy) => sum + copy.lockupUSDFC, 0n),
      sybilFee: copyCosts.reduce((sum, copy) => sum + copy.sybilFee, 0n),
      rateLockupDelta: copyCosts.reduce(
        (sum, copy) => sum + copy.rateLockupDelta,
        0n
      ),
      ratePerEpoch: copyCosts.reduce(
        (sum, copy) => sum + copy.ratePerEpoch,
        0n
      ),
      ratePerMonth: copyCosts.reduce(
        (sum, copy) => sum + copy.ratePerMonth,
        0n
      ),
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
  const allNewDatasets = contextsBySpace.every((copies) =>
    copies.every((copy) => copy.context.dataSetId == null)
  )
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
      resumedCopies,
    },
    totalDepositNeeded,
    needsFwssMaxApproval: !approved,
    ready: totalDepositNeeded === 0n && approved,
    warnings,
  }
}

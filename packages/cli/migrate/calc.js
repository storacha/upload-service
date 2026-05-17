import process from 'node:process'
import { createPublicClient, http } from 'viem'
import { getStorageRetentionCost } from '@storacha/filecoin-pin-migration/helpers'
import { parseMigrationCalcOptions } from './options.js'
import {
  renderStorageRetentionCostEstimate,
  renderStorageRetentionCostPricingNote,
} from './view/preflight.js'

const DEFAULT_STORAGE_RETENTION_COPIES = 2

/**
 * Estimate the cost of retaining a fixed amount of data for a fixed number of
 * months using the live warm-storage price for the selected network.
 *
 * @typedef {object} SpaceMigrateCalcOptions
 * @property {string} [network]
 * @property {bigint | number | string} [size]
 * @property {bigint | number | string} [months]
 */

/**
 * @param {SpaceMigrateCalcOptions} opts
 */
export async function spaceMigrateCalc(opts = {}) {
  const config = parseMigrationCalcOptions(opts)

  try {
    const client = createPublicClient({
      chain: config.network,
      transport: http(),
    })

    const estimate = await getStorageRetentionCost(client, {
      sizeBytes: config.sizeBytes,
      months: config.months,
      copies: DEFAULT_STORAGE_RETENTION_COPIES,
      withCDN: true,
      isNewDataSet: true,
      currentDataSetSize: 0n,
    })

    console.log('')
    console.log(
      renderStorageRetentionCostEstimate({
        sizeBytes: config.sizeBytes,
        months: config.months,
        copies: DEFAULT_STORAGE_RETENTION_COPIES,
        estimate,
        networkName: config.network.name,
      })
    )
    console.log(renderStorageRetentionCostPricingNote({ estimate }))
    console.log('')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Error: failed to calculate storage cost - ${message}`)
    process.exit(1)
  }
}

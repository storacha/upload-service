import process from 'node:process'
import { mainnet, calibration } from '@filoz/synapse-sdk'

/**
 * @typedef {object} MigrationCliOptions
 * @property {string} [network]
 * @property {boolean} [resume]
 * @property {boolean} [retry]
 * @property {boolean} [debug]
 * @property {string} [stateFormat]
 * @property {string} [selectedRootsFile]
 * @property {boolean} [nonInteractive]
 */

/**
 * @typedef {object} MigrationCalcCliOptions
 * @property {string} [network]
 * @property {bigint | number | string} [size]
 * @property {bigint | number | string} [months]
 */

/**
 * @param {MigrationCliOptions} opts
 */
export function parseMigrationOptions(opts) {
  const { readerOptions, readerOverrideEntries } = parseReaderOverridesFromEnv()
  const stateFormat = parseStateFormat(opts.stateFormat)

  return {
    network: parseNetwork(opts.network),
    stateFormat,
    resume: opts.resume ?? false,
    retry: opts.retry ?? false,
    debug: opts.debug ?? false,
    selectedRootsFile: opts.selectedRootsFile,
    nonInteractive: opts.nonInteractive ?? false,
    readerOptions,
    readerOverrideEntries,
  }
}

/**
 * @param {string | undefined} stateFormat
 * @returns {'json' | 'sqlite' | undefined}
 */
function parseStateFormat(stateFormat) {
  if (stateFormat == null || stateFormat === '') {
    return undefined
  }

  if (stateFormat === 'json' || stateFormat === 'sqlite') {
    return stateFormat
  }

  console.error(
    `Error: invalid state format "${stateFormat}". Expected "json" or "sqlite".`
  )
  process.exit(1)
}

/**
 * @param {MigrationCalcCliOptions} opts
 */
export function parseMigrationCalcOptions(opts) {
  return {
    network: parseNetwork(opts.network),
    sizeBytes: parsePositiveBigInt(opts.size, '--size'),
    months: parsePositiveBigInt(opts.months, '--months'),
  }
}

/**
 * @param {bigint | number | string | undefined} value
 * @param {string} flag
 */
function parsePositiveBigInt(value, flag) {
  if (value == null || value === '') {
    console.error(`Error: missing required option "${flag}"`)
    process.exit(1)
  }

  try {
    const parsed =
      typeof value === 'bigint'
        ? value
        : typeof value === 'number'
          ? BigInt(value)
          : BigInt(value)

    if (parsed > 0n) {
      return parsed
    }
  } catch {
    // Ignore parse failure and fall through to the common validation error.
  }

  console.error(`Error: "${flag}" must be a positive integer`)
  process.exit(1)
}

function parseReaderOverridesFromEnv() {
  /** @type {NonNullable<import('@storacha/filecoin-pin-migration/types').BuildInventoriesInput['options']>} */
  const readerOptions = {}
  /** @type {Array<[string, number | boolean]>} */
  const readerOverrideEntries = []

  setReaderOverrideFromEnv(
    readerOptions,
    readerOverrideEntries,
    'uploadPageSize',
    'STORACHA_MIGRATE_UPLOAD_PAGE_SIZE'
  )
  setReaderOverrideFromEnv(
    readerOptions,
    readerOverrideEntries,
    'shardListConcurrency',
    'STORACHA_MIGRATE_SHARD_LIST_CONCURRENCY'
  )
  setReaderOverrideFromEnv(
    readerOptions,
    readerOverrideEntries,
    'checkpointEveryPages',
    'STORACHA_MIGRATE_CHECKPOINT_EVERY_PAGES'
  )
  setReaderOverrideFromEnv(
    readerOptions,
    readerOverrideEntries,
    'queryClaimsBatchConcurrency',
    'STORACHA_MIGRATE_QUERYCLAIMS_BATCH_CONCURRENCY'
  )
  setReaderBoolOverrideFromEnv(
    readerOptions,
    readerOverrideEntries,
    'skipIPNIFallback',
    'STORACHA_MIGRATE_SKIP_IPNI_FALLBACK'
  )

  return { readerOptions, readerOverrideEntries }
}

/**
 * @param {NonNullable<import('@storacha/filecoin-pin-migration/types').BuildInventoriesInput['options']>} readerOptions
 * @param {Array<[string, number | boolean]>} readerOverrideEntries
 * @param {'uploadPageSize' | 'shardListConcurrency' | 'checkpointEveryPages' | 'queryClaimsBatchConcurrency'} optionKey
 * @param {string} envVar
 */
function setReaderOverrideFromEnv(
  readerOptions,
  readerOverrideEntries,
  optionKey,
  envVar
) {
  const raw = process.env[envVar]
  if (raw == null || raw === '') return

  const value = parsePositiveInteger(raw, envVar)
  readerOptions[optionKey] = value
  readerOverrideEntries.push([optionKey, value])
}

/**
 * @param {NonNullable<import('@storacha/filecoin-pin-migration/types').BuildInventoriesInput['options']>} readerOptions
 * @param {Array<[string, number | boolean]>} readerOverrideEntries
 * @param {'skipIPNIFallback'} optionKey
 * @param {string} envVar
 */
function setReaderBoolOverrideFromEnv(
  readerOptions,
  readerOverrideEntries,
  optionKey,
  envVar
) {
  const raw = process.env[envVar]
  if (raw == null || raw === '') return

  const normalized = raw.trim().toLowerCase()
  if (!['1', 'true', 'yes', '0', 'false', 'no'].includes(normalized)) {
    console.error(
      `Error: "${envVar}" must be a boolean (1/0, true/false, yes/no)`
    )
    process.exit(1)
  }

  const value = ['1', 'true', 'yes'].includes(normalized)
  readerOptions[optionKey] = value
  readerOverrideEntries.push([optionKey, value])
}

/**
 * @param {bigint | number | string | undefined} value
 * @param {string} label
 */
function parsePositiveInteger(value, label) {
  if (value == null || value === '') {
    console.error(`Error: missing required value for "${label}"`)
    process.exit(1)
  }

  if (typeof value === 'number') {
    if (Number.isSafeInteger(value) && value > 0) {
      return value
    }

    console.error(`Error: "${label}" must be a positive integer`)
    process.exit(1)
  }

  const raw = String(value).trim()
  if (!/^\d+$/.test(raw)) {
    console.error(`Error: "${label}" must be a positive integer`)
    process.exit(1)
  }

  const parsed = Number(raw)

  if (Number.isSafeInteger(parsed) && parsed > 0) {
    return parsed
  }

  console.error(`Error: "${label}" must be a positive integer`)
  process.exit(1)
}

/**
 * @param {Array<[string, number | boolean]>} entries
 */
export function formatReaderOverrideEntries(entries) {
  return entries.map(([key, value]) => `${key}=${value}`).join(', ')
}

/**
 * @param {string | undefined} network
 */
function parseNetwork(network) {
  if (network == null || network === '' || network === 'mainnet') {
    return mainnet
  }

  if (network === 'calibration') {
    return calibration
  }

  console.error(
    `Error: invalid network "${network}". Expected "mainnet" or "calibration".`
  )
  process.exit(1)
}

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { confirm } from '@inquirer/prompts'
import { Synapse } from '@filoz/synapse-sdk'
import {
  createInitialState,
  buildMigrationInventories,
  createMigrationPlan,
  executeMigration,
  createResolver,
  serializeState,
  deserializeState,
} from '@storacha/filecoin-pin-migration'
import { privateKeyToAccount } from 'viem/accounts'
import { filesize } from './lib.js'
import { getClient } from './lib.js'

const DEFAULT_BATCH_SIZE = 50
const DEFAULT_SOURCE_STRATEGY = 'roundabout'
const DEFAULT_STATE_FILE_BASENAME = 'storacha-migration'
const CLI_SOURCE = 'storacha-cli'

/**
 * Migrate the current selected space to Filecoin on Chain.
 *
 * @typedef {object} SpaceMigrateOptions
 * @property {string} [walletPk]
 * @property {string} [stateFile]
 * @property {boolean} [resume]
 * @property {number|string} [batchSize]
 * @property {number|string} [pullConcurrency]
 * @property {boolean} [stopOnError]
 * @property {string} [sourceStrategy]
 * @property {string} [roundaboutURL]
 * @property {boolean} [autoApprove]
 */

/**
 * Migrate the current selected space to Filecoin on Chain.
 *
 * @param {SpaceMigrateOptions} opts
 */
export async function spaceMigrate(opts = {}) {
  const walletPk = opts.walletPk
  const batchSize = parseBatchSize(opts.batchSize)
  const pullConcurrency = parsePositiveInteger(
    opts.pullConcurrency,
    '--pull-concurrency'
  )
  const sourceStrategy = parseSourceStrategy(opts.sourceStrategy)

  let account
  try {
    account = privateKeyToAccount(/** @type {`0x${string}`} */ (walletPk))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Error: invalid wallet private key - ${message}`)
    process.exit(1)
  }

  const client = await getClient()
  const currentSpace = client.currentSpace()
  if (!currentSpace) {
    console.error(
      'Error: no current space, use "space create" to create one or select one using "space use"'
    )
    process.exit(1)
  }

  const spaceDID = currentSpace.did()
  const stateFile = path.resolve(
    opts.stateFile ?? defaultStateFileForSpace(spaceDID)
  )
  const stopOnError = opts.stopOnError ?? true
  const resume = opts.resume ?? false
  const autoApprove = opts.autoApprove ?? false
  const resolver = createResolver({
    strategy: sourceStrategy,
    roundaboutURL: opts.roundaboutURL,
  })
  const synapse = Synapse.create({
    account,
    source: CLI_SOURCE,
  })
  const state = resume ? loadStateOrExit(stateFile) : createInitialState()

  const ac = new AbortController()
  let stopRequested = false
  const onSigint = () => {
    if (stopRequested) return
    stopRequested = true
    console.log('\nStopping after the current step and persisting state...')
    saveStateSync(stateFile, state)
    ac.abort()
  }

  process.on('SIGINT', onSigint)

  try {
    console.log(`🐔 Migrating current space: ${spaceDID}`)
    console.log(`🐔 State file: ${stateFile}`)

    const readerResult = await readInventories({
      client,
      resolver,
      state,
      stateFile,
      spaceDIDs: [spaceDID],
      stopOnError,
      signal: ac.signal,
    })
    if (readerResult.interrupted) return

    const planResult = await planMigration({
      synapse,
      state,
      stateFile,
      signal: ac.signal,
    })
    if (planResult.interrupted) return
    const { plan } = planResult

    printPlan(plan)

    if (
      !autoApprove &&
      !(await confirm({
        message: 'Continue with migration?',
        default: false,
      }).catch(() => false))
    ) {
      console.log('Migration cancelled')
      return
    }

    const migrationResult = await runMigration({
      plan,
      state,
      stateFile,
      synapse,
      batchSize,
      pullConcurrency,
      stopOnError,
      signal: ac.signal,
    })
    if (migrationResult.interrupted) return
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Error: migration failed - ${message}`)
    process.exitCode = 1
  } finally {
    process.off('SIGINT', onSigint)
  }
}

/**
 * @param {object} args
 * @param {import('@storacha/client').Client} args.client
 * @param {import('@storacha/filecoin-pin-migration/types').SourceURLResolver} args.resolver
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} args.state
 * @param {string} args.stateFile
 * @param {string[]} args.spaceDIDs
 * @param {boolean} args.stopOnError
 * @param {AbortSignal} args.signal
 */
async function readInventories({
  client,
  resolver,
  state,
  stateFile,
  spaceDIDs,
  stopOnError,
  signal,
}) {
  console.log('\nReading inventories...')

  for await (const event of buildMigrationInventories({
    client,
    resolver,
    state,
    spaceDIDs: /** @type {`did:key:${string}`[]} */ (spaceDIDs),
    options: { stopOnError },
  })) {
    switch (event.type) {
      case 'reader:space:start':
        console.log(`  Reading space ${event.spaceDID}`)
        break
      case 'reader:space:complete': {
        const inventory = state.spacesInventories[event.spaceDID]
        if (!inventory) break
        console.log(
          `  Completed ${inventory.uploads.length} uploads, ${inventory.shards.length} shards, ${inventory.failedUploads.length} failed uploads, ${formatBytes(inventory.totalBytes)}`
        )
        break
      }
      case 'reader:shard:failed':
        console.warn(
          `  shard:failed  root=${event.root}  shard=${event.shard}  reason=${event.reason}`
        )
        break
      case 'state:checkpoint':
        await saveState(stateFile, event.state)
        break
    }

    if (signal.aborted) {
      return { interrupted: true }
    }
  }

  return { interrupted: signal.aborted }
}

/**
 * @param {object} args
 * @param {import('@filoz/synapse-sdk').Synapse} args.synapse
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} args.state
 * @param {string} args.stateFile
 * @param {AbortSignal} args.signal
 */
async function planMigration({ synapse, state, stateFile, signal }) {
  console.log('\nCreating migration plan...')

  /** @type {import('@storacha/filecoin-pin-migration/types').MigrationPlan | undefined} */
  let plan

  for await (const event of createMigrationPlan({ synapse, state })) {
    switch (event.type) {
      case 'state:checkpoint':
        await saveState(stateFile, event.state)
        break
      case 'planner:ready':
        plan = event.plan
        break
    }

    if (signal.aborted) {
      return { interrupted: true, plan }
    }
  }

  if (!plan) {
    throw new Error('planner:ready event was never yielded')
  }

  return { interrupted: false, plan }
}

/**
 * @param {object} args
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationPlan} args.plan
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} args.state
 * @param {string} args.stateFile
 * @param {import('@filoz/synapse-sdk').Synapse} args.synapse
 * @param {number} args.batchSize
 * @param {number | undefined} args.pullConcurrency
 * @param {boolean} args.stopOnError
 * @param {AbortSignal} args.signal
 */
async function runMigration({
  plan,
  state,
  stateFile,
  synapse,
  batchSize,
  pullConcurrency,
  stopOnError,
  signal,
}) {
  console.log('\nStarting migration...')

  for await (const event of executeMigration({
    plan,
    state,
    synapse,
    batchSize,
    pullConcurrency,
    stopOnError,
    signal,
  })) {
    switch (event.type) {
      case 'funding:start':
        console.log(`  Funding ${event.amount.toString()} USDFC...`)
        break
      case 'funding:complete':
        console.log('  Funding complete')
        break
      case 'funding:failed':
        console.error(`  Funding failed: ${event.error.message}`)
        process.exit(1)
        break
      case 'migration:commit:failed': {
        const shouldRetry = await confirm({
          message: `Final commit failed for ${event.roots.length} upload(s). Retry attempt ${event.attempt}?`,
          default: true,
        }).catch(() => false)

        if (shouldRetry) {
          event.retry()
        } else {
          event.skip()
        }
        break
      }
      case 'migration:batch:failed':
        console.warn(
          `  batch:failed  stage=${event.stage}  roots=${event.roots.length}  error=${event.error.message}`
        )
        break
      case 'state:checkpoint':
        await saveState(stateFile, event.state)
        printCheckpointProgress(event.state, plan)
        if (signal.aborted) {
          return { interrupted: true }
        }
        break
      case 'migration:complete':
        console.log('\nMigration complete')
        console.log(`  Succeeded shards: ${event.summary.succeeded}`)
        console.log(`  Failed shards: ${event.summary.failed}`)
        console.log(`  Skipped uploads: ${event.summary.skippedUploads}`)
        console.log(`  Total bytes: ${formatBytes(event.summary.totalBytes)}`)
        console.log(
          `  Data sets: ${event.summary.dataSetIds.join(', ') || 'none'}`
        )
        console.log(`  Duration: ${formatDuration(event.summary.duration)}`)
        break
    }
  }

  return { interrupted: signal.aborted }
}

/**
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationPlan} plan
 */
function printPlan(plan) {
  console.log(`  Spaces: ${plan.costs.perSpace.length}`)
  console.log(`  Uploads: ${plan.totals.uploads}`)
  console.log(`  Shards: ${plan.totals.shards}`)
  console.log(`  Total bytes: ${formatBytes(plan.totals.bytes)}`)
  console.log(
    `  Deposit needed: ${plan.costs.totalDepositNeeded.toString()} USDFC`
  )
  console.log(`  Funding amount: ${plan.fundingAmount.toString()} USDFC`)
  console.log(`  Ready: ${plan.ready ? 'yes' : 'no'}`)

  if (plan.warnings.length > 0) {
    console.warn('\nWarnings:')
    for (const warning of plan.warnings) {
      console.warn(`  - ${warning}`)
    }
  }
}

/**
 * @param {string} stateFile
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} state
 */
async function saveState(stateFile, state) {
  await fs.promises.mkdir(path.dirname(stateFile), { recursive: true })
  await fs.promises.writeFile(
    stateFile,
    JSON.stringify(serializeState(state), null, 2)
  )
}

/**
 * @param {string} stateFile
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} state
 */
function saveStateSync(stateFile, state) {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true })
  fs.writeFileSync(stateFile, JSON.stringify(serializeState(state), null, 2))
}

/**
 * @param {string} stateFile
 */
function loadStateOrExit(stateFile) {
  if (!fs.existsSync(stateFile)) {
    console.error(
      `Error: resume requested but state file was not found: ${stateFile}`
    )
    process.exit(1)
  }

  try {
    const raw = fs.readFileSync(stateFile, 'utf8')
    return deserializeState(JSON.parse(raw))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Error: failed to read state file - ${message}`)
    process.exit(1)
  }
}

/**
 * @param {string | undefined} strategy
 */
function parseSourceStrategy(strategy) {
  if (strategy == null || strategy === '') {
    return DEFAULT_SOURCE_STRATEGY
  }

  if (strategy === 'roundabout' || strategy === 'claims') {
    return strategy
  }

  console.error(
    `Error: invalid source strategy "${strategy}". Expected "roundabout" or "claims".`
  )
  process.exit(1)
}

/**
 * @param {number | string | undefined} batchSize
 */
function parseBatchSize(batchSize) {
  const value = parsePositiveInteger(batchSize, '--batch-size')
  return value ?? DEFAULT_BATCH_SIZE
}

/**
 * @param {number | string | undefined} value
 * @param {string} flag
 */
function parsePositiveInteger(value, flag) {
  if (value == null || value === '') {
    return undefined
  }

  const parsed =
    typeof value === 'number' ? value : Number.parseInt(value, 10)
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed
  }

  console.error(`Error: "${flag}" must be a positive integer`)
  process.exit(1)
}

/**
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} state
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationPlan} plan
 */
function printCheckpointProgress(state, plan) {
  let pulled = 0
  let committed = 0
  let failedUploads = 0

  for (const space of Object.values(state.spaces)) {
    pulled += space.pulled.size
    committed += space.committed.size
    failedUploads += space.failedUploads.size
  }

  console.log(
    `  Checkpoint  pulled=${pulled} committed=${committed}/${plan.totals.shards} failedUploads=${failedUploads}`
  )
}

/**
 * @param {string} spaceDID
 */
function defaultStateFileForSpace(spaceDID) {
  const safeSpace = spaceDID.replace(/[^a-zA-Z0-9._-]+/g, '-')
  return path.join(
    process.cwd(),
    `${DEFAULT_STATE_FILE_BASENAME}-${safeSpace}.json`
  )
}

/**
 * @param {bigint} bytes
 */
function formatBytes(bytes) {
  return filesize(Number(bytes))
}

/**
 * @param {number} durationMs
 */
function formatDuration(durationMs) {
  const totalSeconds = Math.max(Math.round(durationMs / 1000), 0)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${seconds}s`
}

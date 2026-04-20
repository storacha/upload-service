import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { confirm } from '@inquirer/prompts'
import chalk from 'chalk'
import ora from 'ora'
import ansiEscapes from 'ansi-escapes'
import { Synapse, TOKENS, mainnet, calibration } from '@filoz/synapse-sdk'
import {
  createInitialState,
  buildMigrationInventories,
  createMigrationPlan,
  executeMigration,
  executeStoreMigration,
  createResolver,
  serializeState,
  deserializeState,
} from '@storacha/filecoin-pin-migration'
import { parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { getClient } from './lib.js'
import {
  checkpointSpinnerText,
  formatBytes,
  formatTokenAmount,
  printPhaseTitle,
  printPlan,
  printPreflight,
  printReaderShardFailed,
  printSummary,
  renderCheckpointProgress,
  truncateDID,
} from './migrate-view.js'

const DEFAULT_BATCH_SIZE = 100
const DEFAULT_SOURCE_STRATEGY = 'roundabout'
const DEFAULT_STATE_FILE_BASENAME = 'storacha-migration'
const CLI_SOURCE = 'storacha-cli'
const MIN_FIL_GAS_BALANCE = parseEther('0.1')

/**
 * Migrate the current selected space to Filecoin on Chain.
 *
 * @typedef {object} SpaceMigrateOptions
 * @property {string} [walletPk]
 * @property {string} [network]
 * @property {string} [stateFile]
 * @property {boolean} [resume]
 * @property {number|string} [batchSize]
 * @property {number|string} [pullConcurrency]
 * @property {'pull' | 'store'} [uploadMode]
 * @property {string} [sourceStrategy]
 * @property {string} [roundaboutURL]
 */

/**
 * Migrate the current selected space to Filecoin on Chain.
 *
 * @param {SpaceMigrateOptions} opts
 */
export async function spaceMigrate(opts = {}) {
  const config = parseMigrationOptions(opts)
  const account = createWalletAccount(opts.walletPk)

  const resolver = createResolver({
    strategy: config.sourceStrategy,
    roundaboutURL: config.roundaboutURL,
  })

  const context = await resolveMigrationContext(opts.stateFile)

  const synapse = Synapse.create({
    account,
    chain: config.network,
    source: CLI_SOURCE,
  })

  const state = config.resume
    ? loadStateOrExit(context.stateFile)
    : createInitialState()

  const ac = new AbortController()
  let stopRequested = false
  const onSigint = () => {
    if (stopRequested) return
    stopRequested = true
    console.log('\nStopping after the current step and persisting state...')
    saveStateSync(context.stateFile, state)
    ac.abort()
  }

  process.on('SIGINT', onSigint)
  // TODO: are we also listen for termination signals and throws of uncaught exceptions to persist state before exit?

  try {
    const userWalletInfo = await loadPreflight(synapse)
    printPreflight({
      spaceDID: context.spaceDID,
      walletAddress: account.address,
      chainId: synapse.chain.id,
      chainName: synapse.chain.name,
      stateFile: context.stateFile,
      resume: config.resume,
      uploadMode: config.uploadMode,
      preflight: userWalletInfo,
      minFilGasBalance: MIN_FIL_GAS_BALANCE,
    })

    const readerResult = await readInventories({
      client: context.client,
      resolver,
      state,
      stateFile: context.stateFile,
      spaceDIDs: [context.spaceDID],
      signal: ac.signal,
    })
    if (readerResult.interrupted) return

    const spaceInventory = state.spacesInventories[context.spaceDID]
    if (!spaceInventory || spaceInventory.uploads.length === 0) {
      console.warn(
        'No uploads are available to migrate. All uploads failed during the reader phase.'
      )
      return
    }

    const planResult = await planMigration({
      synapse,
      state,
      stateFile: context.stateFile,
      signal: ac.signal,
    })
    if (planResult.interrupted || !planResult.plan) return
    const { plan } = planResult

    printPlan(plan, userWalletInfo.walletUSDFC, userWalletInfo.depositedUSDFC)

    console.log(
      chalk.inverse(
        'Funding is irreversible. Verify contents are reachable before continuing.\n'
      )
    )

    const proceedWithPlan = await confirm({
      message: 'Continue with migration?',
      default: false,
    }).catch(() => false)

    if (!proceedWithPlan) {
      console.log('Migration cancelled')
      return
    }

    const migrationResult = await runMigration({
      plan,
      state,
      stateFile: context.stateFile,
      synapse,
      batchSize: config.batchSize,
      pullConcurrency: config.pullConcurrency,
      uploadMode: config.uploadMode,
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
 * @param {SpaceMigrateOptions} opts
 */
function parseMigrationOptions(opts) {
  return {
    network: parseNetwork(opts.network),
    batchSize: parseBatchSize(opts.batchSize),
    uploadMode: parseUploadMode(opts.uploadMode),
    sourceStrategy: parseSourceStrategy(opts.sourceStrategy),
    pullConcurrency: parsePositiveInteger(
      opts.pullConcurrency,
      '--pull-concurrency'
    ),
    resume: opts.resume ?? false,
    roundaboutURL: opts.roundaboutURL,
  }
}

/**
 * @param {'pull' | 'store' | string | undefined} mode
 * @returns {'pull' | 'store'}
 */
function parseUploadMode(mode) {
  if (mode == null || mode === '') {
    return 'pull'
  }

  if (mode === 'pull' || mode === 'store') {
    return mode
  }

  console.error(
    `Error: invalid upload mode "${mode}". Expected "pull" or "store".`
  )
  process.exit(1)
}

/**
 * @param {string | undefined} stateFile
 */
async function resolveMigrationContext(stateFile) {
  const client = await getClient()
  const currentSpace = client.currentSpace()
  if (!currentSpace) {
    console.error(
      'Error: no current space, use "space create" to create one or select one using "space use"'
    )
    process.exit(1)
  }

  const spaceDID = currentSpace.did()

  return {
    client,
    spaceDID,
    stateFile: path.resolve(stateFile ?? defaultStateFileForSpace(spaceDID)),
  }
}

/**
 * @param {string | undefined} walletPk
 */
function createWalletAccount(walletPk) {
  try {
    return privateKeyToAccount(/** @type {`0x${string}`} */ (walletPk))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Error: invalid wallet private key - ${message}`)
    process.exit(1)
  }
}

/**
 * @param {object} args
 * @param {import('@storacha/client').Client} args.client
 * @param {import('@storacha/filecoin-pin-migration/types').SourceURLResolver} args.resolver
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} args.state
 * @param {string} args.stateFile
 * @param {string[]} args.spaceDIDs
 * @param {AbortSignal} args.signal
 */
async function readInventories({
  client,
  resolver,
  state,
  stateFile,
  spaceDIDs,
  signal,
}) {
  printPhaseTitle('Scanning Space')
  const spinner = ora({
    text: 'Reading inventories...',
    color: 'cyan',
  }).start()

  for await (const event of buildMigrationInventories({
    client,
    resolver,
    state,
    spaceDIDs: /** @type {`did:key:${string}`[]} */ (spaceDIDs),
  })) {
    switch (event.type) {
      case 'reader:space:start':
        spinner.text = `Reading space ${truncateDID(event.spaceDID)}`
        break
      case 'reader:space:complete': {
        const inventory = state.spacesInventories[event.spaceDID]
        if (!inventory) break
        spinner.stopAndPersist({
          symbol: chalk.green('✔'),
          text: ` Completed ${inventory.uploads.length} uploads, ${inventory.shards.length} shards, ${inventory.skippedUploads.length} skipped uploads, ${formatBytes(inventory.totalBytes)}`,
        })
        spinner.start(`Reading inventories...`)
        break
      }
      case 'reader:shard:failed':
        spinner.stop()
        printReaderShardFailed(
          event.root,
          event.shard,
          event.reason.split(':')[0]
        )
        spinner.start('Reading inventories...')
        break
      case 'state:checkpoint':
        await saveState(stateFile, event.state)
        break
    }

    if (signal.aborted) {
      spinner.stop()
      return { interrupted: true }
    }
  }

  spinner.succeed('Inventories ready')
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
  printPhaseTitle('Planning')
  const spinner = ora({
    text: 'Creating migration plan...',
    color: 'cyan',
  }).start()

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
      spinner.stop()
      return { interrupted: true, plan }
    }
  }

  if (!plan) {
    spinner.fail('Failed to create migration plan')
    throw new Error('planner:ready event was never yielded')
  }

  spinner.succeed('Migration plan ready')
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
 * @param {'pull' | 'store'} args.uploadMode
 * @param {AbortSignal} args.signal
 */
async function runMigration({
  plan,
  state,
  stateFile,
  synapse,
  batchSize,
  pullConcurrency,
  uploadMode,
  signal,
}) {
  printPhaseTitle('Migrating')
  const spinner = ora({
    text: 'Waiting for migration steps...',
    color: 'cyan',
  }).start()
  let progressPrinted = false
  const migrationEvents =
    uploadMode === 'store'
      ? executeStoreMigration({
          plan,
          state,
          synapse,
          batchSize,
          pullConcurrency,
          signal,
        })
      : executeMigration({
          plan,
          state,
          synapse,
          batchSize,
          pullConcurrency,
          signal,
        })

  for await (const event of migrationEvents) {
    switch (event.type) {
      case 'funding:start':
        spinner.start(
          `Funding ${formatTokenAmount(event.amount)} USDFC into payments`
        )
        break
      case 'funding:complete':
        spinner.succeed(`Funding complete (tx hash: ${event.txHash})`)
        spinner.start(
          uploadMode === 'store'
            ? 'Storing, pulling, and committing copy data...'
            : 'Pulling and committing copy data...'
        )
        break
      case 'funding:failed':
        spinner.fail(`Funding failed: ${event.error.message}`)
        process.exit(1)
        break
      case 'migration:commit:failed': {
        spinner.stop()
        const shouldRetry = await confirm({
          message: `Commit batch failed for copy ${event.copyIndex} with ${event.roots.length} upload(s). Retry attempt ${event.attempt}?`,
          default: true,
        }).catch(() => false)

        if (shouldRetry) {
          event.retry()
          spinner.start(`Retrying commit batch for copy ${event.copyIndex}...`)
        } else {
          event.skip()
          spinner.start(`Skipping commit batch for copy ${event.copyIndex}...`)
        }
        break
      }
      case 'migration:batch:failed':
        spinner.stop()
        console.warn(
          chalk.yellow(
            `  batch:failed  copy=${event.copyIndex}  stage=${event.stage}  roots=${event.roots.length}  error=${event.error.message}`
          )
        )
        spinner.start(
          `Continuing migration after copy ${event.copyIndex} ${event.stage} failure...`
        )
        break
      case 'state:checkpoint':
        await saveState(stateFile, event.state)
        spinner.stop()
        progressPrinted = renderCheckpointProgress(
          event.state,
          plan,
          progressPrinted,
          uploadMode
        )
        spinner.start(checkpointSpinnerText(event.state, plan, uploadMode))
        if (signal.aborted) {
          spinner.stop()
          return { interrupted: true }
        }
        break
      case 'migration:complete':
        if (progressPrinted) {
          spinner.stop()
          process.stdout.write(ansiEscapes.eraseLines(3))
        } else {
          spinner.stop()
        }
        console.log(chalk.green('✔ Migration complete'))
        printSummary(event.summary)
        break
    }
  }

  return { interrupted: signal.aborted }
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
 * @returns {'roundabout' | 'claims'}
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

  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10)
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed
  }

  console.error(`Error: "${flag}" must be a positive integer`)
  process.exit(1)
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
 * @param {string | undefined} network
 */
function parseNetwork(network) {
  if (network == null || network === '' || network === 'calibration') {
    return calibration
  }

  if (network === 'mainnet') {
    return mainnet
  }

  console.error(
    `Error: invalid network "${network}". Expected "mainnet" or "calibration".`
  )
  process.exit(1)
}

/**
 * @param {import('@filoz/synapse-sdk').Synapse} synapse
 */
async function loadPreflight(synapse) {
  const spinner = ora({
    text: 'Checking wallet and payments balances...',
    color: 'cyan',
  }).start()

  try {
    const [walletUSDFC, walletFIL, depositedUSDFC] = await Promise.all([
      synapse.payments.walletBalance({ token: TOKENS.USDFC }),
      synapse.payments.walletBalance({ token: TOKENS.FIL }),
      synapse.payments.balance({ token: TOKENS.USDFC }),
    ])

    spinner.succeed('Balances loaded')
    return {
      walletUSDFC,
      walletFIL,
      depositedUSDFC,
    }
  } catch (err) {
    spinner.fail(
      `Failed to load balances: ${err instanceof Error ? err.message : String(err)}`
    )
    throw err
  }
}

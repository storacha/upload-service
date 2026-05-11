import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { confirm, select } from '@inquirer/prompts'
import ansiEscapes from 'ansi-escapes'
import chalk from 'chalk'
import ora from 'ora'
import { Synapse, TOKENS, mainnet, calibration } from '@filoz/synapse-sdk'
import {
  createInitialState,
  buildMigrationInventories,
  createMigrationPlan,
  executeMigration,
  createResolver,
  clearFailedUploadsForRetry,
  ResumeBindingDriftError,
  serializeState,
  deserializeState,
} from '@storacha/filecoin-pin-migration'
import {
  getStorageRetentionCost,
  pruneStagedShards,
} from '@storacha/filecoin-pin-migration/helpers'
import { createPublicClient, http, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { getClient } from './lib.js'
import {
  formatBytes,
  printPhaseTitle,
  printPlan,
  printPreflight,
  printReaderShardFailed,
  printCommitBatchResult,
  printResumeStatus,
  printStagedShardCleanup,
  renderMigrationStatusBlock,
  renderStorageRetentionCostEstimate,
  renderStorageRetentionCostPricingNote,
  printSummary,
  formatDuration,
  truncateDID,
} from './migrate-view.js'

const LIVE_STATUS_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

const DEFAULT_SOURCE_STRATEGY = 'roundabout'
const DEFAULT_STATE_FILE_BASENAME = 'storacha-migration'
const CLI_SOURCE = 'storacha-cli'
const MIN_FIL_GAS_BALANCE = parseEther('0.001')
const DEFAULT_STORAGE_RETENTION_COPIES = 2

/**
 * @typedef {'fresh' | 'resume' | 'retry'} MigrationStartMode
 */

/**
 * Migrate the current selected space to Filecoin on Chain.
 *
 * @typedef {object} SpaceMigrateOptions
 * @property {string} [walletPk]
 * @property {string} [network]
 * @property {string} [stateFile]
 * @property {boolean} [resume]
 * @property {boolean} [retry]
 * @property {boolean} [debug]
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
    strategy: DEFAULT_SOURCE_STRATEGY,
  })

  const context = await resolveMigrationContext(opts.stateFile)

  const synapse = Synapse.create({
    account,
    chain: config.network,
    source: CLI_SOURCE,
  })

  const startState = await resolveStartState({
    stateFile: context.stateFile,
    resume: config.resume,
    retry: config.retry,
  })
  if (!startState) return

  config.resume = startState.mode === 'resume'
  config.retry = startState.mode === 'retry'
  const state = startState.state

  if (config.retry) {
    const retriedUploads = clearFailedUploadsForRetry(state, context.spaceDID)
    console.log(`Retrying ${retriedUploads} failed uploads...`)
  }

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
      mode: startState.mode,
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

    if (config.resume || config.retry) {
      const cleanupResult = await pruneStagedShards({
        state,
        spaceDIDs: [context.spaceDID],
      })

      if (cleanupResult.stateCorrected) {
        await saveState(context.stateFile, state)
      }

      printStagedShardCleanup(cleanupResult)
    }

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
      debug: config.debug,
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

/**
 * @param {SpaceMigrateOptions} opts
 */
function parseMigrationOptions(opts) {
  return {
    network: parseNetwork(opts.network),
    resume: opts.resume ?? false,
    retry: opts.retry ?? false,
    debug: opts.debug ?? false,
  }
}

/**
 * @param {SpaceMigrateCalcOptions} opts
 */
function parseMigrationCalcOptions(opts) {
  return {
    network: parseNetwork(opts.network),
    sizeBytes: parsePositiveBigInt(opts.size, '--size'),
    months: parsePositiveBigInt(opts.months, '--months'),
  }
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
 * @param {object} args
 * @param {string} args.stateFile
 * @param {boolean} args.resume
 * @param {boolean} args.retry
 * @returns {Promise<{ mode: MigrationStartMode, state: import('@storacha/filecoin-pin-migration/types').MigrationState } | null>}
 */
async function resolveStartState({ stateFile, resume, retry }) {
  if (resume) {
    return { mode: 'resume', state: loadStateOrExit(stateFile) }
  }

  if (retry) {
    return { mode: 'retry', state: loadStateOrExit(stateFile) }
  }

  const existingState = tryLoadState(stateFile)
  if (!existingState.exists) {
    return { mode: 'fresh', state: createInitialState() }
  }

  if (existingState.error) {
    console.warn(
      chalk.yellow(
        `Existing state file found at ${stateFile}, but it could not be loaded: ${existingState.error.message}`
      )
    )

    if (
      !(await confirmFreshOverwrite({
        cancelMessage:
          'Migration cancelled. Keep the current file or restart with a compatible state file.',
      }))
    ) {
      return null
    }

    return { mode: 'fresh', state: createInitialState() }
  }

  printExistingStateSummary(stateFile, existingState.state)

  if (existingState.state.phase === 'complete') {
    return null
  }

  const action = await promptForExistingStateAction(existingState.state)

  if (action === 'cancel') {
    console.log(
      chalk.dim(
        'Migration cancelled. Re-run with --resume or --retry to use the existing state file.'
      )
    )
    return null
  }

  if (action === 'resume') {
    return { mode: 'resume', state: existingState.state }
  }

  if (action === 'retry') {
    return { mode: 'retry', state: existingState.state }
  }

  if (
    !(await confirmFreshOverwrite({
      cancelMessage:
        'Migration cancelled. Re-run with --resume or --retry to use the existing state file.',
    }))
  ) {
    return null
  }

  return { mode: 'fresh', state: createInitialState() }
}

/**
 * @param {string} stateFile
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} state
 */
function printExistingStateSummary(stateFile, state) {
  console.log(chalk.dim(`State file: ${stateFile}`))
  console.log('')

  printResumeStatus(state, {
    title:
      state.phase === 'complete'
        ? 'Existing Migration State (Completed)'
        : 'Existing Migration State',
    showWhenEmpty: true,
  })
}

/**
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} state
 * @returns {Promise<'resume' | 'retry' | 'fresh' | 'cancel'>}
 */
async function promptForExistingStateAction(state) {
  const recommendedAction = getRecommendedExistingStateAction(state)
  const hasFailedUploads = countFailedUploads(state) > 0
  const choices = [
    {
      name:
        recommendedAction === 'resume'
          ? 'Resume existing migration (Recommended)'
          : 'Resume existing migration',
      value: 'resume',
    },
  ]

  if (hasFailedUploads) {
    choices.push({
      name:
        recommendedAction === 'retry'
          ? 'Retry failed uploads (Recommended)'
          : 'Retry failed uploads',
      value: 'retry',
    })
  }

  choices.push({
    name: 'Start fresh and overwrite state file',
    value: 'fresh',
  })
  choices.push({
    name: 'Cancel',
    value: 'cancel',
  })

  return await select({
    message:
      'An existing migration state file was found. What do you want to do?',
    choices,
  }).catch(() => 'cancel')
}

/**
 * @param {object} [options]
 * @param {string} [options.cancelMessage]
 */
async function confirmFreshOverwrite({
  cancelMessage = 'Migration cancelled.',
} = {}) {
  const overwrite = await confirm({
    message: 'Start fresh and overwrite the current state file?',
    default: false,
  }).catch(() => false)

  if (overwrite) {
    return true
  }

  console.log(chalk.dim(cancelMessage))
  return false
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
    signal,
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
          text: ` Completed ${inventory.uploads.length} uploads, ${
            inventory.shards.length
          } shards, ${
            inventory.skippedUploads.length
          } skipped uploads, ${formatBytes(inventory.totalBytes)}`,
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

  if (signal.aborted) {
    spinner.stop()
    return { interrupted: true }
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

  try {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    spinner.fail(
      err instanceof ResumeBindingDriftError
        ? `Resume binding drift detected: ${message}`
        : `Failed to create migration plan: ${message}`
    )
    throw err
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
 * @param {boolean} args.debug
 * @param {AbortSignal} args.signal
 */
async function runMigration({
  plan,
  state,
  stateFile,
  synapse,
  debug,
  signal,
}) {
  printPhaseTitle('Migrating')
  printResumeStatus(state)
  const startedAt = Date.now()
  const canRedraw = process.stdout.isTTY === true
  let statusBlockPrinted = 0
  let statusUpdatesPaused = false
  let frameIndex = 0
  /** @type {NodeJS.Timeout | undefined} */
  let heartbeat
  /**
   * @type {{
   * currentSpaceDID?: string
   * currentCopyIndex?: number
   * currentPhase?: import('@storacha/filecoin-pin-migration/types').MigrationExecutionPhase | 'funding'
   * currentItemCount?: number
   * currentBatchCount?: number
    }} */
  const liveStatus = {}

  /**
   * @param {() => void} print
   */
  const printPersistentMigrationLine = (print) => {
    statusUpdatesPaused = true
    clearStatusBlock()
    print()
    console.log('')
    statusUpdatesPaused = false
    renderStatusBlock()
  }

  const clearStatusBlock = () => {
    if (!canRedraw || statusBlockPrinted === 0) return
    process.stdout.write(ansiEscapes.eraseLines(statusBlockPrinted))
    statusBlockPrinted = 0
  }

  const renderStatusBlock = () => {
    if (statusUpdatesPaused) return
    clearStatusBlock()
    const block = renderMigrationStatusBlock({
      state,
      plan,
      startedAt,
      activityFrame: LIVE_STATUS_FRAMES[frameIndex],
      currentSpaceDID: liveStatus.currentSpaceDID,
      currentCopyIndex: liveStatus.currentCopyIndex,
      currentPhase: liveStatus.currentPhase,
      currentItemCount: liveStatus.currentItemCount,
      currentBatchCount: liveStatus.currentBatchCount,
    })

    if (canRedraw) {
      process.stdout.write(`${block}\n`)
      statusBlockPrinted = block.split('\n').length + 1
      return
    }

    console.log(block)
  }

  const startHeartbeat = () => {
    if (!canRedraw) return
    heartbeat = setInterval(() => {
      frameIndex = (frameIndex + 1) % LIVE_STATUS_FRAMES.length
      renderStatusBlock()
    }, 250)
  }

  const stopHeartbeat = () => {
    if (heartbeat) {
      clearInterval(heartbeat)
      heartbeat = undefined
    }
  }

  /**
   * @param {import('@storacha/filecoin-pin-migration/types').MigrationEvent} event
   */
  const updateLiveStatusFromEvent = (event) => {
    switch (event.type) {
      case 'funding:start':
        liveStatus.currentPhase = 'funding'
        liveStatus.currentItemCount = undefined
        liveStatus.currentBatchCount = undefined
        break
      case 'migration:space:start':
        liveStatus.currentSpaceDID = event.spaceDID
        break
      case 'migration:space:complete':
        liveStatus.currentPhase = undefined
        liveStatus.currentItemCount = undefined
        liveStatus.currentBatchCount = undefined
        break
      case 'migration:copy:start':
        liveStatus.currentCopyIndex = event.copyIndex
        break
      case 'migration:copy:complete':
        if (liveStatus.currentCopyIndex === event.copyIndex) {
          liveStatus.currentPhase = undefined
          liveStatus.currentItemCount = undefined
          liveStatus.currentBatchCount = undefined
        }
        break
      case 'migration:phase:start':
        liveStatus.currentCopyIndex = event.copyIndex
        liveStatus.currentPhase = event.phase
        liveStatus.currentItemCount = event.itemCount
        liveStatus.currentBatchCount = event.batchCount
        break
      case 'migration:phase:complete':
        if (
          liveStatus.currentCopyIndex === event.copyIndex &&
          liveStatus.currentPhase === event.phase
        ) {
          liveStatus.currentPhase = undefined
          liveStatus.currentItemCount = undefined
          liveStatus.currentBatchCount = undefined
        }
        break
    }
  }

  renderStatusBlock()
  startHeartbeat()

  const migrationEvents = executeMigration({
    plan,
    state,
    synapse,
    signal,
  })

  for await (const event of migrationEvents) {
    switch (event.type) {
      case 'funding:start':
        updateLiveStatusFromEvent(event)
        renderStatusBlock()
        break
      case 'funding:complete':
        liveStatus.currentPhase = undefined
        printPersistentMigrationLine(() => {
          console.log(
            `${chalk.green('✓')} Funding complete (tx hash: ${event.txHash})`
          )
        })
        break
      case 'funding:failed':
        stopHeartbeat()
        clearStatusBlock()
        console.error(chalk.red(`Funding failed: ${event.error.message}`))
        process.exit(1)
        break
      case 'migration:commit:failed': {
        statusUpdatesPaused = true
        clearStatusBlock()
        console.error(
          chalk.red(
            `Commit ${event.commitIndex} failed for copy ${event.copyIndex} with ${event.pieceCount} piece(s): ${event.error.message}`
          )
        )
        console.log()
        const shouldRetry = await confirm({
          message: `Retry commit ${event.commitIndex} for copy ${event.copyIndex}? Attempt ${event.attempt}.`,
          default: true,
        }).catch(() => false)

        if (shouldRetry) {
          event.retry()
          console.log(
            chalk.cyan(
              `Retrying commit ${event.commitIndex} for copy ${event.copyIndex}...`
            )
          )
        } else {
          event.skip()
          console.log(
            chalk.yellow(
              `Skipping commit ${event.commitIndex} for copy ${event.copyIndex}...`
            )
          )
        }
        statusUpdatesPaused = false
        renderStatusBlock()
        break
      }
      case 'migration:commit:settled':
        if (debug || event.status !== 'succeeded') {
          printPersistentMigrationLine(() => {
            printCommitBatchResult({
              ...event,
              error: event.status === 'failed' ? undefined : event.error,
            })
          })
        }
        break
      case 'migration:batch:failed':
        if (event.stage === 'commit') {
          break
        }
        printPersistentMigrationLine(() => {
          console.warn(
            chalk.yellow(
              `  migration:batch:failed  copy=${event.copyIndex}  stage=${event.stage}  roots=${event.roots.length}  error=${event.error.message}`
            )
          )
        })
        break
      case 'migration:space:start':
      case 'migration:copy:start':
      case 'migration:phase:start':
      case 'migration:phase:complete':
      case 'migration:space:complete':
      case 'migration:copy:complete':
        updateLiveStatusFromEvent(event)

        if (event.type === 'migration:space:complete') {
          printPersistentMigrationLine(() => {
            console.log(
              `${chalk.green('✓')} ${chalk.dim('space')} ${truncateDID(
                event.spaceDID
              )}  ${event.phase}`
            )
          })
          break
        }

        if (event.type === 'migration:copy:complete') {
          printPersistentMigrationLine(() => {
            console.log(
              `${
                event.completed ? chalk.green('✓') : chalk.yellow('!')
              } ${chalk.dim('copy')} ${event.copyIndex}  ${
                event.completed
                  ? chalk.green('completed')
                  : chalk.yellow('stopped')
              }`
            )
          })
          break
        }
        renderStatusBlock()
        break
      case 'state:checkpoint':
        await saveState(stateFile, event.state)
        renderStatusBlock()
        if (signal.aborted) {
          stopHeartbeat()
          console.log(
            chalk.yellow(
              `Migration interrupted after ${formatDuration(
                Date.now() - startedAt
              )}.`
            )
          )
          return { interrupted: true }
        }
        break
      case 'migration:complete':
        stopHeartbeat()
        clearStatusBlock()
        printSummary(
          event.summary,
          Date.now() - startedAt,
          synapse.chain.id,
          state,
          plan
        )
        break
    }
  }

  stopHeartbeat()

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
 * @param {string} stateFile
 * @returns {{ exists: false } | { exists: true, state: import('@storacha/filecoin-pin-migration/types').MigrationState, error?: undefined } | { exists: true, error: Error, state?: undefined }}
 */
function tryLoadState(stateFile) {
  if (!fs.existsSync(stateFile)) {
    return { exists: false }
  }

  try {
    const raw = fs.readFileSync(stateFile, 'utf8')
    return { exists: true, state: deserializeState(JSON.parse(raw)) }
  } catch (err) {
    return {
      exists: true,
      error: err instanceof Error ? err : new Error(String(err)),
    }
  }
}

/**
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} state
 */
function countFailedUploads(state) {
  let totalFailedUploads = 0

  for (const space of Object.values(state.spaces)) {
    for (const copy of space.copies) {
      totalFailedUploads += copy.failedUploads.size
    }
  }

  return totalFailedUploads
}

/**
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} state
 * @returns {'resume' | 'retry'}
 */
function getRecommendedExistingStateAction(state) {
  return countFailedUploads(state) > 0 ? 'retry' : 'resume'
}

/**
 * @param {string | undefined} strategy
 */
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
      `Failed to load balances: ${
        err instanceof Error ? err.message : String(err)
      }`
    )
    throw err
  }
}

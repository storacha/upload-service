import process from 'node:process'
import chalk from 'chalk'
import { confirm } from '@inquirer/prompts'
import { Synapse } from '@filoz/synapse-sdk'
import {
  clearFailedUploadsForRetry,
  createResolver,
} from '@storacha/filecoin-pin-migration'
import {
  loadSelectedRootsFile,
  pruneStagedShards,
} from '@storacha/filecoin-pin-migration/helpers'
import { parseEther } from 'viem'
import {
  createWalletAccount,
  loadPreflight,
  resolveMigrationContext,
} from './context.js'
import { parseMigrationOptions } from './options.js'
import { readInventories } from './phases/reader.js'
import { planMigration } from './phases/planner.js'
import { runMigration } from './phases/migrator.js'
import { setupMigrationSignals } from './signals.js'
import { resolveStartState } from './start-state.js'
import { saveState, saveStateSync } from './state-file.js'
import { printPreflight } from './view/preflight.js'
import { printPlan } from './view/plan.js'
import { printStagedShardCleanup } from './view/resume.js'

const DEFAULT_SOURCE_STRATEGY = 'roundabout'
const CLI_SOURCE = 'storacha-cli'
const MIN_FIL_GAS_BALANCE = parseEther('0.001')

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
 * @property {string} [selectedRootsFile]
 * @property {boolean} [nonInteractive]
 */

/**
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
  const persistedReaderCursor = state.readerProgressCursors?.[context.spaceDID]
  const hasExplicitRootCursor =
    typeof persistedReaderCursor === 'string' &&
    persistedReaderCursor.startsWith('explicit-roots:')

  if (hasExplicitRootCursor && !config.selectedRootsFile) {
    throw new Error(
      'resume requested for an explicit-root reader state; rerun with --selected-roots-file'
    )
  }
  if (
    config.selectedRootsFile &&
    persistedReaderCursor &&
    !hasExplicitRootCursor
  ) {
    throw new Error(
      'selected-roots-file cannot resume a state created without explicit-root reader mode'
    )
  }

  if (config.retry) {
    const retriedUploads = clearFailedUploadsForRetry(state, context.spaceDID)
    console.log(`Retrying ${retriedUploads} failed uploads...`)
  }

  const ac = new AbortController()
  /** @type {'reader' | 'planning' | 'migrating' | undefined} */
  let currentRuntimePhase
  const persistCheckpoint = (checkpointState = state) =>
    saveState(context.stateFile, checkpointState)
  /**
   * @template T
   * @param {'reader' | 'planning' | 'migrating'} phase
   * @param {() => Promise<T>} run
   */
  const runPhase = async (phase, run) => {
    currentRuntimePhase = phase
    try {
      return await run()
    } finally {
      currentRuntimePhase = undefined
    }
  }
  const { isStopRequested, consumeGracefulStopNoticePhase, teardown } =
    setupMigrationSignals({
      stateFile: context.stateFile,
      state,
      abortController: ac,
      getCurrentRuntimePhase: () => currentRuntimePhase,
      saveStateSync,
    })

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

    const uploadRootsBySpace = config.selectedRootsFile
      ? await loadSelectedRootsFile({
          filePath: config.selectedRootsFile,
          spaceDID: context.spaceDID,
        })
      : undefined

    const readerResult = await runPhase('reader', () =>
      readInventories({
        client: context.client,
        resolver,
        state,
        spaceDIDs: uploadRootsBySpace ? undefined : [context.spaceDID],
        uploadRootsBySpace,
        readerOptions: config.readerOptions,
        readerOverrideEntries: config.readerOverrideEntries,
        isStopRequested,
        persistCheckpoint,
        signal: ac.signal,
      })
    )
    if (readerResult.interrupted) return

    const spaceInventory = state.spacesInventories[context.spaceDID]
    if (!spaceInventory || spaceInventory.uploads.length === 0) {
      console.warn(
        'No uploads are available to migrate. All uploads failed during the reader phase.'
      )
      return
    }

    const planResult = await runPhase('planning', () =>
      planMigration({
        synapse,
        state,
        persistCheckpoint,
        signal: ac.signal,
      })
    )
    if (planResult.interrupted || !planResult.plan) return
    const { plan } = planResult

    if (config.resume || config.retry) {
      const cleanupResult = await pruneStagedShards({
        state,
        spaceDIDs: [context.spaceDID],
      })

      if (cleanupResult.stateCorrected) {
        await persistCheckpoint(state)
      }

      printStagedShardCleanup(cleanupResult)
    }

    printPlan(plan, userWalletInfo.walletUSDFC, userWalletInfo.depositedUSDFC)

    console.log(
      chalk.inverse(
        'Funding is irreversible. Verify contents are reachable before continuing.\n'
      )
    )

    const proceedWithPlan = config.nonInteractive
      ? true
      : await confirm({
          message: 'Continue with migration?',
          default: false,
        }).catch(() => false)

    if (!proceedWithPlan) {
      console.log('Migration cancelled')
      return
    }

    const migrationResult = await runPhase('migrating', () =>
      runMigration({
        plan,
        state,
        synapse,
        debug: config.debug,
        consumeGracefulStopNoticePhase,
        isStopRequested,
        persistCheckpoint,
        signal: ac.signal,
      })
    )
    if (migrationResult.interrupted) return
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Error: migration failed - ${message}`)
    process.exitCode = 1
  } finally {
    teardown()
  }
}

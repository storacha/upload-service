import fs from 'node:fs/promises'
import process from 'node:process'
import chalk from 'chalk'
import { confirm } from '@inquirer/prompts'
import { Synapse } from '@filoz/synapse-sdk'
import {
  createResolver,
  createStore,
  MissingSqliteDependencyError,
} from '@storacha/filecoin-pin-migration'
import {
  convertJsonStateFileToSqlite,
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
 * @property {'json' | 'sqlite'} [stateFormat]
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

  const synapse = Synapse.create({
    account,
    chain: config.network,
    source: CLI_SOURCE,
  })

  const ac = new AbortController()
  /** @type {'reader' | 'planning' | 'migrating' | undefined} */
  let currentRuntimePhase
  /** @type {import('@storacha/filecoin-pin-migration/types').MigrationStore | undefined} */
  let store
  /** @type {() => boolean} */
  let isStopRequested = () => false
  /** @type {() => 'migrating' | undefined} */
  let consumeGracefulStopNoticePhase = () => undefined
  const persistCheckpoint = () => {
    if (!store) {
      throw new Error('Migration store is not open')
    }
    return store.checkpoint()
  }
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
  let teardown = () => {}

  try {
    const context = await resolveMigrationContext(
      opts.stateFile,
      config.stateFormat
    )

    if (
      context.stateFormat === 'sqlite' &&
      context.stateFile.endsWith('.json')
    ) {
      const sqliteTarget = context.stateFile.slice(0, -'.json'.length) + '.db'
      console.log(chalk.dim(`Converting JSON state file to SQLite`))
      await convertJsonStateFileToSqlite({
        sourcePath: context.stateFile,
        targetPath: sqliteTarget,
      })
      console.log(chalk.dim('Conversion complete.'))
      context.stateFile = sqliteTarget
    }

    const startState = await resolveStartState({
      stateFile: context.stateFile,
      stateFormat: context.stateFormat,
      resume: config.resume,
      retry: config.retry,
    })
    if (!startState) return

    config.resume = startState.mode === 'resume'
    config.retry = startState.mode === 'retry'

    if (startState.mode === 'fresh' && startState.replaceExisting) {
      try {
        await fs.unlink(context.stateFile)
      } catch (error) {
        if (
          !(error instanceof Error) ||
          /** @type {NodeJS.ErrnoException} */ (error).code !== 'ENOENT'
        ) {
          throw error
        }
      }
    }

    // Single store owner: open after mode decision so a user-cancelled run
    // does not create an empty state file or leave a stale lock.
    store = await createStore({
      type: context.stateFormat,
      path: context.stateFile,
    })
    let activeStore = store

    const state = activeStore.getState()
    const persistedReaderCursor =
      state.readerProgressCursors?.[context.spaceDID]
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
      const retriedUploads = activeStore.clearFailedUploadsForRetry(
        context.spaceDID
      )
      console.log(`Retrying ${retriedUploads} failed uploads...`)
      await activeStore.checkpoint()
    }

    ;({ isStopRequested, consumeGracefulStopNoticePhase, teardown } =
      setupMigrationSignals({
        abortController: ac,
        getCurrentRuntimePhase: () => currentRuntimePhase,
      }))

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
        store: activeStore,
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

    const spaceInventorySummary = activeStore.getSpaceInventorySummary(
      context.spaceDID
    )
    if (!spaceInventorySummary || spaceInventorySummary.uploadsCount === 0) {
      console.warn(
        'No uploads are available to migrate. All uploads failed during the reader phase.'
      )
      return
    }

    const planResult = await runPhase('planning', () =>
      planMigration({
        synapse,
        store: activeStore,
        persistCheckpoint,
        signal: ac.signal,
      })
    )
    if (planResult.interrupted || !planResult.plan) return
    const { plan } = planResult

    if (config.resume || config.retry) {
      const cleanupResult = await pruneStagedShards({
        state: activeStore.getState(),
        store: activeStore,
        spaceDIDs: [context.spaceDID],
        applyClearPullProgress: (spaceDID, copyIndex, shardCid) =>
          activeStore.clearPullProgress(spaceDID, copyIndex, shardCid),
        applyClearStoredPiece: (spaceDID, copyIndex, shardCid) =>
          activeStore.clearStoredPiece(spaceDID, copyIndex, shardCid),
      })

      if (cleanupResult.stateCorrected) {
        await activeStore.checkpoint()
      }

      printStagedShardCleanup(cleanupResult)
    }

    printPlan(plan, userWalletInfo.walletUSDFC, userWalletInfo.depositedUSDFC)

    console.log(
      chalk.inverse(
        'Funding is irreversible. Verify contents are reachable before continuing.\n'
      )
    )

    if (!config.nonInteractive) {
      // The reader/planner phases have already checkpointed every persisted
      // change needed to resume from here. Close the store before waiting for
      // interactive confirmation so Ctrl+C at the prompt cannot leave behind
      // an open lock or an in-flight JSON `.tmp` write.
      await activeStore.close()
      store = undefined
    }

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

    if (!config.nonInteractive) {
      activeStore = await createStore({
        type: context.stateFormat,
        path: context.stateFile,
      })
      store = activeStore
    }

    const migrationResult = await runPhase('migrating', () =>
      runMigration({
        plan,
        store: activeStore,
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
    if (err instanceof MissingSqliteDependencyError) {
      console.error(`Error: ${err.message}`)
      process.exitCode = 1
      return
    }
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Error: migration failed - ${message}`)
    process.exitCode = 1
  } finally {
    teardown()
    if (store) {
      // store.close() flushes the latest in-memory state and releases the lock.
      // This is the load-bearing durability flush on all exit paths (clean,
      // aborted, and error). See ARCHITECTURE.md for the accepted close()-
      // flushes-latest-state semantic.
      await store.close()
    }
  }
}

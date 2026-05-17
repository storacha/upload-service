import ansiEscapes from 'ansi-escapes'
import chalk from 'chalk'
import { confirm } from '@inquirer/prompts'
import { executeMigration } from '@storacha/filecoin-pin-migration'
import { formatDuration, truncateDID } from '../view/format.js'
import {
  summarizeInventoryTotals,
  summarizeProgress,
} from '../view/progress-model.js'
import {
  printCommitBatchResult,
  renderMigrationStatusBlock,
} from '../view/progress.js'
import { printPhaseTitle } from '../view/phase.js'
import { printResumeStatus } from '../view/resume.js'
import { printSummary } from '../view/summary.js'

const LIVE_STATUS_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

/**
 * @param {object} args
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationPlan} args.plan
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} args.state
 * @param {import('@filoz/synapse-sdk').Synapse} args.synapse
 * @param {boolean} args.debug
 * @param {() => 'migrating' | undefined} args.consumeGracefulStopNoticePhase
 * @param {() => boolean} args.isStopRequested
 * @param {(state: import('@storacha/filecoin-pin-migration/types').MigrationState) => Promise<void>} args.persistCheckpoint
 * @param {AbortSignal} args.signal
 *
 * Note: inventory totals are captured once at migration start. Mutations to
 * state.spacesInventories after this call are not reflected in the live status
 * block.
 */
export async function runMigration({
  plan,
  state,
  synapse,
  debug,
  consumeGracefulStopNoticePhase,
  isStopRequested,
  persistCheckpoint,
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
   * }}
   */
  const liveStatus = {}
  const inventoryTotals = summarizeInventoryTotals(state)
  let progress = summarizeProgress(state, inventoryTotals)
  let progressDirty = false

  const markProgressDirty = () => {
    progressDirty = true
  }

  const getProgress = () => {
    if (progressDirty) {
      progress = summarizeProgress(state, inventoryTotals)
      progressDirty = false
    }
    return progress
  }

  let gracefulStopNoticePrinted = false
  const maybePrintGracefulStopNotice = () => {
    if (gracefulStopNoticePrinted || statusUpdatesPaused) return
    if (consumeGracefulStopNoticePhase() !== 'migrating') return
    gracefulStopNoticePrinted = true
    printPersistentMigrationLine(() => {
      console.log(
        chalk.yellow(
          'Will stop after the next migration checkpoint and save the current processing state before stopping.'
        )
      )
    })
  }

  /**
   * @param {() => void} print
   */
  const printPersistentMigrationLine = (print) => {
    statusUpdatesPaused = true
    try {
      clearStatusBlock()
      print()
      console.log('')
    } finally {
      statusUpdatesPaused = false
      renderStatusBlock()
    }
  }

  const clearStatusBlock = () => {
    if (!canRedraw || statusBlockPrinted === 0) return
    process.stdout.write(ansiEscapes.eraseLines(statusBlockPrinted))
    statusBlockPrinted = 0
  }

  const renderStatusBlock = ({ force = false } = {}) => {
    if (statusUpdatesPaused) return
    if (!canRedraw && !force) return
    clearStatusBlock()
    const block = renderMigrationStatusBlock({
      progress: getProgress(),
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
      maybePrintGracefulStopNotice()
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

  renderStatusBlock({ force: true })
  startHeartbeat()

  const migrationEvents = executeMigration({
    plan,
    state,
    synapse,
    signal,
  })

  for await (const event of migrationEvents) {
    maybePrintGracefulStopNotice()

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
        try {
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
        } finally {
          statusUpdatesPaused = false
          renderStatusBlock()
        }
        break
      }
      case 'migration:commit:settled':
        markProgressDirty()
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
        markProgressDirty()
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
        if (
          event.type === 'migration:phase:complete' ||
          event.type === 'migration:space:complete' ||
          event.type === 'migration:copy:complete'
        ) {
          markProgressDirty()
        }
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
        markProgressDirty()
        await persistCheckpoint(state)
        if (signal.aborted) {
          stopHeartbeat()
          clearStatusBlock()
          console.log(
            chalk.yellow(
              `Migration interrupted after ${formatDuration(
                Date.now() - startedAt
              )}.`
            )
          )
          return { interrupted: true }
        }
        if (isStopRequested()) {
          stopHeartbeat()
          return { interrupted: true }
        }
        renderStatusBlock()
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

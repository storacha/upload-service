import chalk from 'chalk'
import { formatDuration, truncateDID } from './format.js'
import { line, renderBox } from './layout.js'
import { formatCopyProgressLine } from './progress-model.js'

/**
 * Render the live migration status block.
 *
 * @param {object} args
 * @param {import('./progress-model.js').ProgressSummary} args.progress
 * @param {number} args.startedAt
 * @param {string} args.activityFrame
 * @param {string | undefined} args.currentSpaceDID
 * @param {number | undefined} args.currentCopyIndex
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationExecutionPhase | 'funding' | undefined} args.currentPhase
 * @param {number | undefined} args.currentItemCount
 * @param {number | undefined} args.currentBatchCount
 */
export function renderMigrationStatusBlock({
  progress,
  startedAt,
  activityFrame,
  currentSpaceDID,
  currentCopyIndex,
  currentPhase,
  currentItemCount,
  currentBatchCount,
}) {
  const {
    copies,
    totalPreparedShards,
    totalCommittedPairs,
    totalFailedUploads,
  } = progress
  const currentStage = formatCurrentStage(currentPhase)
  const currentDetail = formatCurrentDetail(currentPhase)

  const copyLines = copies
    .sort((a, b) => a.copyIndex - b.copyIndex)
    .map((copy) =>
      line(
        `Copy ${copy.copyIndex}`,
        formatCopyProgressLine(copy, {
          totalPreparedShards,
          totalCommittedPairs,
        })
      )
    )

  return renderBox(
    'Live Status',
    [
      line('Activity', `${activityFrame} running`),
      line('Elapsed', formatDuration(Date.now() - startedAt)),
      line(
        'Current space',
        currentSpaceDID ? truncateDID(currentSpaceDID) : '—'
      ),
      line(
        'Current copy',
        typeof currentCopyIndex === 'number' ? String(currentCopyIndex) : '—'
      ),
      line('Current stage', currentStage),
      line('Detail', currentDetail),
      line('Phase work', formatPhaseWork(currentItemCount, currentBatchCount)),
      ...copyLines,
      line('Total failed', String(totalFailedUploads)),
    ],
    chalk.cyan
  )
}

/**
 * @param {object} event
 * @param {number} event.copyIndex
 * @param {number} event.commitIndex
 * @param {number} event.pieceCount
 * @param {'succeeded' | 'failed'} event.status
 * @param {string | undefined} [event.txHash]
 * @param {Error | undefined} [event.error]
 */
export function printCommitBatchResult({
  copyIndex,
  commitIndex,
  pieceCount,
  status,
  txHash,
  error,
}) {
  const statusColor = status === 'succeeded' ? chalk.green : chalk.red
  const txValue = txHash ?? 'n/a'

  console.log(
    `  ${chalk.dim('commit')} ${commitIndex}  ${chalk.dim('copy')}=${copyIndex}  ${chalk.dim('pieces')}=${pieceCount}  ${chalk.dim('tx')}=${txValue}  ${statusColor(status)}`
  )

  if (status === 'failed' && error) {
    console.error(chalk.red(`    error: ${error.message}`))
  }
}

/**
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationEvent} event
 */
export function printMigrationLifecycleEvent(event) {
  switch (event.type) {
    case 'migration:space:start':
      console.log(
        `${chalk.dim('space')} ${truncateDID(event.spaceDID)}  ${chalk.cyan('started')}`
      )
      return
    case 'migration:space:complete':
      console.log(
        `${chalk.dim('space')} ${truncateDID(event.spaceDID)}  ${formatSpacePhase(event.phase)}`
      )
      return
    case 'migration:copy:start':
      console.log(
        `  ${chalk.dim('copy')} ${event.copyIndex}  ${chalk.cyan('started')}`
      )
      return
    case 'migration:copy:complete':
      console.log(
        `  ${chalk.dim('copy')} ${event.copyIndex}  ${event.completed ? chalk.green('completed') : chalk.yellow('stopped')}`
      )
      return
    case 'migration:phase:start': {
      const counts = formatPhaseCounts(event.itemCount, event.batchCount)
      console.log(
        `    ${chalk.dim('phase')} ${formatExecutionPhase(event.phase)}  ${chalk.dim('copy')}=${event.copyIndex}${counts}${chalk.cyan(' started')}`
      )
      return
    }
    case 'migration:phase:complete':
      console.log(
        `    ${chalk.dim('phase')} ${formatExecutionPhase(event.phase)}  ${chalk.dim('copy')}=${event.copyIndex}  ${event.completed ? chalk.green('completed') : chalk.yellow('stopped')}`
      )
      return
  }
}

/**
 * @param {import('@storacha/filecoin-pin-migration/types').SpacePhase} phase
 */
function formatSpacePhase(phase) {
  switch (phase) {
    case 'complete':
      return chalk.green('complete')
    case 'incomplete':
      return chalk.yellow('incomplete')
    case 'failed':
      return chalk.red('failed')
    case 'migrating':
      return chalk.cyan('migrating')
    case 'pending':
      return chalk.dim('pending')
  }
}

/**
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationExecutionPhase | 'funding' | undefined} phase
 */
function formatCurrentStage(phase) {
  if (!phase) return '—'
  if (phase === 'funding') return 'Funding'
  if (phase === 'commit') return 'Committing'
  return 'Transferring data'
}

/**
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationExecutionPhase | 'funding' | undefined} phase
 */
function formatCurrentDetail(phase) {
  switch (phase) {
    case 'funding':
      return 'adding USDFC to payments'
    case 'store':
      return 'by storing shard bytes'
    case 'source-pull':
      return 'from source'
    case 'secondary-pull':
      return 'from primary copy'
    case 'commit':
      return 'writing piece records on-chain'
    default:
      return '—'
  }
}

/**
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationExecutionPhase} phase
 */
function formatExecutionPhase(phase) {
  switch (phase) {
    case 'store':
      return 'store'
    case 'source-pull':
      return 'source-pull'
    case 'secondary-pull':
      return 'secondary-pull'
    case 'commit':
      return 'commit'
  }
}

/**
 * @param {number | undefined} itemCount
 * @param {number | undefined} batchCount
 */
function formatPhaseCounts(itemCount, batchCount) {
  const parts = []
  if (typeof itemCount === 'number') {
    parts.push(`${chalk.dim('items')}=${itemCount}`)
  }
  if (typeof batchCount === 'number') {
    parts.push(`${chalk.dim('batches')}=${batchCount}`)
  }
  return parts.length > 0 ? `  ${parts.join('  ')}` : ''
}

/**
 * @param {number | undefined} itemCount
 * @param {number | undefined} batchCount
 */
function formatPhaseWork(itemCount, batchCount) {
  const parts = []
  if (typeof itemCount === 'number') {
    parts.push(`${itemCount} items`)
  }
  if (typeof batchCount === 'number') {
    parts.push(`${batchCount} batches`)
  }
  return parts.length > 0 ? parts.join(', ') : '—'
}

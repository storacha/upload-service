import chalk from 'chalk'
import { truncateDID } from './format.js'
import { line, renderBox } from './layout.js'
import { summarizeProgress } from './progress-model.js'

/**
 * Print a status box showing progress from the persisted migration state.
 *
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} state
 * @param {object} [options]
 * @param {string} [options.title]
 * @param {boolean} [options.showWhenEmpty]
 */
export function printResumeStatus(
  state,
  { title = 'Resuming From', showWhenEmpty = false } = {}
) {
  const {
    copies,
    totalCommittedPairs,
    totalPreparedShards,
    totalFailedUploads,
    inventoryPartial,
    inventoryCount,
  } = summarizeProgress(state)

  const hasProgress = copies.some(
    (copy) => copy.committedPairs > 0 || copy.preparedShards > 0
  )
  if (!showWhenEmpty && !hasProgress) return

  console.log(
    renderBox(
      title,
      [
        line('Migration phase', state.phase),
        line(
          'Inventory',
          inventoryPartial
            ? `partial (${inventoryCount} space${inventoryCount === 1 ? '' : 's'})`
            : `${inventoryCount} space${inventoryCount === 1 ? '' : 's'}`
        ),
        line('Total shards', String(totalPreparedShards)),
        ...copies
          .sort((a, b) => a.copyIndex - b.copyIndex)
          .map((copy) =>
            line(
              `Copy ${copy.copyIndex}`,
              `prepared ${copy.preparedShards}/${totalPreparedShards}  committed ${copy.committedPairs}/${totalCommittedPairs}  failed uploads ${copy.failedUploads}`
            )
          ),
        line('Total failed', String(totalFailedUploads)),
        ...(inventoryPartial
          ? ['Reader phase is incomplete; inventory totals may be partial.']
          : []),
      ],
      chalk.cyan
    )
  )
  console.log('')
}

/**
 * @param {import('@storacha/filecoin-pin-migration/helper/types').PruneStagedShardsResult} result
 */
export function printStagedShardCleanup(result) {
  if (result.spaces.length === 0) return

  /** @type {string[]} */
  const lines = []

  for (const space of result.spaces) {
    for (const copy of space.copies) {
      const prefix = `${truncateDID(space.spaceDID)} copy ${copy.copyIndex}`

      if (copy.removedStagedShardCount > 0) {
        lines.push(
          `${prefix}: removed ${copy.removedStagedShardCount} stale staged shard(s)`
        )
      }

      if (copy.unverifiedStagedShardCount > 0) {
        lines.push(
          `${prefix}: ${copy.unverifiedStagedShardCount} staged shard(s) could not be verified`
        )
      }

      if (copy.skippedReason === 'missing-provider-url') {
        lines.push(`${prefix}: skipped SP check (missing provider URL)`)
      }
    }
  }

  if (lines.length === 0) return

  console.log(
    renderBox(
      'Resume Cleanup',
      lines,
      result.stateCorrected ? chalk.yellow : chalk.cyan
    )
  )
  console.log('')
}

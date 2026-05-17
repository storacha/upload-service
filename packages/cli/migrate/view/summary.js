import chalk from 'chalk'
import terminalLink from 'terminal-link'
import { formatBytes, formatDuration } from './format.js'
import { line, renderBox } from './layout.js'
import { formatCopyProgressLine, summarizeProgress } from './progress-model.js'

/**
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationSummary} summary
 * @param {number} [durationMs]
 * @param {number} [chainId]
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} [state]
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationPlan} [_plan]
 */
export function printSummary(summary, durationMs, chainId, state, _plan) {
  const hasSucceeded = summary.succeeded > 0
  const hasFailed = summary.failed > 0

  const title =
    hasSucceeded && !hasFailed
      ? 'Migration Complete'
      : hasSucceeded && hasFailed
        ? 'Migration Incomplete'
        : 'Migration Failed'

  const color =
    hasSucceeded && !hasFailed
      ? chalk.green
      : hasSucceeded && hasFailed
        ? chalk.yellow
        : chalk.red

  const copyLines = state
    ? buildCopySummaryLines(state)
    : [
        line('Succeeded', String(summary.succeeded)),
        line('Failed', String(summary.failed)),
      ]

  console.log('')
  console.log(
    renderBox(
      title,
      [
        ...copyLines,
        line('Skipped uploads', String(summary.skippedUploads)),
        line('Total bytes', formatBytes(summary.totalBytes)),
        ...(typeof durationMs === 'number'
          ? [line('Duration', formatDuration(durationMs))]
          : []),
        line(
          'Data sets',
          summary.dataSetIds.length > 0 ? summary.dataSetIds.join(', ') : 'none'
        ),
      ],
      color
    )
  )

  if (summary.dataSetIds.length > 0 && chainId != null) {
    printDataSetLinks(summary.dataSetIds, chainId)
  }
}

/**
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} state
 */
function buildCopySummaryLines(state) {
  const {
    copies,
    totalPreparedShards,
    totalCommittedPairs,
    totalFailedUploads,
  } = summarizeProgress(state)
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
  return [...copyLines, line('Total failed', String(totalFailedUploads))]
}

/**
 * @param {bigint[]} dataSetIds
 * @param {number} chainId
 */
function printDataSetLinks(dataSetIds, chainId) {
  const network = chainId === 314 ? 'mainnet' : 'calibration'
  console.log('')
  console.log(chalk.dim('Dataset links:'))
  for (const id of dataSetIds) {
    const url = `https://pdp.vxb.ai/${network}/dataset/${id}`
    console.log(`  ${terminalLink(url, url)}`)
  }
}

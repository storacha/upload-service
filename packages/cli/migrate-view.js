// @ts-expect-error no typings
import tree from 'pretty-tree'
import chalk from 'chalk'
import terminalLink from 'terminal-link'
import { formatEther } from 'viem'
import { filesize } from './lib.js'

/**
 * @param {object} args
 * @param {string} args.spaceDID
 * @param {string} args.walletAddress
 * @param {number} args.chainId
 * @param {string} args.chainName
 * @param {string} args.stateFile
 * @param {boolean} args.resume
 * @param {'pull' | 'store'} args.uploadMode
 * @param {{ walletUSDFC: bigint, walletFIL: bigint, depositedUSDFC: bigint }} args.preflight
 * @param {bigint} args.minFilGasBalance
 */
export function printPreflight({
  spaceDID,
  walletAddress,
  chainId,
  chainName,
  stateFile,
  resume,
  uploadMode,
  preflight,
  minFilGasBalance,
}) {
  console.log('')
  console.log(
    renderBox(
      'Migration Setup',
      [
        line('Space', spaceDID),
        line('Wallet', walletAddress),
        line('Chain', chainName),
        line('Chain ID', String(chainId)),
        line('Mode', resume ? 'resume' : 'fresh'),
        line('Upload mode', uploadMode),
      ],
      chalk.cyan
    )
  )
  console.log(chalk.dim(`State file: ${stateFile}`))

  console.log('')
  console.log(
    renderBox(
      'Balances',
      [
        line('Wallet FIL', `${formatTokenAmount(preflight.walletFIL)} FIL`),
        line(
          'Wallet USDFC',
          `${formatTokenAmount(preflight.walletUSDFC)} USDFC`
        ),
        line(
          'Deposited USDFC',
          `${formatTokenAmount(preflight.depositedUSDFC)} USDFC`
        ),
      ],
      chalk.blue
    )
  )

  /** @type {string[]} */
  const warnings = []
  if (preflight.walletFIL < minFilGasBalance) {
    warnings.push(
      `Wallet FIL balance is below the recommended minimum of ${formatTokenAmount(minFilGasBalance)} FIL for gas.`
    )
  }

  if (warnings.length > 0) {
    console.log('')
    console.warn(renderWarningSection('Preflight Warnings', warnings))
    console.warn('')
  }
}

/**
 *
 * @param {string} root
 * @param {string} shard
 * @param {string} reason
 */
export function printReaderShardFailed(root, shard, reason) {
  console.warn(
    renderNotice(
      'Shard skipped',
      [
        line('Root', truncateValue(root)),
        line('Shard', truncateValue(shard)),
        line('Reason', reason),
      ],
      chalk.yellow
    )
  )
}

/**
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationPlan} plan
 * @param {bigint} userWalletBalance
 * @param {bigint} userDeposit
 */
export function printPlan(plan, userWalletBalance, userDeposit) {
  console.log('')
  console.log(
    renderBox(
      'Migration Review',
      [
        line('Spaces', String(plan.costs.perSpace.length)),
        line(
          'Copies',
          String(
            plan.costs.perSpace.reduce(
              (sum, space) => sum + space.copies.length,
              0
            )
          )
        ),
        line('Uploads', String(plan.totals.uploads)),
        line('Shards', String(plan.totals.shards)),
        line('Source bytes', formatBytes(plan.totals.bytes)),
        line('Bytes to migrate', formatBytes(plan.totals.bytesToMigrate)),
        line('Ready', plan.ready ? chalk.green('yes') : chalk.yellow('no')),
      ],
      chalk.cyan
    )
  )

  console.log(chalk.cyan.bold('\nPlanned copies'))
  console.log(renderPlanTree(plan))

  if (plan.warnings.length > 0) {
    console.warn('')
    console.warn(renderWarningSection('Warnings', plan.warnings))
    console.warn('')
  }

  if (plan.fundingAmount > 0n && userDeposit < plan.fundingAmount) {
    const walletHasEnough = userWalletBalance >= plan.fundingAmount
    const walletStatus = walletHasEnough
      ? ` ${chalk.bgGreen.black(' AVAILABLE ')}`
      : ''

    console.log('')
    console.log(
      renderBox(
        walletHasEnough ? 'Deposit Required' : 'Insufficient Funds',
        [
          line('Requirement', `${formatTokenAmount(plan.fundingAmount)} USDFC`),
          line(
            'Wallet balance',
            `${formatTokenAmount(userWalletBalance)} USDFC${walletStatus}`
          ),
        ],
        walletHasEnough ? chalk.blue : chalk.red
      )
    )
    console.log(
      chalk.dim(
        `(${formatTokenAmount(plan.costs.totalDepositNeeded)} USDFC deposit + 5% for safety reasons to avoid transaction failure)`
      )
    )

    console.log(
      walletHasEnough
        ? chalk.cyan(
            `\nThe required funding is available in the wallet and will be processed during the funding phase.\n`
          )
        : chalk.red(
            `\nYou need at least ${formatTokenAmount(plan.fundingAmount)} USDFC in your wallet before the funding phase can proceed.\n`
          )
    )
  }
}

/**
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationSummary} summary
 * @param {number} [durationMs]
 * @param {number} [chainId]
 */
export function printSummary(summary, durationMs, chainId) {
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

  console.log('')
  console.log(
    renderBox(
      title,
      [
        line('Succeeded', String(summary.succeeded)),
        line('Failed', String(summary.failed)),
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

/**
 * @param {object} args
 * @param {bigint} args.sizeBytes
 * @param {bigint} args.months
 * @param {number} args.copies
 * @param {import('@storacha/filecoin-pin-migration/types').StorageRetentionCostEstimate} args.estimate
 * @param {string} args.networkName
 */
export function renderStorageRetentionCostEstimate({
  sizeBytes,
  months,
  copies,
  estimate,
  networkName,
}) {
  const rows = [
    [
      'Storage size',
      `${formatBytes(sizeBytes)} (${sizeBytes.toString()} bytes)`,
    ],
    ['Copies', String(copies)],
    ['Months', months.toString()],
    ['Network', networkName],
    [
      'Rate / month / copy',
      `${formatTokenAmount(estimate.ratePerMonthPerCopy)} USDFC`,
    ],
    [
      'Rate / month total',
      `${formatTokenAmount(estimate.ratePerMonthTotal)} USDFC`,
    ],
    [
      `Spend over ${months.toString()}m`,
      `${formatTokenAmount(estimate.storageSpendTotal)} USDFC`,
    ],
    [
      'Dataset creation fee',
      `${formatTokenAmount(estimate.sybilFeeTotal)} USDFC`,
    ],
    ...(estimate.cdnFixedLockupTotal > 0n
      ? [
          [
            'CDN fixed lockup',
            `${formatTokenAmount(estimate.cdnFixedLockupTotal)} USDFC`,
          ],
        ]
      : []),
    [
      'Collateral (refundable)',
      `${formatTokenAmount(estimate.totalLockedInContract)} USDFC`,
    ],
    [
      `Total deposit needed ${months.toString()}m`,
      `${formatTokenAmount(estimate.recommendedAvailableForPeriod)} USDFC`,
    ],
  ]
  const labelWidth = rows.reduce(
    (max, [label]) => Math.max(max, label.length),
    0
  )
  const lines = rows.map(([label, value]) =>
    formatKeyValueLine(label, value, labelWidth + 2)
  )

  return renderBox('Storage Cost Estimate', lines, chalk.cyan)
}

/**
 * @param {object} args
 * @param {import('@storacha/filecoin-pin-migration/types').StorageRetentionCostEstimate} args.estimate
 */
export function renderStorageRetentionCostPricingNote({ estimate }) {
  return chalk.dim(
    [
      ` Minimum monthly floor: ${formatTokenAmount(estimate.minimumPricePerMonth)} USDFC.`,
      ' The floor exists so the SP always earns a minimum regardless of how small the dataset is.',
      ` Price per TiB / month (no CDN): ${formatTokenAmount(estimate.pricePerTiBPerMonthNoCDN)} USDFC.`,
    ].join('\n')
  )
}

/**
 * @param {string} title
 */
export function printPhaseTitle(title) {
  const line = '━'.repeat(60)

  console.log('\n')
  console.log(chalk.cyan('┃ ') + chalk.bold(title.toUpperCase()))
  console.log(chalk.cyan(`┗${line}`))
  console.log('')
}

/**
 * @param {string} title
 * @param {string[]} lines
 * @param {(text: string) => string} color
 */
export function renderNotice(title, lines, color) {
  return renderBox(title, lines, color)
}

/**
 * Render the live migration status block.
 *
 * @param {object} args
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} args.state
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationPlan} args.plan
 * @param {'pull' | 'store'} args.uploadMode
 * @param {number} args.startedAt
 * @param {string} args.activityFrame
 * @param {string | undefined} args.currentSpaceDID
 * @param {number | undefined} args.currentCopyIndex
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationExecutionPhase | 'funding' | undefined} args.currentPhase
 * @param {number | undefined} args.currentItemCount
 * @param {number | undefined} args.currentBatchCount
 */
export function renderMigrationStatusBlock({
  state,
  plan,
  uploadMode,
  startedAt,
  activityFrame,
  currentSpaceDID,
  currentCopyIndex,
  currentPhase,
  currentItemCount,
  currentBatchCount,
}) {
  const { copies, totalPerCopy, totalFailedUploads } = summarizeProgress(
    state,
    plan
  )
  const currentStage = formatCurrentStage(currentPhase)
  const currentDetail = formatCurrentDetail(currentPhase)

  const copyLines = copies
    .sort((a, b) => a.copyIndex - b.copyIndex)
    .map((c) => {
      const base = `staged ${c.staged}/${totalPerCopy}  committed ${c.committed}/${totalPerCopy}  failed ${c.failedUploads}`
      const value = uploadMode === 'store' ? `${base}` : base
      return line(`Copy ${c.copyIndex}`, value)
    })

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
 * Print a status box showing per-copy progress before resuming execution.
 * No-ops when no progress exists yet.
 *
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} state
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationPlan} plan
 */
export function printResumeStatus(state, plan) {
  const { copies, totalPerCopy, totalFailedUploads } = summarizeProgress(
    state,
    plan
  )

  const hasProgress = copies.some((c) => c.committed > 0 || c.staged > 0)
  if (!hasProgress) return

  console.log(
    renderBox(
      'Resuming From',
      [
        line('Total shards', String(totalPerCopy)),
        ...copies
          .sort((a, b) => a.copyIndex - b.copyIndex)
          .map((c) =>
            line(
              `Copy ${c.copyIndex}`,
              `staged ${c.staged}/${totalPerCopy}  committed ${c.committed}/${totalPerCopy}  failed uploads ${c.failedUploads}`
            )
          ),
        line('Total failed', String(totalFailedUploads)),
      ],
      chalk.cyan
    )
  )
  console.log('')
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
 * @param {string} value
 */
export function truncateDID(value) {
  const prefixLength = 18
  const suffixLength = 5

  if (value.length <= prefixLength + suffixLength) return value

  const start = value.slice(0, prefixLength)
  const end = value.slice(-suffixLength)

  return `${start}...${end}`
}

/**
 * @param {string} value
 * @param {number} [maxLength]
 */
export function truncateValue(value, maxLength = 64) {
  if (value.length <= maxLength) return value
  const visible = Math.max(maxLength - 3, 10)
  const head = Math.ceil(visible * 0.65)
  const tail = Math.floor(visible * 0.35)
  return `${value.slice(0, head)}...${value.slice(-tail)}`
}

/**
 * @param {bigint} bytes
 */
export function formatBytes(bytes) {
  return filesize(Number(bytes))
}

/**
 * @param {bigint} value
 */
export function formatTokenAmount(value) {
  return Number(formatEther(value)).toLocaleString(undefined, {
    maximumFractionDigits: 4,
  })
}

/**
 * @param {number} durationMs
 */
export function formatDuration(durationMs) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }

  return `${seconds}s`
}

/**
 * @param {string} label
 * @param {string} value
 */
function line(label, value) {
  return `${chalk.dim(label.padEnd(16))} ${value}`
}

/**
 * @param {string} label
 * @param {string} value
 * @param {number} labelWidth
 */
function formatKeyValueLine(label, value, labelWidth) {
  return `${chalk.dim(label.padEnd(labelWidth))} ${value}`
}

/**
 * @param {string} title
 * @param {string[]} lines
 * @param {(text: string) => string} color
 */
function renderBox(title, lines, color) {
  const width = Math.max(
    title.length,
    ...lines.map((entry) => stripAnsi(entry).length)
  )
  const top = `┌─ ${title} ${'─'.repeat(Math.max(width - title.length - 1, 0))}┐`
  const body = lines.map(
    (entry) => `│ ${entry}${' '.repeat(width - stripAnsi(entry).length)} │`
  )
  const bottom = `└${'─'.repeat(width + 2)}┘`
  return color([top, ...body, bottom].join('\n'))
}

/**
 * @param {string} title
 * @param {string[]} lines
 */
function renderWarningSection(title, lines) {
  const header = chalk.yellow(`┌─ ${title} ${'─'.repeat(16)}`)
  const body = lines.map((line) => chalk.yellow(`  • ${line}`))
  return [header, ...body].join('\n')
}

/**
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationPlan} plan
 */
function renderPlanTree(plan) {
  const render = typeof tree.plain === 'function' ? tree.plain : tree
  return render({
    label: 'spaces',
    nodes: plan.costs.perSpace.map((space) => ({
      label: `${space.spaceDID}`,
      nodes: space.copies.map((copy) => ({
        label: `copy ${copy.copyIndex}`,
        leaf: [
          `provider ${copy.providerId.toString()}`,
          `dataset ${copy.dataSetId != null ? copy.dataSetId.toString() : 'new'}`,
        ],
      })),
    })),
  })
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

/**
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} state
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationPlan} plan
 */
function summarizeProgress(state, plan) {
  /** @type {Array<{ copyIndex: number, committed: number, staged: number, failedUploads: number }>} */
  const copies = []

  for (const space of Object.values(state.spaces)) {
    for (const copy of space.copies) {
      const staged = new Set([
        ...copy.committed,
        ...copy.pulled,
        ...Object.keys(copy.storedShards),
      ]).size
      copies.push({
        copyIndex: copy.copyIndex,
        committed: copy.committed.size,
        staged,
        failedUploads: copy.failedUploads.size,
      })
    }
  }

  const totalFailedUploads = copies.reduce((sum, c) => sum + c.failedUploads, 0)

  return {
    copies,
    totalPerCopy: plan.totals.shards,
    totalFailedUploads,
  }
}

/**
 * @param {string} value
 */
function stripAnsi(value) {
  const escape = String.fromCharCode(27)
  return value.replace(new RegExp(`${escape}\\[[0-9;]*m`, 'g'), '')
}

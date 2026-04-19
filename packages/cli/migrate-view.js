// @ts-expect-error no typings
import tree from 'pretty-tree'
import chalk from 'chalk'
import ansiEscapes from 'ansi-escapes'
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
        line('Shard roots', String(plan.totals.shards)),
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
        `(${formatTokenAmount(plan.costs.totalDepositNeeded)} USDFC deposit + 3% for safety reasons to avoid transaction failure)`
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
 */
export function printSummary(summary) {
  console.log('')
  console.log(
    renderBox(
      'Migration Complete',
      [
        line('Succeeded', String(summary.succeeded)),
        line('Failed', String(summary.failed)),
        line('Skipped uploads', String(summary.skippedUploads)),
        line('Total bytes', formatBytes(summary.totalBytes)),
        line(
          'Data sets',
          summary.dataSetIds.length > 0 ? summary.dataSetIds.join(', ') : 'none'
        ),
        line('Duration', formatDuration(summary.duration)),
      ],
      chalk.green
    )
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
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} state
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationPlan} plan
 * @param {'pull' | 'store'} [uploadMode]
 */
export function checkpointSpinnerText(state, plan, uploadMode = 'pull') {
  const progress = summarizeProgress(state, plan)

  if (uploadMode === 'store') {
    return `Storing, pulling, and committing copies... stored=${progress.stored} pulled=${progress.pulled} committed=${progress.committed}/${progress.total} failedUploads=${progress.failedUploads}`
  }

  return `Pulling and committing copies... pulled=${progress.pulled} committed=${progress.committed}/${progress.total} failedUploads=${progress.failedUploads}`
}

/**
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} state
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationPlan} plan
 * @param {boolean} alreadyPrinted
 * @param {'pull' | 'store'} [uploadMode]
 */
export function renderCheckpointProgress(
  state,
  plan,
  alreadyPrinted,
  uploadMode = 'pull'
) {
  const progress = summarizeProgress(state, plan)
  const lines =
    uploadMode === 'store'
      ? [
          chalk.dim('Progress'),
          `  stored ${progress.stored}  pulled ${progress.pulled}  committed ${progress.committed}/${progress.total}  failed uploads ${progress.failedUploads}`,
        ]
      : [
          chalk.dim('Progress'),
          `  pulled ${progress.pulled}  committed ${progress.committed}/${progress.total}  failed uploads ${progress.failedUploads}`,
        ]

  if (alreadyPrinted) {
    process.stdout.write(ansiEscapes.eraseLines(lines.length))
  }
  process.stdout.write(`${lines.join('\n')}\n`)
  return true
}

/**
 * @param {string} value
 */
export function truncateDID(value) {
  return value.length > 22 ? `${value.slice(0, 18)}...` : value
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
 * @param {number} durationMs
 */
function formatDuration(durationMs) {
  const totalSeconds = Math.max(Math.round(durationMs / 1000), 0)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${seconds}s`
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
 * @param {string} label
 * @param {string} value
 */
function line(label, value) {
  return `${chalk.dim(label.padEnd(16))} ${value}`
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
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} state
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationPlan} plan
 */
function summarizeProgress(state, plan) {
  let stored = 0
  let pulled = 0
  let committed = 0
  let failedUploads = 0
  let copies = 0

  for (const space of Object.values(state.spaces)) {
    copies += space.copies.length
    for (const copy of space.copies) {
      stored += Object.keys(copy.storedShards).length
      pulled += copy.pulled.size
      committed += copy.committed.size
      failedUploads += copy.failedUploads.size
    }
  }

  return {
    stored,
    pulled,
    committed,
    failedUploads,
    total: plan.totals.shards * copies,
  }
}

/**
 * @param {string} value
 */
function stripAnsi(value) {
  const escape = String.fromCharCode(27)
  return value.replace(new RegExp(`${escape}\\[[0-9;]*m`, 'g'), '')
}

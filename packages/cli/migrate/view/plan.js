// @ts-expect-error no typings
import tree from 'pretty-tree'
import chalk from 'chalk'
import { formatBytes, formatTokenAmount } from './format.js'
import { line, renderBox, renderWarningSection } from './layout.js'

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
        line('Bytes to migrate', formatBytes(plan.totals.bytesToMigrate)),
        line('Ready', plan.ready ? chalk.green('yes') : chalk.yellow('no')),
      ],
      chalk.cyan
    )
  )

  console.log('')
  console.log(renderPlanCostBreakdown(plan))

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
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationPlan} plan
 */
function renderPlanCostBreakdown(plan) {
  const sybilFee = plan.costs.perSpace.reduce(
    (sum, space) => sum + space.sybilFee,
    0n
  )
  const cdnFixedLockup = plan.costs.perSpace.reduce(
    (sum, space) => sum + space.cdnFixedLockup,
    0n
  )

  return renderBox(
    'Cost Breakdown',
    [
      line(
        'Total lockup',
        `${formatTokenAmount(plan.costs.summary.totalLockupUSDFC)} USDFC`
      ),
      line('Dataset fee', `${formatTokenAmount(sybilFee)} USDFC`),
      line('CDN fixed lockup', `${formatTokenAmount(cdnFixedLockup)} USDFC`),
      line(
        'Rate / month',
        `${formatTokenAmount(plan.costs.summary.totalRatePerMonth)} USDFC`
      ),
    ],
    chalk.blue
  )
}

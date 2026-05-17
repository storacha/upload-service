import chalk from 'chalk'
import { formatBytes, formatTokenAmount } from './format.js'
import {
  formatKeyValueLine,
  line,
  renderBox,
  renderWarningSection,
} from './layout.js'

/**
 * @param {object} args
 * @param {string} args.spaceDID
 * @param {string} args.walletAddress
 * @param {number} args.chainId
 * @param {string} args.chainName
 * @param {string} args.stateFile
 * @param {'fresh' | 'resume' | 'retry'} args.mode
 * @param {{ walletUSDFC: bigint, walletFIL: bigint, depositedUSDFC: bigint }} args.preflight
 * @param {bigint} args.minFilGasBalance
 */
export function printPreflight({
  spaceDID,
  walletAddress,
  chainId,
  chainName,
  stateFile,
  mode,
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
        line('Mode', mode),
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
 * @param {object} args
 * @param {bigint} args.sizeBytes
 * @param {bigint} args.months
 * @param {number} args.copies
 * @param {import('@storacha/filecoin-pin-migration/helper/types').StorageRetentionCostEstimate} args.estimate
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
    [
      'CDN fixed lockup',
      `${formatTokenAmount(estimate.cdnFixedLockupTotal)} USDFC`,
    ],
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
 * @param {import('@storacha/filecoin-pin-migration/helper/types').StorageRetentionCostEstimate} args.estimate
 */
export function renderStorageRetentionCostPricingNote({ estimate }) {
  return chalk.dim(
    [
      ` Minimum monthly floor: ${formatTokenAmount(estimate.minimumPricePerMonth)} USDFC.`,
      ' The floor exists so the SP always earns a minimum regardless of how small the dataset is.',
      ` Base storage price per TiB / month: ${formatTokenAmount(estimate.pricePerTiBPerMonthNoCDN)} USDFC.`,
      ' CDN does not change the monthly storage rate, it only adds a fixed lockup on new datasets.',
    ].join('\n')
  )
}

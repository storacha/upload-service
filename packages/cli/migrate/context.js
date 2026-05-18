import path from 'node:path'
import process from 'node:process'
import ora from 'ora'
import { TOKENS } from '@filoz/synapse-sdk'
import { privateKeyToAccount } from 'viem/accounts'
import { getClient } from '../lib.js'

const DEFAULT_STATE_FILE_BASENAME = 'storacha-migration'

/**
 * @param {string} spaceDID
 */
export function defaultStateFileForSpace(spaceDID) {
  const safeSpace = spaceDID.replace(/[^a-zA-Z0-9._-]+/g, '-')
  return path.join(
    process.cwd(),
    `${DEFAULT_STATE_FILE_BASENAME}-${safeSpace}.json`
  )
}

/**
 * @param {string | undefined} stateFile
 * @param {'json' | 'sqlite' | undefined} stateFormat
 */
export async function resolveMigrationContext(stateFile, stateFormat) {
  const client = await getClient()
  const currentSpace = client.currentSpace()
  if (!currentSpace) {
    console.error(
      'Error: no current space, use "space create" to create one or select one using "space use"'
    )
    process.exit(1)
  }

  const spaceDID = currentSpace.did()

  const resolvedStateFile = path.resolve(
    stateFile ?? defaultStateFileForSpace(spaceDID)
  )

  return {
    client,
    spaceDID,
    stateFile: resolvedStateFile,
    stateFormat: resolveStateFormat(resolvedStateFile, stateFormat),
  }
}

/**
 * @param {string} stateFile
 * @param {'json' | 'sqlite' | undefined} requestedFormat
 * @returns {'json' | 'sqlite'}
 */
export function resolveStateFormat(stateFile, requestedFormat) {
  const extension = path.extname(stateFile).toLowerCase()
  const extensionFormat =
    extension === '.db' || extension === '.sqlite'
      ? 'sqlite'
      : extension === '.json'
        ? 'json'
        : undefined

  if (
    requestedFormat &&
    extensionFormat &&
    requestedFormat !== extensionFormat
  ) {
    console.error(
      `Error: state format "${requestedFormat}" conflicts with state file extension "${extension}". Use a matching file name or omit --state-format.`
    )
    process.exit(1)
  }

  if (requestedFormat) {
    return requestedFormat
  }

  return extensionFormat ?? 'json'
}

/**
 * @param {string | undefined} walletPk
 */
export function createWalletAccount(walletPk) {
  try {
    return privateKeyToAccount(/** @type {`0x${string}`} */ (walletPk))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Error: invalid wallet private key - ${message}`)
    process.exit(1)
  }
}

/**
 * @param {import('@filoz/synapse-sdk').Synapse} synapse
 */
export async function loadPreflight(synapse) {
  const spinner = ora({
    text: 'Checking wallet and payments balances...',
    color: 'cyan',
  }).start()

  try {
    const [walletUSDFC, walletFIL, depositedUSDFC] = await Promise.all([
      synapse.payments.walletBalance({ token: TOKENS.USDFC }),
      synapse.payments.walletBalance({ token: TOKENS.FIL }),
      synapse.payments.balance({ token: TOKENS.USDFC }),
    ])

    spinner.succeed('Balances loaded')
    return {
      walletUSDFC,
      walletFIL,
      depositedUSDFC,
    }
  } catch (err) {
    spinner.fail(
      `Failed to load balances: ${
        err instanceof Error ? err.message : String(err)
      }`
    )
    throw err
  }
}

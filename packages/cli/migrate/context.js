import path from 'node:path'
import process from 'node:process'
import ora from 'ora'
import { TOKENS } from '@filoz/synapse-sdk'
import { privateKeyToAccount } from 'viem/accounts'
import { getClient } from '../lib.js'
import { defaultStateFileForSpace } from './state-file.js'

/**
 * @param {string | undefined} stateFile
 */
export async function resolveMigrationContext(stateFile) {
  const client = await getClient()
  const currentSpace = client.currentSpace()
  if (!currentSpace) {
    console.error(
      'Error: no current space, use "space create" to create one or select one using "space use"'
    )
    process.exit(1)
  }

  const spaceDID = currentSpace.did()

  return {
    client,
    spaceDID,
    stateFile: path.resolve(stateFile ?? defaultStateFileForSpace(spaceDID)),
  }
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

import { AccountUsage as AccountUsageCapabilites } from '@storacha/capabilities'
import * as API from '../../types.js'
import { Base } from '../../base.js'

/**
 * Client for interacting with the `usage/*` capabilities.
 */
export class AccountUsageClient extends Base {
  /**
   * Get a usage report for the passed space in the given time period.
   *
   * Required delegated capabilities:
   * - `usage/report`
   *
   * @param {API.AccountDID} account
   * @param {object} [options]
   * @param {{ from: Date, to: Date }} [options.period]
   * @param {import('../../types.js').SpaceDID[]} [options.spaces]
   * @param {string} [options.nonce]
   */
  async get(account, options) {
    const out = await get({ agent: this.agent }, { ...options, account })
    /* c8 ignore next 7 */
    if (!out.ok) {
      throw new Error(`failed ${AccountUsageCapabilites.get.can} invocation`, {
        cause: out.error,
      })
    }

    return out.ok
  }
}

/**
 * Get a usage report for the period.
 *
 * @param {{agent: API.Agent}} client
 * @param {object} options
 * @param {API.AccountDID} options.account
 * @param {API.SpaceDID[]} [options.spaces]
 * @param {{ from: Date, to: Date }} [options.period]
 * @param {string} [options.nonce]
 * @param {API.Delegation[]} [options.proofs]
 * @returns {Promise<API.Result<API.UsageReportSuccess, API.UsageReportFailure>>}
 */
export const get = async (
  { agent },
  { account, spaces, period, nonce, proofs = [] }
) => {
  const receipt = await agent.invokeAndExecute(AccountUsageCapabilites.get, {
    with: account,
    proofs,
    nonce,
    nb: {
      spaces,
      period: period
        ? {
            from: Math.floor(period.from.getTime() / 1000),
            to: Math.ceil(period.to.getTime() / 1000),
          }
        : undefined,
    },
  })
  return receipt.out
}

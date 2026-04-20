import { FundingFailedFailure } from '../errors.js'
import { transitionToFunded } from '../state.js'

/**
 * @import * as API from '../api.js'
 */

/**
 * Fund once if a deposit is needed.
 *
 * When costs.ready is true (deposit = 0 and FWSS approved) no transaction is
 * needed — transition state to 'funded' silently. On resume this is the common
 * path since the deposit was already made in a prior run.
 *
 * Yields funding:failed then re-throws so the generator terminates cleanly
 * and the consumer receives a terminal signal.
 *
 * @param {API.MigrationCostResult} costs
 * @param {bigint} fundingAmount
 * @param {API.Synapse} synapse
 * @param {API.MigrationState} state
 * @returns {AsyncGenerator<API.MigrationEvent>}
 */
export async function* ensureFunding(costs, fundingAmount, synapse, state) {
  if (costs.ready) {
    if (state.phase === 'approved') transitionToFunded(state)
    return
  }

  yield { type: 'funding:start', amount: fundingAmount }

  /** @type {string} */
  let txHash
  try {
    const result = await synapse.payments.fundSync({
      amount: fundingAmount,
      needsFwssMaxApproval: costs.needsFwssMaxApproval,
    })
    if (result.receipt.status === 'reverted') {
      throw new Error(
        `Funding transaction ${result.hash} failed with status ${result.receipt.status}`
      )
    }
    txHash = result.hash
  } catch (err) {
    const error = new FundingFailedFailure(
      err instanceof Error ? err.message : String(err)
    )
    yield { type: 'funding:failed', error }
    throw error
  }

  transitionToFunded(state)
  yield { type: 'funding:complete', txHash }
}

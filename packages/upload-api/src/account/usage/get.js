import * as API from '../../types.js'
import * as Provider from '@ucanto/server'
import { AccountUsage } from '@storacha/capabilities'
import * as Server from '@ucanto/server'

/** @param {API.AccountUsageServiceContext} context */
export const provide = (context) =>
  Provider.provide(AccountUsage.get, (input) => get(input, context))

/**
 * @param {{capability: { with: API.AccountDID, nb: API.InferInvokedCapability<AccountUsage.get>['nb']}}} input
 * @param {API.AccountUsageServiceContext} context
 * @returns {Promise<API.Result<API.AccountUsageGetSuccess, API.AccountUsageGetFailure>>}
 */
export const get = async ({ capability }, context) => {
  const account = capability.with
  const subscriptions = await context.subscriptionsStorage.list(account)
  if (subscriptions.error) return subscriptions
  let subscriptionsBySpace = subscriptions.ok.results.reduce((spaces, sub) => {
    sub.consumers.forEach((consumer) => {
      spaces[consumer] = spaces[consumer] || []
      spaces[consumer].push(sub.provider)
    })
    return spaces
  }, /** @type {Record<API.SpaceDID, API.ProviderDID[]>} */ ({}))
  if (capability.nb.spaces) {
    /** @type {Record<API.SpaceDID, API.ProviderDID[]>} */
    const filteredSubscriptionsBySpace = {}
    // ensure all requested spaces are subscribed by the account
    for (const space of capability.nb.spaces) {
      if (!subscriptionsBySpace[space]) {
        return {
          error: new NoSubscriptionError(
            `No subscription found for account ${account} in space ${space}`
          ),
        }
      }
      filteredSubscriptionsBySpace[space] = subscriptionsBySpace[space]
    }
    // filter to only requested spaces
    subscriptionsBySpace = filteredSubscriptionsBySpace
  }

  // lexicographically order by space DID
  subscriptionsBySpace = Object.fromEntries(
    Object.entries(subscriptionsBySpace).sort(([a], [b]) => (a < b ? -1 : 1))
  )

  const now = new Date()
  const from =
    capability.nb.period?.from !== undefined
      ? new Date(capability.nb.period.from * 1000)
      : startOfLastMonth(now)
  const to = capability.nb.period?.to
    ? new Date(capability.nb.period.to * 1000)
    : now
  const period = { from, to }

  /** @type {API.AccountUsageGetSuccess} */
  const bySpace = {
    total: 0,
    spaces: {},
  }
  const subsBySpaceEntries =
    /** @type {[API.SpaceDID, API.ProviderDID[]][]} */
    (Object.entries(subscriptionsBySpace))

  const reports = await Promise.all(
    subsBySpaceEntries.map(([space, providers]) =>
      // lexicographically order providers by Provider DID
      Promise.all(
        providers
          .sort()
          .map((p) => context.usageStorage.report(p, space, period))
      )
    )
  )

  for (const report of reports.flat()) {
    if (report.error) return report
    const { provider, space, size } = report.ok
    /** @type {API.SpaceUsage} */
    bySpace.spaces[space] = bySpace.spaces[space] ?? { total: 0, providers: {} }
    bySpace.spaces[space].providers[provider] = report.ok
    bySpace.spaces[space].total += size.final
    bySpace.total += size.final
  }

  return { ok: bySpace }
}

class NoSubscriptionError extends Server.Failure {
  #message

  /**
   *
   * @param {string} message
   * @param {ErrorOptions} [options]
   */
  constructor(message, options) {
    super(message, options)
    this.#message = message
  }

  describe() {
    return this.#message
  }

  get name() {
    return 'NoSubscription'
  }
}

/**
 * @param {string | number | Date} now
 */
const startOfMonth = (now) => {
  const d = new Date(now)
  d.setUTCDate(1)
  d.setUTCHours(0)
  d.setUTCMinutes(0)
  d.setUTCSeconds(0)
  d.setUTCMilliseconds(0)
  return d
}

/**
 * @param {string | number | Date} now
 */
const startOfLastMonth = (now) => {
  const d = startOfMonth(now)
  d.setUTCMonth(d.getUTCMonth() - 1)
  return d
}

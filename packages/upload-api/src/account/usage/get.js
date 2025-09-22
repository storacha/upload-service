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
  let spaces = subscriptions.ok.results.reduce((spaces, sub) => {
    sub.consumers.forEach((consumer) => {
      spaces.add(consumer)
    })
    return spaces
  }, /** @type {Set<API.SpaceDID>} */ (new Set()))
  if (capability.nb.spaces) {
    // ensure all requested spaces are subscribed by the account
    for (const space of capability.nb.spaces) {
      if (!spaces.has(space)) {
        return {
          error: new NoSubscriptionError(
            `No subscription found for account ${account} in space ${space}`
          ),
        }
      }
    }
    spaces = new Set(capability.nb.spaces)
  }

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
  const byProvider = {
    total: 0,
    providers: {},
  }
  for (const sub of subscriptions.ok.results) {
    /** @type {API.ProviderUsage} */
    const providerReport = byProvider.providers[sub.provider] || {
      total: 0,
      spaces: {},
    }
    for (const space of sub.consumers) {
      if (!spaces.has(space)) continue
      const res = await context.usageStorage.report(sub.provider, space, period)
      if (res.error) return res
      providerReport.spaces[space] = res.ok
      providerReport.total += res.ok.size.final
      byProvider.total += res.ok.size.final
    }
    byProvider.providers[sub.provider] = providerReport
  }
  return { ok: byProvider }
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

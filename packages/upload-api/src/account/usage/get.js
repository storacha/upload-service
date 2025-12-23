import * as API from '../../types.js'
import * as Provider from '@ucanto/server'
import { AccountUsage } from '@storacha/capabilities'
import * as Server from '@ucanto/server'

/** @param {API.AccountUsageServiceContext} context */
export const provide = (context) =>
  Provider.provide(AccountUsage.get, (input) => get(input, context))

/**
 * Wraps a promise that returns a Result with a timeout.
 * @param {Promise<API.Result<any, any>>} promise
 * @param {number} timeoutMs
 * @param {string} timeoutMessage
 * @returns {Promise<API.Result<any, any>>}
 */
const resultWithTimeout = async (promise, timeoutMs, timeoutMessage) => {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
  )
  try {
    return await Promise.race([promise, timeout])
  } catch (error) {
    return /** @type {any} */ (
      Server.error(
        new Server.Failure(
          error instanceof Error ? error.message : String(error)
        )
      )
    )
  }
}

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

  // lexocographically order by space DID
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
  const result = {
    total: 0,
    spaces: {},
    egress: {
      total: 0,
      spaces: {},
    },
  }
  for (const [
    space,
    providers,
  ] of /** @type {[API.SpaceDID, API.ProviderDID[]][]} */ (
    Object.entries(subscriptionsBySpace)
  )) {
    /** @type {API.SpaceUsage} */
    result.spaces[space] = {
      total: 0,
      providers: {},
    }
    /** @type {API.SpaceEgressUsage} */
    result.egress.spaces[space] = {
      total: 0,
      providers: {},
    }

    // lexographically order providers by Provider DID
    for (const provider of providers.sort()) {
      // Storage usage
      const reportTimeout = 8000 // 8 seconds is a bit less than the lambda timeout
      const [storageRes, egressRes] = await Promise.all([
        resultWithTimeout(
          context.usageStorage.report(provider, space, period),
          reportTimeout,
          'Storage usage report timed out'
        ),
        resultWithTimeout(
          context.usageStorage.reportEgress(provider, space, period),
          reportTimeout,
          'Egress usage report timed out'
        ),
      ])

      // Log any errors
      if (storageRes.error) {
        console.error(
          `Storage usage report error for provider ${provider}, space ${space}:`,
          storageRes.error
        )
      }

      if (egressRes.error) {
        console.error(
          `Egress usage report error for provider ${provider}, space ${space}:`,
          egressRes.error
        )
      }

      // Only fail if both timed out
      if (storageRes.error && egressRes.error) {
        return storageRes
      }

      if (storageRes.ok) {
        result.spaces[space].providers[provider] = storageRes.ok
        result.spaces[space].total += storageRes.ok.size.final
        result.total += storageRes.ok.size.final
      }

      if (egressRes.ok) {
        result.egress.spaces[space].providers[provider] = egressRes.ok
        result.egress.spaces[space].total += egressRes.ok.total
        result.egress.total += egressRes.ok.total
      }
    }
  }
  return { ok: result }
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

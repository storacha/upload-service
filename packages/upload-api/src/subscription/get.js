import * as API from '../types.js'
import * as Server from '@ucanto/server'
import { Subscription } from '@storacha/capabilities'

/**
 * @param {API.SubscriptionServiceContext} context
 */
export const provide = (context) =>
  Server.provide(Subscription.get, (input) => get(input, context))

/**
 * @param {API.Input<Subscription.get>} input
 * @param {API.SubscriptionServiceContext} context
 * @returns {Promise<API.SubscriptionGetResult>}
 */
const get = async ({ capability }, context) => {
  const provider = capability.with
  /**
   * Ensure that resource is one of the service DIDs, which implies it's either
   * invoked by service itself or an authorized delegate (like admin).
   * In other words no user will be able to invoke this unless service
   * explicitly delegated capability to them to do so.
   */
  if (!context.provisionsStorage.services.includes(provider)) {
    return { error: new UnknownProvider(capability.with) }
  }

  return await context.provisionsStorage.getSubscription(
    provider,
    capability.nb.subscription
  )
}

class UnknownProvider extends Server.Failure {
  /**
   * @param {API.DID} did
   */
  constructor(did) {
    super()
    this.did = did
    this.name = /** @type {const} */ ('UnknownProvider')
  }

  describe() {
    return `Provider ${this.did} not found`
  }
}

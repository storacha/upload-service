import * as API from '../types.js'
import * as Provider from '@ucanto/server'
import { Consumer } from '@storacha/capabilities'

/**
 * @param {API.ConsumerServiceContext} context
 */
export const provide = (context) =>
  Provider.provide(Consumer.get, (input) => get(input, context))

/**
 * @param {API.Input<Consumer.get>} input
 * @param {API.ConsumerServiceContext} context
 * @returns {Promise<API.Result<API.ConsumerGetSuccess, API.ConsumerGetFailure>>}
 */
const get = async ({ capability }, context) => {
  const provider = capability.with

  if (!context.provisionsStorage.services.includes(provider)) {
    return Provider.fail(`Unknown provider ${provider}`)
  }

  return context.provisionsStorage.getConsumer(provider, capability.nb.consumer)
}

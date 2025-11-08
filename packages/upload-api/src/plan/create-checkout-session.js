import * as API from '../types.js'
import * as Provider from '@ucanto/server'
import { Plan } from '@storacha/capabilities'

/**
 * @param {API.PlanServiceContext} context
 */
export const provide = (context) =>
  Provider.provide(Plan.createCheckoutSession, (input) =>
    createCheckoutSession(input, context)
  )

/**
 * @param {API.Input<Plan.createCheckoutSession>} input
 * @param {API.PlanServiceContext} context
 * @returns {Promise<API.Result<API.PlanCreateCheckoutSessionSuccess, API.PlanCreateCheckoutSessionFailure>>}
 */
const createCheckoutSession = async ({ capability }, context) =>
  context.plansStorage.createCheckoutSession(
    capability.with,
    capability.nb.planID,
    {
      successURL: capability.nb.successURL,
      cancelURL: capability.nb.cancelURL,
      freeTrial: capability.nb.freeTrial,
      redirectAfterCompletion: capability.nb.redirectAfterCompletion,
    }
  )

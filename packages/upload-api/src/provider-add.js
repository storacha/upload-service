import * as API from './types.js'
import * as Server from '@ucanto/server'
import { Provider } from '@storacha/capabilities'
import * as validator from '@ucanto/validator'
import { mailtoDidToDomain, mailtoDidToEmail } from './utils/did-mailto.js'
import { ensureRateLimitAbove } from './utils/rate-limits.js'

/**
 * @param {API.ProviderServiceContext} ctx
 */
export const provide = (ctx) =>
  Server.provide(Provider.add, (input) => add(input, ctx))

/**
 * @param {API.Input<Provider.add>} input
 * @param {API.ProviderServiceContext} context
 */
export const add = async (
  { capability, invocation },
  {
    provisionsStorage: provisions,
    rateLimitsStorage: rateLimits,
    plansStorage,
    requirePaymentPlan,
  }
) => {
  const {
    nb: { consumer, provider },
    with: accountDID,
  } = capability
  
  // Validate that the account DID is either did:mailto or did:plc
  if (!validator.DID.match({ method: 'mailto' }).is(accountDID) && !validator.DID.match({ method: 'plc' }).is(accountDID)) {
    return {
      error: {
        name: 'Unauthorized',
        message: 'Resource must be a valid account DID (did:mailto or did:plc)',
      },
    }
  }

  // Handle rate limiting based on account type
  if (accountDID.startsWith('did:mailto:')) {
    const accountMailtoDID =
      /** @type {import('@storacha/did-mailto/types').DidMailto} */ (accountDID)
    const rateLimitResult = await ensureRateLimitAbove(
      rateLimits,
      [mailtoDidToDomain(accountMailtoDID), mailtoDidToEmail(accountMailtoDID)],
      0
    )
    if (rateLimitResult.error) {
      return {
        error: {
          name: 'AccountBlocked',
          message: `Account identified by ${accountDID} is blocked`,
        },
      }
    }
  } else if (accountDID.startsWith('did:plc:')) {
    // For did:plc accounts, use the full DID for rate limiting
    const rateLimitResult = await ensureRateLimitAbove(
      rateLimits,
      [accountDID],
      0
    )
    if (rateLimitResult.error) {
      return {
        error: {
          name: 'AccountBlocked',
          message: `Account identified by ${accountDID} is blocked`,
        },
      }
    }
  }

  if (requirePaymentPlan) {
    const planGetResult = await plansStorage.get(accountDID)
    if (!planGetResult.ok?.product) {
      return {
        error: {
          name: 'AccountPlanMissing',
          message: `Account identified by ${accountDID} has not selected a payment plan`,
        },
      }
    }
  }

  if (!provisions.services.includes(provider)) {
    return {
      error: {
        name: 'InvalidProvider',
        message: `Invalid provider: ${provider}`,
      },
    }
  }
  if ((await provisions.hasStorageProvider(consumer)).ok) {
    return {
      error: {
        name: 'SpaceAlreadyProvisioned',
        message: `${consumer} already has a storage provider`,
      },
    }
  }

  return await provisions.put({
    // eslint-disable-next-line object-shorthand
    cause: /** @type {API.Invocation<API.ProviderAdd>} */ (invocation),
    consumer,
    provider,
    customer: accountDID,
  })
}

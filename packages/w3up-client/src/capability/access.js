import { Base } from '../base.js'
import * as Agent from '@storacha/access/agent'
import * as DIDMailto from '@storacha/did-mailto'
import * as Result from '../result.js'
import * as Access from '@storacha/capabilities/access'

import * as API from '../types.js'

export { DIDMailto }

/**
 * Client for interacting with the `access/*` capabilities.
 */
export class AccessClient extends Base {
  /* c8 ignore start - testing websocket code is hard */
  /**
   * Authorize the current agent to use capabilities granted to the passed
   * email account.
   *
   * @deprecated Use `request` instead.
   *
   * @param {`${string}@${string}`} email
   * @param {object} [options]
   * @param {AbortSignal} [options.signal]
   * @param {Iterable<{ can: API.Ability }>} [options.capabilities]
   */
  async authorize(email, options) {
    const account = DIDMailto.fromEmail(email)
    const authorization = Result.unwrap(await request(this, { account }))
    const access = Result.unwrap(await authorization.claim(options))
    await Result.unwrap(await access.save())

    return access.proofs
  }
  /* c8 ignore stop */

  /**
   * Claim delegations granted to the account associated with this agent.
   *
   * @param {object} [input]
   * @param {API.DID} [input.audience]
   */
  async claim(input) {
    const access = Result.unwrap(await claim(this, input))
    await Result.unwrap(await access.save())
    return access.proofs
  }

  /**
   * Fetch delegations for a did:plc account via public retrieval.
   * This is a public operation that doesn't require authentication.
   *
   * @param {API.DID<'plc'>} didPlc - The did:plc identifier to fetch delegations for
   */
  async fetch(didPlc) {
    return await fetch(this, { didPlc })
  }

  /**
   * Requests specified `access` level from the account from the given account.
   *
   * @param {object} input
   * @param {API.AccountDID} input.account
   * @param {API.Access} [input.access]
   * @param {AbortSignal} [input.signal]
   */
  async request(input) {
    return await request(this, input)
  }

  /**
   * Shares access with delegates.
   *
   * @param {object} input
   * @param {API.Delegation[]} input.delegations
   * @param {API.SpaceDID} [input.space]
   * @param {API.Delegation[]} [input.proofs]
   */
  async delegate(input) {
    return await delegate(this, input)
  }
}

/**
 * @param {{agent: API.Agent}} client
 * @param {object} [input]
 * @param {API.DID} [input.audience]
 */
export const claim = async ({ agent }, input) =>
  Agent.Access.claim(agent, input)

/**
 * Fetch delegations for a did:plc account via public access/fetch capability.
 * This is a public operation that doesn't require authentication.
 *
 * @param {{agent: API.Agent}} client
 * @param {object} input
 * @param {API.DID<'plc'>} input.didPlc
 */
export const fetch = async ({ agent }, { didPlc }) => {
  const result = await agent.invokeAndExecute(Access.fetch, {
    with: didPlc,
  })

  if (result.out.error) {
    return { error: new Error(`Failed to fetch delegations: ${result.out.error.message}`) }
  }

  return { ok: result.out.ok }
}

/**
 * Requests specified `access` level from specified `account`. It will invoke
 * `access/authorize` capability and keep polling `access/claim` capability
 * until access is granted or request is aborted.
 *
 * @param {{agent: API.Agent}} agent
 * @param {object} input
 * @param {API.AccountDID} input.account
 * @param {API.Access} [input.access]
 * @param {API.DID} [input.audience]
 * @param {Agent.AppName} [input.appName]
 */
export const request = async ({ agent }, input) =>
  Agent.Access.request(agent, input)

/**
 * Creates a new `PendingAccessRequest` object that can be used to poll for the
 * requested delegation through `access/claim` capability.
 *
 * @param {{agent: API.Agent}} agent
 * @param {object} input
 * @param {API.Link} input.request - Link to the `access/authorize` invocation.
 * @param {API.UTCUnixTimestamp} input.expiration - Seconds in UTC.
 * @param {API.DID} [input.audience] - Principal requesting an access.
 * @param {API.ProviderDID} [input.provider] - Provider handling request.
 */
/* c8 ignore next 2 */
export const createPendingAccessRequest = ({ agent }, input) =>
  Agent.Access.createPendingAccessRequest(agent, input)

/**
 *
 * @param {{agent: API.Agent}} agent
 * @param {object} input
 * @param {API.Delegation[]} input.delegations
 * @param {API.SpaceDID} [input.space]
 * @param {API.Delegation[]} [input.proofs]
 */
export const delegate = async ({ agent }, input) =>
  Agent.Access.delegate(agent, input)

export const { spaceAccess, accountAccess } = Agent.Access
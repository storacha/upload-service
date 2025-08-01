import * as Server from '@ucanto/server'
import * as API from '../types.js'
import * as Access from '@storacha/capabilities/access'
import * as DidMailto from '@storacha/did-mailto'
import { delegationToString } from '@storacha/access/encoding'
import { mailtoDidToDomain, mailtoDidToEmail } from '../utils/did-mailto.js'
import { ensureRateLimitAbove } from '../utils/rate-limits.js'

/**
 * @param {API.AccessServiceContext} ctx
 */
export const provide = (ctx) =>
  Server.provideAdvanced({
    capability: Access.authorize,
    handler: (input) => authorize(input, ctx),
  })

/**
 * @param {API.Input<Access.authorize>} input
 * @param {API.AccessServiceContext} ctx
 * @returns {Promise<API.Transaction<API.AccessAuthorizeSuccess, API.AccessAuthorizeFailure>>}
 */
export const authorize = async ({ capability, invocation }, ctx) => {
  if (!capability.nb.iss) {
    return Server.error(
      new Error('Issuer is required in invoked authorization request.')
    )
  }

  const accountMailtoDID =
    /** @type {import('@storacha/did-mailto/types').DidMailto} */ (
      capability.nb.iss
    )
  const rateLimitResult = await ensureRateLimitAbove(
    ctx.rateLimitsStorage,
    [mailtoDidToDomain(accountMailtoDID), mailtoDidToEmail(accountMailtoDID)],
    0
  )
  if (rateLimitResult.error) {
    return Server.error(
      new AccountBlocked(
        `Account identified by ${capability.nb.iss} is blocked`
      )
    )
  }

  // Check if this is an SSO request
  const facts = invocation.facts || []
  const { sso } = /** @type {{ sso?: API.SSOFact }} */ (
    facts.find((fact) => fact.sso) || {}
  )
  if (sso) {
    if (!ctx.ssoService) {
      return Server.error(new Error('SSO service is not configured'))
    }
    return ssoAuthorization(invocation, accountMailtoDID, sso, ctx.ssoService)
  }

  // Standard email flow - create confirmation delegation and send email
  // We allow granting access within the next 15 minutes
  const lifetimeInSeconds = 60 * 15

  /**
   * We issue `access/confirm` invocation which will
   * get embedded in the URL that we send to the user. When user clicks the
   * link we'll get this delegation back in the `/validate-email` endpoint
   * which will allow us to verify that it was the user who clicked the link
   * and not some attacker impersonating the user. We will know that because
   * the `with` field is our service DID and only private key holder is able
   * to issue such delegation.
   *
   * We limit lifetime of this UCAN to 15 minutes to reduce the attack
   * surface where an attacker could attempt concurrent authorization
   * request in attempt confuse a user into clicking the wrong link.
   */
  const confirmation = await Access.confirm
    .invoke({
      issuer: ctx.signer,
      // audience same as issuer because this is a service invocation
      // that will get handled by access/confirm handler
      // but only if the receiver of this email wants it to be
      audience: ctx.signer,
      // Because with is set to our DID no other actor will be able to issue
      // this delegation without our private key.
      with: ctx.signer.did(),
      lifetimeInSeconds,
      // We link to the authorization request so that this attestation can
      // not be used to authorize a different request.
      nb: {
        // we copy request details and set the `aud` field to the agent DID
        // that requested the authorization.
        iss: accountMailtoDID,
        att: capability.nb.att,
        aud: capability.with,
        // Link to the invocation that requested the authorization.
        cause: invocation.cid,
      },
      // we copy the facts in so that information can be passed
      // from the invoker of this capability to the invoker of the confirm
      // capability - we use this, for example, to let bsky.storage users
      // specify that they should be redirected back to bsky.storage after
      // completing the Stripe plan selection flow
      facts: invocation.facts,
    })
    .delegate()

  // Encode authorization request and our attestation as string so that it
  // can be passed as a query parameter in the URL.
  const encoded = delegationToString(confirmation)

  const url = `${ctx.url.protocol}//${ctx.url.host}/validate-email?ucan=${encoded}&mode=authorize`

  await ctx.email.sendValidation({
    to: DidMailto.toEmail(DidMailto.fromString(capability.nb.iss)),
    url,
  })

  const ok = Server.ok({
    // let client know when the confirmation will expire
    expiration: confirmation.expiration,
    // link to this authorization request
    request: invocation.cid,
  })

  // link to the authorization confirmation so it could be used to lookup
  // the delegation by the authorization request.
  return ok.join(confirmation.cid)
}

/**
 *
 * @param {API.Input<Access.authorize>['invocation']} invocation
 * @param {import('@storacha/did-mailto/types').DidMailto} accountMailtoDID
 * @param {API.SSOFact} ssoFact
 * @param {API.SSOService} ssoService
 * @returns {Promise<API.Transaction<API.AccessAuthorizeSuccess, API.AccessAuthorizeFailure>>}
 */
const ssoAuthorization = async (
  invocation,
  accountMailtoDID,
  ssoFact,
  ssoService
) => {
  const { authProvider, externalUserId, externalSessionToken } = ssoFact
  if (!authProvider) {
    return Server.error(new Error('Missing SSO authorization provider'))
  }

  if (!externalUserId) {
    return Server.error(new Error('Missing SSO external user identifier'))
  }

  if (!externalSessionToken) {
    return Server.error(new Error('Missing SSO external session token'))
  }

  const ssoParams = {
    email: DidMailto.toEmail(accountMailtoDID),
    authProvider,
    externalUserId,
    externalSessionToken,
    invocation,
  }

  const res = await ssoService.authorize(ssoParams)
  if (!res.ok) {
    console.error('SSO authorization failed:', res.error)
    return res
  }

  const authConfirmationLink = res.ok
  return Server.ok({
    expiration: Math.floor(Date.now() / 1000) + 60 * 15, // Give 15 minutes like OAuth flow
    // link to this authorization request
    request: invocation.cid,
  }).join(authConfirmationLink)
}

class AccountBlocked extends Server.Failure {
  get name() {
    return 'AccountBlocked'
  }
}

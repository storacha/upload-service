import PQueue from 'p-queue'
import * as API from '@ucanto/interface'
import * as dagJSON from '@ipld/dag-json'
import { capability } from '@ucanto/server'
import { Verifier } from '@ucanto/principal'
import pRetry, { AbortError } from 'p-retry'
import { extract } from '@ucanto/core/delegation'
import {
  ok,
  Schema,
  DID,
  fail,
  access,
  Revoked,
  Authorization,
} from '@ucanto/validator'

const RETRIES = 2
const CONCURRENCY = 5
const MIN_TIMEOUT = 100
const BACKOFF_FACTOR = 2
const REVOCATION_URL = 'https://up.storacha.network/revocations/'
const SERVICE_DID = DID.from('did:web:up.storacha.network')
const AUTHORITY = Verifier.parse(
  DID.from('did:key:z6MkqdncRZ1wj8zxCTDUQ8CRT8NQWd63T7mZRvZUX8B7XDFi')
).withDID(SERVICE_DID)

const Decrypt = capability({
  can: 'space/content/decrypt',
  with: DID.match({ method: 'key' }),
  nb: Schema.struct({
    resource: Schema.link(),
  }),
  derives: (child, parent) => {
    if (child.with !== parent.with) {
      return fail(
        `Can not derive ${child.can} with ${child.with} from ${parent.with}`
      )
    }
    if (child.nb.resource.toString() !== parent.nb.resource.toString()) {
      return fail(
        `Can not derive ${child.can} resource ${child.nb.resource} from ${parent.nb.resource}`
      )
    }
    return ok({})
  },
})

/**
 * @typedef {object} Delegation
 * @property {Array<any>} proofs - Array of proofs
 * @property {Array<{can: string}>} capabilities - Array of capabilities
 * @property {{did: () => string}} issuer - The issuer
 * @property {{did: () => string}} audience - The audience
 */

/**
 * Validates a decrypt delegation from an invocation if it exists
 *
 * @param {Delegation} wrappedInvocation - The delegation to validate
 * @param {string} spaceDID - The target space DID
 * @throws {Error} If the invocation or the delegation is invalid
 */
function validateDecryptDelegation(wrappedInvocation, spaceDID) {
  const decryptCapability = wrappedInvocation.capabilities.find(
    (cap) => cap.can === Decrypt.can
  )
  // Check if the invocation `with` is the same as the spaceDID
  if (decryptCapability?.with !== spaceDID) {
    throw new Error(
      `Invalid "with" in the invocation. Decryption is allowed only for files associated with spaceDID: ${spaceDID}!`
    )
  }

  // Check if the invocation has exactly one delegation
  if (wrappedInvocation.proofs.length !== 1) {
    throw new Error(`Expected exactly one delegation!`)
  }

  // Check if the delegation contains the decryption capability for the expected spaceDID
  const delegation = wrappedInvocation.proofs[0]
  if (
    !delegation.capabilities.some(
      /** @param {{can: string}} c */ (c) =>
        c.with === spaceDID && c.can === Decrypt.can
    )
  ) {
    throw new Error(
      `Delegation does not contain ${Decrypt.can} capability for spaceDID: ${spaceDID}!`
    )
  }

  // Check if the invoker is the same as the delegated audience
  const invocationIssuer = wrappedInvocation.issuer.did()
  const delegationAudience = delegation.audience.did()
  if (invocationIssuer !== delegationAudience) {
    throw new Error('The invoker must be equal to the delegated audience!')
  }
}

/**
 * Checks the revocation endpoint for every delegation in the authorization chain.
 *
 * @param {API.Authorization} authorization
 */
async function validateAuthorization(authorization) {
  console.log('Starting authorization revocation validation...')

  const cidSet = new Set()
  for (const cid of Authorization.iterate(authorization)) {
    cidSet.add(String(cid))
  }

  const cids = Array.from(cidSet)
  console.log(`Found ${cids.length} CIDs for revocation check`)

  if (cids.length === 0) return { ok: {} }

  const globalAbort = new AbortController()
  const queue = new PQueue({ concurrency: CONCURRENCY })

  let settledEarly = false // set when a revoked cid is found
  /** @type {Error[]} */
  const serviceErrors = [] // collect service errors as they happen

  // per-CID attempt function: classify responses
  const checkCID = (/** @type {string} */ cid) => async () => {
    const res = await fetch(`${REVOCATION_URL}/${cid}`, {
      signal: globalAbort.signal,
    })

    if (res.status === 200) {
      console.log(`[validateAuthorization] delegation ${cid} is revoked`)
      return { status: 'revoked', cid }
    }

    if (res.status === 404) {
      return { status: 'not-revoked', cid }
    }

    console.log(
      `[validateAuthorization] delegation ${cid} revocation status ${res.status}`
    )

    if (res.status === 429 || res.status >= 500) {
      // transient: let p-retry retry
      throw new Error(
        `Transient revocation service status ${res.status} for CID ${cid}`
      )
    }

    // other 4xx: non-retriable -> tell p-retry to abort retries for this CID
    throw new AbortError(`Unexpected status ${res.status} for CID ${cid}`)
  }

  const tasks = []
  for (const cid of cids) {
    const rawTask = queue.add(async () => {
      if (settledEarly) {
        // Another task already found a revocation; signal non-retriable cancellation
        throw new AbortError('Cancelled due to external revocation found')
      }

      const result = await pRetry(checkCID(cid), {
        retries: RETRIES,
        minTimeout: MIN_TIMEOUT,
        factor: BACKOFF_FACTOR,
        signal: globalAbort.signal,
        // onFailedAttempt: ({ error, attemptNumber, retriesLeft }) => {
        //   console.warn(
        //     `[validateAuthorization] CID ${cid} attempt ${attemptNumber} failed. ${retriesLeft} retries left. Error: ${
        //       error && error.message ? error.message : String(error)
        //     }`
        //   )
        // },
      })

      return result
    })

    // record-and-rethrow: capture errors as they happen, then rethrow so the promise remains rejected
    const handled = rawTask.catch((err) => {
      const recorded = err instanceof Error ? err : new Error(String(err))
      serviceErrors.push(recorded)
      // rethrow to keep the original rejection observable
      throw err
    })

    // Create the Promise.any mapping: fulfill only on revoked, reject otherwise.
    const task = handled.then((r) => {
      if (r && r.status === 'revoked') return r
      // not-revoked -> reject with the marker object so Promise.any keeps waiting for a revoked result
      return Promise.reject(r)
    })

    tasks.push(task)
  }

  try {
    // Wait for the first revoked (tasks fulfills), or fail when all reject.
    const first = await Promise.any(tasks)

    // Found revoked. Abort other in-flight work and clear queue.
    settledEarly = true
    globalAbort.abort()
    queue.clear()

    console.log(`[validateAuthorization] Revocation found for CID ${first.cid}`)
    return { error: new Revoked(authorization.delegation) }
  } catch (/** @type any*/ aggErr) {
    // Promise.any reject only when all tasks reject.
    const reasons = Array.isArray(aggErr && aggErr.errors)
      ? aggErr.errors
      : [aggErr]

    console.log(
      '[validateAuthorization] Total revocations found (explicit + errors): ',
      reasons.length
    )
    console.log(
      '[validateAuthorization] Total errors found: ',
      serviceErrors.length
    )

    // fail-closed policy: any service error -> deny access
    if (serviceErrors.length > 0) {
      const first = serviceErrors[0]
      console.error(
        '[validateAuthorization] Service errors while checking revocations:',
        first && first.message ? first.message : String(first)
      )

      return {
        error: first instanceof Error ? first : new Error(String(first)),
      }
    }

    // No service errors and no revoked CID -> OK (not revoked)
    return { ok: {} }
  } finally {
    // Ensure queue cleared to avoid leftover scheduled tasks/timers
    queue.clear()
  }
}

/**
 * Decrypts content using Lit Protocol
 *
 * @returns {Promise<void>}
 */
async function decrypt() {
  console.log('Starting decryption process...')
  try {
    const {
      identityBoundCiphertext,
      accessControlConditions,
      plaintextKeyHash,
      spaceDID,
      wrappedInvocationJSON,
    } = jsParams
    const wrappedInvocationCar = dagJSON.parse(wrappedInvocationJSON)
    const wrappedInvocationResult = await extract(wrappedInvocationCar)
    if (wrappedInvocationResult.error) {
      throw new Error(
        `Issue on extracting the wrapped invocation! Error message: ${wrappedInvocationResult.error}`
      )
    }
    console.log('Extracted wrapped invocation successfully')

    const wrappedInvocation = wrappedInvocationResult.ok
    validateDecryptDelegation(wrappedInvocation, spaceDID)
    const authorization = await access(wrappedInvocation, {
      principal: Verifier,
      capability: Decrypt,
      authority: AUTHORITY,
      validateAuthorization,
    })

    /** @type {Record<string, any>} */
    let response = {}

    if (authorization.ok) {
      response.validateAccess = JSON.stringify({ ok: {} })
      console.log('Delegation authorized successfully!')
      const decryptedString = await LitActions.decryptAndCombine({
        accessControlConditions,
        ciphertext: identityBoundCiphertext,
        dataToEncryptHash: plaintextKeyHash,
        authSig: null,
        chain: 'ethereum',
      })
      console.log('Decryption process completed successfully.')
      response.decryptedString = decryptedString
    } else {
      response.validateAccess = JSON.stringify(authorization)
    }
    return LitActions.setResponse({
      response: JSON.stringify(response),
      success: true,
    })
  } catch (/** @type any*/ error) {
    return LitActions.setResponse({
      response: JSON.stringify({ error: error.message }),
      success: false,
    })
  }
}

decrypt()

import { ok, Schema, DID, fail, access } from '@ucanto/validator'
import { extract } from '@ucanto/core/delegation'
import { Verifier } from '@ucanto/principal'
import { capability } from '@ucanto/server'
import * as dagJSON from '@ipld/dag-json'

const Authority = Verifier
  .parse(DID.from('did:key:z6MkqdncRZ1wj8zxCTDUQ8CRT8NQWd63T7mZRvZUX8B7XDFi'))
  .withDID(DID.from('did:web:web3.storage'))

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
 * @typedef {Object} Delegation
 * @property {Array<any>} proofs - Array of proofs
 * @property {Array<{can: string}>} capabilities - Array of capabilities
 * @property {{did: () => string}} issuer - The issuer
 * @property {{did: () => string}} audience - The audience
 */

/**
 * Validates a decrypt delegation from an invocation if it exists
 * @param {Delegation} decryptDelegation - The delegation to validate
 * @param {string} spaceDID - The target space DID
 * @throws {Error} If the invocation or the delegation is invalid
 */
const validateDecryptDelegation = (wrappedInvocation, spaceDID) => {
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

  // Check if the delegation contains the decryption capability
  const delegation = wrappedInvocation.proofs[0]
  if (
    !delegation.capabilities.some(
      /** @param {{can: string}} c */ (c) => c.can === Decrypt.can
    )
  ) {
    throw new Error(`Delegation does not contain ${Decrypt.can} capability!`)
  }

  // Check if the decryption capability contains the `with` field that is the same as the spaceDID
  if (
    !delegation.capabilities.some(
      /** @param {{can: string}} c */ (c) => c.with === spaceDID && c.can === Decrypt.can
    )
  ) {
    throw new Error(`Invalid "with" in the delegation. Decryption is allowed only for files associated with spaceDID: ${spaceDID}!`)
  }

  // Check if the invoker is the same as the delegated audience
  const invocationIssuer = wrappedInvocation.issuer.did()
  const delegationAudience = delegation.audience.did()
  if (invocationIssuer !== delegationAudience) {
    throw new Error('The invoker must be equal to the delegated audience!')
  }
}

/**
 * Decrypts content using Lit Protocol
 * @returns {Promise<void>}
 */
const decrypt = async () => {
  try {
    const wrappedInvocationCar = dagJSON.parse(wrappedInvocationJSON)
    const wrappedInvocationResult = await extract(wrappedInvocationCar)
    if (wrappedInvocationResult.error) {
      throw new Error(
        `Issue on extracting the wrapped invocation! Error message: ${wrappedInvocationResult.error}`
      )
    }

    const wrappedInvocation = wrappedInvocationResult.ok
    validateDecryptDelegation(wrappedInvocation, spaceDID)
    const authorization = await access(wrappedInvocation, {
      principal: Verifier,
      capability: Decrypt,
      authority: Authority,
      validateAuthorization: () => ok({}), // TODO: check if it's not revoked
    })

    /** @type {Record<string, any>} */
    let response = {}

    if (authorization.ok) {
      response.validateAccess = 'ok'
      console.log('Delegation authorized successfully!')
      const decryptedString = await Lit.Actions.decryptAndCombine({
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
    return Lit.Actions.setResponse({ response: JSON.stringify(response) })
  } catch (/** @type any*/ error) {
    return Lit.Actions.setResponse({
      response: JSON.stringify({ error: error.message }),
    })
  }
}

decrypt()

import { DIDResolutionError, Schema } from '@ucanto/validator'
import { parse } from '@ipld/dag-ucan/did'

/**
 * @import { PrincipalResolver } from './types.js'
 * @import { DID, Failure } from '@ucanto/interface'
 */

const didKeyPrefix = 'did:key:'
const didWebPrefix = 'did:web:'
const wellKnownDIDPath = '/.well-known/did.json'
const defaultTimeout = 5_000

/**
 * Creates a new resolver that resolves a did:web: DID by fetching its DID
 * document over HTTP.
 *
 * @param {Array<DID<'web'>|RegExp>} allowlist List of allowed resolutions.
 * @param {{ timeout?: number, fetch?: typeof globalThis.fetch }} [options]
 * @returns {PrincipalResolver}
 */
export const create = (allowlist, options) => {
  const fetch = options?.fetch ?? globalThis.fetch.bind(globalThis)
  const timeout = options?.timeout ?? defaultTimeout
  return {
    async resolveDIDKey(did) {
      if (!Schema.did({ method: 'web' }).is(did)) {
        return error(did, new Error('not resolvable by did:web resolver'))
      }
      let allowed = false
      for (const entry of allowlist) {
        if (did === entry || (entry instanceof RegExp && entry.test(did))) {
          allowed = true
          break
        }
      }
      if (!allowed) {
        return error(did, new Error('resolution not allowed'))
      }

      const base = `https://${did.replace(didWebPrefix, '')}`
      let url
      try {
        url = new URL(wellKnownDIDPath, base)
      } catch (err) {
        return error(did, new Error(`parsing URL: ${base}`, { cause: err }))
      }

      /** @type {unknown} */
      let didDoc
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(timeout) })
        if (!res.ok) {
          return error(
            did,
            new Error(
              `fetching DID document from: ${url}, status: ${res.status}`
            )
          )
        }
        didDoc = await res.json()
      } catch (err) {
        return error(
          did,
          new Error(`fetching DID document from: ${url}`, { cause: err })
        )
      }

      if (didDoc == null || typeof didDoc !== 'object') {
        return error(did, new Error('parsing DID document: not an object'))
      }
      if (
        !('verificationMethod' in didDoc) ||
        !Array.isArray(didDoc.verificationMethod)
      ) {
        return error(
          did,
          new Error(
            'parsing DID document: verificationMethod missing or not an array'
          )
        )
      }

      /** @type {Set<DID<'key'>>} */
      const keys = new Set()
      for (const vm of didDoc.verificationMethod) {
        if (
          vm == null ||
          typeof vm !== 'object' ||
          !('publicKeyMultibase' in vm)
        ) {
          continue
        }
        try {
          keys.add(
            /** @type {DID<'key'>} */
            (parse(didKeyPrefix + vm.publicKeyMultibase).did())
          )
        } catch {
          continue
        }
      }

      if (!keys.size) {
        return error(
          did,
          new Error('no valid verification methods found in DID document')
        )
      }

      return { ok: [...keys] }
    },
  }
}

/**
 * @param {DID} did
 * @param {Failure} cause
 */
const error = (did, cause) => ({ error: new DIDResolutionError(did, cause) })

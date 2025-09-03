import * as Ucanto from '@ucanto/interface'

export interface Revocation {
  /** The revoked delegation. */
  revoke: Ucanto.UCANLink
  /**
   * The DID of the authority that issued the revocation - either the issuer or
   * audience of the revoked delegation or one of it's proofs.
   */
  scope: Ucanto.DID
  /** The `ucan/revoke` invocation that authorized the revocation. */
  cause: Ucanto.UCANLink
}

export interface RevocationsStorage {
  /**
   * Given a map of delegations (keyed by delegation CID), return a
   * corresponding map of principals (keyed by DID) that revoked them.
   */
  query(
    query: RevocationQuery
  ): Promise<Ucanto.Result<MatchingRevocations, Ucanto.Failure>>

  /**
   * Add the given revocations to the revocation store. If there is a revocation
   * for given `revoke` with a different `scope` revocation with the given scope
   * will be added. If there is a revocation for given `revoke` and `scope` no
   * revocation will be added or updated.
   */
  add: (
    revocation: Revocation
  ) => Promise<Ucanto.Result<Ucanto.Unit, Ucanto.Failure>>

  /**
   * Creates or updates revocation for given `revoke` by setting `scope` to
   * the one passed in the argument. This is intended to compact revocation
   * store by dropping all existing revocations for given `revoke` in favor of
   * given one. It is supposed to be called when the revocation authority is the
   * same as the UCAN issuer, as such a revocation will apply to all possible
   * invocations.
   */
  reset: (
    revocation: Revocation
  ) => Promise<Ucanto.Result<Ucanto.Unit, Ucanto.Failure>>
}

/**
 * A map of revocations for which we want to find corresponding
 * revocations in the store.
 */
export type RevocationQuery = Record<
  Ucanto.ToString<Ucanto.UCANLink>,
  Ucanto.Unit
>

/**
 * Map of ucans to map of principals that issued revocations for them.
 */
export type MatchingRevocations = Record<
  Ucanto.ToString<Ucanto.UCANLink>,
  Record<Ucanto.DID, Ucanto.Unit>
>

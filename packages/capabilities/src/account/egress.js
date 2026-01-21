import { capability, fail, ok, Schema } from '@ucanto/validator'
import {
  AccountDID,
  SpaceDID,
  equalWith,
  and,
  equal,
  containedWithin,
} from '../utils.js'

/**
 * Capability can only be delegated (but not invoked) allowing audience to
 * be derived any `account/egress/` prefixed capability for the account identified
 * by DID in the `with` field.
 */
export const accountEgress = capability({
  can: 'account/egress/*',
  with: AccountDID,
  derives: equalWith,
})

/**
 * Capability can be invoked by an agent to retrieve egress data for all or a
 * specified set of spaces within an account in a given period.
 */
export const get = capability({
  can: 'account/egress/get',
  with: AccountDID,
  nb: Schema.struct({
    spaces: SpaceDID.array().optional(),
    /** Period to retrieve egress between. */
    period: Schema.struct({
      /** Date-only string in ISO 8601 format (inclusive). */
      from: Schema.string(),
      /** Date-only string in ISO 8601 format (exclusive). */
      to: Schema.string(),
    }).optional(),
  }),
  derives: (child, parent) => {
    return (
      and(equalWith(child, parent)) ||
      and(
        (() => {
          if (parent.nb.spaces === undefined) {
            return ok({})
          }
          if (child.nb.spaces === undefined) {
            return fail(
              `Constraint violation: violates imposed spaces constraint ${parent.nb.spaces} because it asks for all spaces`
            )
          }
          return containedWithin(child.nb.spaces, parent.nb.spaces, 'spaces')
        })()
      ) ||
      and(
        equal(child.nb.period?.from, parent.nb.period?.from, 'period.from')
      ) ||
      and(equal(child.nb.period?.to, parent.nb.period?.to, 'period.to')) ||
      ok({})
    )
  },
})

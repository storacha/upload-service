import * as Base from './base/revision.js'
import * as Value from './value.js'
import { ArchiveSchema, NoValueError } from './base/revision.js'
export { ArchiveSchema, NoValueError }

/** @import * as API from './api.js' */

/**
 * Create an initial revision.
 *
 * @type {(operation: API.Value) => Promise<API.RevisionView>}
 */
export const v0 = Base.v0

/**
 * Create a revision of a previous _value_.
 *
 * @type {(previous: API.ValueView, next: API.Value) => Promise<API.RevisionView>}
 */
export const increment = Base.increment

/**
 * @type {(event: API.EventBlockView) => API.RevisionView}
 */
export const from = Base.from

/**
 * Encode the revision as a CAR file.
 *
 * @type {(revision: API.RevisionView) => Promise<Uint8Array>}
 */
export const archive = Base.archive

/**
 * Extract a revision from a CAR file.
 *
 * @type {(bytes: Uint8Array) => Promise<API.RevisionView>}
 */
export const extract = Base.extract

/**
 * @type {(revision: API.RevisionView) => Promise<string>}
 */
export const format = Base.format

/** @type {(str: string) => Promise<API.RevisionView>} */
export const parse = Base.parse

/**
 * Publish a revision for the passed name to the network. Fails only if the
 * revision was not able to be published to at least 1 remote.
 *
 * @param {API.NameView} name
 * @param {API.RevisionView} revision
 * @param {object} [options]
 * @param {API.ClockConnection[]} [options.remotes]
 * @param {API.BlockFetcher} [options.fetcher]
 * @returns {Promise<API.ValueView>}
 */
export const publish = async (name, revision, options) => {
  const state = await Base.publish(name, revision, options)
  return Value.from(state.name, ...state.revision)
}

/**
 * Resolve the current value for the given name. Fails only if no remotes
 * respond successfully.
 *
 * If all remotes respond with an empty head, i.e. there is no event published
 * to the merkle clock to set the current value then an `NoValueError` is
 * thrown, with a `ERR_NO_VALUE` code.
 *
 * @param {API.NameView} name
 * @param {object} [options]
 * @param {API.ValueView} [options.base] A known base value to use as the resolution base.
 * @param {API.ClockConnection[]} [options.remotes]
 * @param {API.BlockFetcher} [options.fetcher]
 * @return {Promise<API.ValueView>}
 * @throws {NoValueError}
 */
export const resolve = async (name, options) => {
  const state = await Base.resolve(name, options)
  return Value.from(state.name, ...state.revision)
}

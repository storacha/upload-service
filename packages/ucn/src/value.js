/** @import * as API from './api.js' */

class Value {
  /**
   * @param {API.Name} name
   * @param {API.RawValue} value
   * @param {API.Revision[]} revision
   */
  constructor(name, value, revision) {
    this.name = name
    this.value = value
    this.revision = revision
  }
}

/**
 * @param {API.Name} name
 * @param {API.RawValue} value
 * @param  {API.Revision[]} revision
 * @returns {API.Value}
 */
export const create = (name, value, revision) =>
  new Value(name, value, revision)

/**
 * @param {API.Name} name
 * @param {...API.Revision} revision
 * @returns {API.Value}
 */
export const from = (name, ...revision) => {
  if (!revision.length) throw new Error('missing revisions')
  const value = revision.map((r) => r.value).sort()[0]
  const resolved = revision.find((r) => r.value === value)
  if (!resolved) throw new Error('finding revision')
  return create(name, resolved.value, revision)
}

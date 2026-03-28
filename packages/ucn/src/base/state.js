/** @import * as API from './api.js' */

/**
 * @template O
 * @implements {API.StateView<O>}
 */
class State {
  /**
   * @param {API.NameView} name
   * @param {API.RevisionView<O>[]} revision
   */
  constructor(name, revision) {
    this.name = name
    this.revision = revision
  }
}

/**
 * @template O
 * @param {API.NameView} name
 * @param  {API.RevisionView<O>[]} revision
 * @returns {API.StateView<O>}
 */
export const create = (name, revision) => new State(name, revision)

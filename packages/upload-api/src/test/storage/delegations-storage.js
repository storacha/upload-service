import * as Types from '../../types.js'

/**
 * @implements {Types.DelegationsStorage}
 */
export class DelegationsStorage {
  constructor() {
    /**
     * @type {Array<Types.Delegation<Types.Tuple<any>>>}
     */
    this.delegations = []
  }

  /**
   * @param  {Array<Types.Delegation<Types.Tuple<any>>>} delegations
   */
  async putMany(delegations) {
    this.delegations = [...delegations, ...this.delegations]
    return { ok: {} }
  }

  async count() {
    return BigInt(this.delegations.length)
  }

  /**
   * @param {Types.DelegationsStorageQuery} query
   */
  async find(query) {
    const delegations = []
    for (const delegation of this.delegations) {
      if (query.audience === delegation.audience.did()) {
        delegations.push(delegation)
      }
    }
    return {
      ok: delegations,
    }
  }
}

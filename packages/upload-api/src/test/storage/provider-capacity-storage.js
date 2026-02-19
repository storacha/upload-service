import * as Types from '../../types.js'

/**
 * In-memory implementation of ProviderCapacityStorage for testing
 *
 * @implements {Types.ProviderCapacityStorage}
 */
export class ProviderCapacityStorage {
  /**
   * @type {Map<Types.ProviderDID, Types.ProviderCapacity>}
   */
  #capacities = new Map()

  /**
   * @param {Record<Types.ProviderDID, number>} [initialCapacities] Initial max capacities per provider
   */
  constructor(initialCapacities = {}) {
    // Initialize capacities from provided map
    for (const [provider, maxCapacity] of Object.entries(initialCapacities)) {
      this.#capacities.set(/** @type {Types.ProviderDID} */ (provider), {
        provider: /** @type {Types.ProviderDID} */ (provider),
        usedCapacity: 0,
        claimedCapacity: 0,
        maxCapacity: maxCapacity || 0,
      })
    }
  }

  /**
   * @param {Types.ProviderDID} provider
   * @returns {Promise<import('@ucanto/interface').Result<Types.ProviderCapacity, import('@ucanto/interface').Failure>>}
   */
  async getCapacity(provider) {
    const capacity = this.#capacities.get(provider)
    if (!capacity) {
      // Return default capacity if not initialized
      // maxCapacity: 0 means unlimited (capacity tracking not configured for this provider)
      const defaultCapacity = {
        provider,
        usedCapacity: 0,
        claimedCapacity: 0,
        maxCapacity: 0, // 0 = unlimited capacity
      }
      this.#capacities.set(provider, defaultCapacity)
      return { ok: defaultCapacity }
    }
    return { ok: capacity }
  }

  /**
   * @param {Types.ProviderDID[]} providers
   * @returns {Promise<import('@ucanto/interface').Result<Map<Types.ProviderDID, Types.ProviderCapacity>, import('@ucanto/interface').Failure>>}
   */
  async getCapacities(providers) {
    const result = new Map()
    for (const provider of providers) {
      const capacityResult = await this.getCapacity(provider)
      if (capacityResult.error) {
        return capacityResult
      }
      result.set(provider, capacityResult.ok)
    }
    return { ok: result }
  }

  /**
   * @param {Types.ProviderDID} provider
   * @param {number} size
   * @returns {Promise<import('@ucanto/interface').Result<import('@ucanto/interface').Unit, import('@ucanto/interface').Failure>>}
   */
  async claimCapacity(provider, size) {
    const capacityResult = await this.getCapacity(provider)
    if (capacityResult.error) {
      return capacityResult
    }

    const capacity = capacityResult.ok
    // If maxCapacity is 0, treat as unlimited (capacity tracking not configured)
    if (capacity.maxCapacity === 0) {
      // Still track claimed capacity for consistency, but don't enforce limits
      capacity.claimedCapacity += size
      this.#capacities.set(provider, capacity)
      return { ok: {} }
    }

    const available =
      capacity.maxCapacity - capacity.usedCapacity - capacity.claimedCapacity

    if (size > available) {
      return {
        error: {
          name: 'InsufficientCapacity',
          message: `Provider ${provider} does not have enough capacity. Available: ${available}, Requested: ${size}`,
        },
      }
    }

    // Atomically update claimed capacity
    capacity.claimedCapacity += size
    this.#capacities.set(provider, capacity)

    return { ok: {} }
  }

  /**
   * @param {Types.ProviderDID} provider
   * @param {number} size
   * @returns {Promise<import('@ucanto/interface').Result<import('@ucanto/interface').Unit, import('@ucanto/interface').Failure>>}
   */
  async releaseClaimed(provider, size) {
    const capacityResult = await this.getCapacity(provider)
    if (capacityResult.error) {
      return capacityResult
    }

    const capacity = capacityResult.ok
    // Don't allow negative claimed capacity
    capacity.claimedCapacity = Math.max(0, capacity.claimedCapacity - size)
    this.#capacities.set(provider, capacity)

    return { ok: {} }
  }

  /**
   * @param {Types.ProviderDID} provider
   * @param {number} size
   * @returns {Promise<import('@ucanto/interface').Result<import('@ucanto/interface').Unit, import('@ucanto/interface').Failure>>}
   */
  async finalizeAllocation(provider, size) {
    const capacityResult = await this.getCapacity(provider)
    if (capacityResult.error) {
      return capacityResult
    }

    const capacity = capacityResult.ok
    // Move from claimed to used
    capacity.claimedCapacity = Math.max(0, capacity.claimedCapacity - size)
    capacity.usedCapacity += size
    this.#capacities.set(provider, capacity)

    return { ok: {} }
  }

  /**
   * @param {Types.ProviderDID} provider
   * @param {number} maxCapacity
   * @returns {Promise<import('@ucanto/interface').Result<import('@ucanto/interface').Unit, import('@ucanto/interface').Failure>>}
   */
  async setMaxCapacity(provider, maxCapacity) {
    const capacityResult = await this.getCapacity(provider)
    if (capacityResult.error) {
      return capacityResult
    }

    const capacity = capacityResult.ok
    capacity.maxCapacity = maxCapacity
    this.#capacities.set(provider, capacity)

    return { ok: {} }
  }

  /**
   * @param {Types.ProviderDID} provider
   * @param {number} size
   * @returns {Promise<import('@ucanto/interface').Result<boolean, import('@ucanto/interface').Failure>>}
   */
  async hasAvailableCapacity(provider, size) {
    const capacityResult = await this.getCapacity(provider)
    if (capacityResult.error) {
      return capacityResult
    }

    const capacity = capacityResult.ok
    // If maxCapacity is 0, treat as unlimited (capacity tracking not configured)
    if (capacity.maxCapacity === 0) {
      return { ok: true }
    }

    const available =
      capacity.maxCapacity - capacity.usedCapacity - capacity.claimedCapacity

    return { ok: size <= available }
  }
}

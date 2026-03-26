import * as API from '../types.js'

/**
 * Tracks in-flight allocations with timestamps for cleanup
 */
export class AllocationTracker {
  /**
   * @type {Map<string, { provider: API.ProviderDID, size: number, timestamp: number }>}
   */
  #allocations = new Map()

  /**
   * @param {number} [timeoutMs] Timeout in milliseconds for abandoned allocations (default: 5 minutes)
   */
  constructor(timeoutMs = 5 * 60 * 1000) {
    this.timeoutMs = timeoutMs
  }

  /**
   * Track an allocation
   *
   * @param {string} allocationId - Unique identifier for the allocation (e.g., task CID)
   * @param {API.ProviderDID} provider - Provider DID
   * @param {number} size - Size in bytes
   */
  track(allocationId, provider, size) {
    this.#allocations.set(allocationId, {
      provider,
      size,
      timestamp: Date.now(),
    })
  }

  /**
   * Remove an allocation from tracking
   *
   * @param {string} allocationId - Unique identifier for the allocation
   * @returns {{ provider: API.ProviderDID, size: number } | undefined}
   */
  untrack(allocationId) {
    const allocation = this.#allocations.get(allocationId)
    if (allocation) {
      this.#allocations.delete(allocationId)
      return {
        provider: allocation.provider,
        size: allocation.size,
      }
    }
    return undefined
  }

  /**
   * Get abandoned allocations (older than timeout)
   *
   * @returns {Array<{ id: string, provider: API.ProviderDID, size: number, age: number }>}
   */
  getAbandoned() {
    const now = Date.now()
    const abandoned = []
    for (const [id, allocation] of this.#allocations.entries()) {
      const age = now - allocation.timestamp
      if (age > this.timeoutMs) {
        abandoned.push({
          id,
          provider: allocation.provider,
          size: allocation.size,
          age,
        })
      }
    }
    return abandoned
  }

  /**
   * Clean up abandoned allocations
   *
   * @param {API.ProviderCapacityStorage} capacityStorage - Capacity storage to release capacity
   * @returns {Promise<number>} Number of allocations cleaned up
   */
  async cleanup(capacityStorage) {
    const abandoned = this.getAbandoned()
    let cleaned = 0

    for (const allocation of abandoned) {
      const releaseResult = await capacityStorage.releaseClaimed(
        allocation.provider,
        allocation.size
      )
      if (!releaseResult.error) {
        this.#allocations.delete(allocation.id)
        cleaned++
      }
    }

    return cleaned
  }

  /**
   * Get all tracked allocations
   *
   * @returns {Array<{ id: string, provider: API.ProviderDID, size: number, timestamp: number }>}
   */
  getAll() {
    return Array.from(this.#allocations.entries()).map(([id, allocation]) => ({
      id,
      ...allocation,
    }))
  }

  /**
   * Clear all allocations
   */
  clear() {
    this.#allocations.clear()
  }
}

import type { ProviderDID } from '@storacha/capabilities/types'
import type { Unit } from '@ucanto/interface'
import * as Ucanto from '@ucanto/interface'

/**
 * Provider capacity information
 */
export interface ProviderCapacity {
  /** Provider DID */
  provider: ProviderDID
  /** Currently used capacity (confirmed uploads) in bytes */
  usedCapacity: number
  /** Claimed capacity (in-flight uploads) in bytes */
  claimedCapacity: number
  /** Maximum allowed capacity in bytes */
  maxCapacity: number
}

/**
 * Storage interface for tracking provider capacity
 */
export interface ProviderCapacityStorage {
  /**
   * Get capacity information for a provider
   */
  getCapacity(
    provider: ProviderDID
  ): Promise<Ucanto.Result<ProviderCapacity, Ucanto.Failure>>

  /**
   * Get capacity for multiple providers
   */
  getCapacities(
    providers: ProviderDID[]
  ): Promise<Ucanto.Result<Map<ProviderDID, ProviderCapacity>, Ucanto.Failure>>

  /**
   * Claim capacity for an in-flight allocation
   * This should be atomic - either succeeds or fails
   */
  claimCapacity(
    provider: ProviderDID,
    size: number
  ): Promise<Ucanto.Result<Unit, Ucanto.Failure>>

  /**
   * Release claimed capacity (e.g., on allocation failure or timeout)
   */
  releaseClaimed(
    provider: ProviderDID,
    size: number
  ): Promise<Ucanto.Result<Unit, Ucanto.Failure>>

  /**
   * Finalize an allocation - move capacity from claimed to used
   */
  finalizeAllocation(
    provider: ProviderDID,
    size: number
  ): Promise<Ucanto.Result<Unit, Ucanto.Failure>>

  /**
   * Initialize or update provider capacity settings
   */
  setMaxCapacity(
    provider: ProviderDID,
    maxCapacity: number
  ): Promise<Ucanto.Result<Unit, Ucanto.Failure>>

  /**
   * Check if provider has available capacity for the given size
   */
  hasAvailableCapacity(
    provider: ProviderDID,
    size: number
  ): Promise<Ucanto.Result<boolean, Ucanto.Failure>>
}


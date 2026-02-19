import assert from 'node:assert'
import { ProviderCapacityStorage } from '../src/test/storage/provider-capacity-storage.js'
import { createCapacityAwareRouter } from '../src/router/capacity-aware-router.js'
import * as RoutingService from '@storacha/router/test/router'
import * as Signer from '@ucanto/principal/ed25519'
import { sha256 } from 'multiformats/hashes/sha2'

describe('Capacity Tracking - Simple Tests', () => {
  it('provider capacity storage - basic operations', async () => {
    const storage = new ProviderCapacityStorage({
      'did:web:provider1': 10000,
    })

    // Check initial capacity
    const initial = await storage.getCapacity('did:web:provider1')
    assert.ok(!initial.error)
    assert.equal(initial.ok.usedCapacity, 0)
    assert.equal(initial.ok.claimedCapacity, 0)
    assert.equal(initial.ok.maxCapacity, 10000)

    // Claim capacity
    const claimResult = await storage.claimCapacity('did:web:provider1', 1000)
    assert.ok(!claimResult.error, 'should claim capacity')

    // Check capacity after claim
    const afterClaim = await storage.getCapacity('did:web:provider1')
    assert.ok(!afterClaim.error)
    assert.equal(afterClaim.ok.usedCapacity, 0)
    assert.equal(afterClaim.ok.claimedCapacity, 1000)

    // Finalize allocation
    const finalizeResult = await storage.finalizeAllocation(
      'did:web:provider1',
      1000
    )
    assert.ok(!finalizeResult.error, 'should finalize allocation')

    // Check capacity after finalize
    const afterFinalize = await storage.getCapacity('did:web:provider1')
    assert.ok(!afterFinalize.error)
    assert.equal(afterFinalize.ok.usedCapacity, 1000)
    assert.equal(afterFinalize.ok.claimedCapacity, 0)
  })

  it('provider capacity storage - cannot claim more than available', async () => {
    const storage = new ProviderCapacityStorage({
      'did:web:provider1': 1000,
    })

    // Fill provider to capacity
    await storage.claimCapacity('did:web:provider1', 1000)

    // Try to claim more - should fail
    const result = await storage.claimCapacity('did:web:provider1', 500)
    assert.ok(result.error, 'should fail to claim capacity when none available')
    assert.equal(result.error.name, 'InsufficientCapacity')

    // Cleanup
    await storage.releaseClaimed('did:web:provider1', 1000)
  })

  it('provider capacity storage - release claimed capacity', async () => {
    const storage = new ProviderCapacityStorage({
      'did:web:provider1': 10000,
    })

    // Claim capacity
    await storage.claimCapacity('did:web:provider1', 1000)

    // Check capacity after claim
    const afterClaim = await storage.getCapacity('did:web:provider1')
    assert.ok(!afterClaim.error)
    assert.ok(afterClaim.ok)
    assert.equal(afterClaim.ok.claimedCapacity, 1000)

    // Release claimed capacity
    const releaseResult = await storage.releaseClaimed('did:web:provider1', 1000)
    assert.ok(!releaseResult.error, 'should release claimed capacity')

    // Check capacity after release
    const afterRelease = await storage.getCapacity('did:web:provider1')
    assert.ok(!afterRelease.error)
    assert.ok(afterRelease.ok)
    assert.equal(afterRelease.ok.claimedCapacity, 0)
    assert.equal(afterRelease.ok.usedCapacity, 0)
  })

  it('capacity-aware router - excludes providers without capacity', async () => {
    const serviceID = await Signer.generate()
    const provider1 = await Signer.generate()
    const provider2 = await Signer.generate()

    // Create mock storage providers with proper connection type
    /** @type {import('@storacha/router/test/router').StorageProvider[]} */
    const storageProviders = [
      {
        id: provider1,
        connection: /** @type {any} */ ({
          // Mock connection - router test implementation will handle this
        }),
      },
      {
        id: provider2,
        connection: /** @type {any} */ ({
          // Mock connection - router test implementation will handle this
        }),
      },
    ]

    // Create base router
    const baseRouter = RoutingService.create(serviceID, storageProviders)

    // Create capacity storage - cast provider DIDs to ProviderDID type
    const provider1DID = /** @type {import('../src/types.js').ProviderDID} */ (
      provider1.did()
    )
    const provider2DID = /** @type {import('../src/types.js').ProviderDID} */ (
      provider2.did()
    )

    const capacityStorage = new ProviderCapacityStorage({
      [provider1DID]: 1000,
      [provider2DID]: 2000,
    })

    // Fill provider1 to capacity
    await capacityStorage.claimCapacity(provider1DID, 1000)

    // Create capacity-aware router
    const capacityAwareRouter = createCapacityAwareRouter(
      baseRouter,
      capacityStorage
    )

    // Try to select a provider for a 500 byte blob
    // Provider1 should be excluded (1000 claimed, 0 available)
    // Provider2 should be selected (2000 available)
    // Create a proper MultihashDigest
    const data = new Uint8Array([1, 2, 3, 4])
    const multihash = await sha256.digest(data)
    const digest = multihash

    const result = await capacityAwareRouter.selectStorageProvider(
      digest,
      500,
      {}
    )

    assert.ok(!result.error, 'should select a provider')
    assert.equal(
      result.ok.did(),
      provider2.did(),
      'should select provider2 which has available capacity'
    )

    // Cleanup
    await capacityStorage.releaseClaimed(provider1DID, 1000)
  })
})


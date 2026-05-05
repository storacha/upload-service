import { describe, it, expect } from 'vitest'
import { ResumeBindingDriftError } from '../src/errors.js'
import {
  clearFailedUploadsForRetry,
  transitionToApproved,
} from '../src/state.js'

/**
 * @import * as API from '../src/api.js'
 */

const SPACE_DID = /** @type {API.SpaceDID} */ (
  'did:key:z6MkStateRetrySpaceTest1'
)

describe('clearFailedUploadsForRetry', () => {
  it('clears failed upload roots across both copies and returns the unique count', () => {
    const state = createState({
      phase: 'failed',
      copy0FailedUploads: ['bafy-root-a', 'bafy-root-b'],
      copy1FailedUploads: ['bafy-root-b', 'bafy-root-c'],
    })

    const clearedCount = clearFailedUploadsForRetry(state, SPACE_DID)

    expect(clearedCount).toBe(3)
    expect(state.spaces[SPACE_DID].copies[0].failedUploads.size).toBe(0)
    expect(state.spaces[SPACE_DID].copies[1].failedUploads.size).toBe(0)
    expect(state.spaces[SPACE_DID].phase).toBe('pending')
  })

  it('preserves migrating phase when the space already has progress', () => {
    const state = createState({
      phase: 'incomplete',
      copy0FailedUploads: ['bafy-root-a'],
      copy0Committed: ['bafy-shard-1'],
    })

    const clearedCount = clearFailedUploadsForRetry(state, SPACE_DID)

    expect(clearedCount).toBe(1)
    expect(state.spaces[SPACE_DID].phase).toBe('migrating')
  })
})

describe('transitionToApproved', () => {
  it('preserves progress when planned bindings still match persisted copies', () => {
    const state = createState({
      phase: 'migrating',
      copy0FailedUploads: ['bafy-root-a'],
      copy0Committed: ['bafy-shard-1'],
      copy0DataSetId: 101n,
    })

    transitionToApproved(state, [
      createPerSpaceCost({
        spaceDID: SPACE_DID,
        copies: [
          createPlannedCopyCost({
            copyIndex: 0,
            providerId: 1n,
            serviceProvider: '0x0000000000000000000000000000000000000001',
            dataSetId: 101n,
          }),
          createPlannedCopyCost({
            copyIndex: 1,
            providerId: 2n,
            serviceProvider: '0x0000000000000000000000000000000000000002',
            dataSetId: null,
          }),
        ],
      }),
    ])

    expect(state.phase).toBe('approved')
    expect(
      state.spaces[SPACE_DID].copies[0].committed.has('bafy-shard-1')
    ).toBe(true)
    expect(
      state.spaces[SPACE_DID].copies[0].failedUploads.has('bafy-root-a')
    ).toBe(true)
    expect(state.spaces[SPACE_DID].copies[0].dataSetId).toBe(101n)
  })

  it('fails fast when the planned provider binding drifts from persisted state', () => {
    const state = createState()

    expect(() =>
      transitionToApproved(state, [
        createPerSpaceCost({
          spaceDID: SPACE_DID,
          copies: [
            createPlannedCopyCost({
              copyIndex: 0,
              providerId: 9n,
              serviceProvider: '0x0000000000000000000000000000000000000009',
              dataSetId: null,
            }),
            createPlannedCopyCost({
              copyIndex: 1,
              providerId: 2n,
              serviceProvider: '0x0000000000000000000000000000000000000002',
              dataSetId: null,
            }),
          ],
        }),
      ])
    ).toThrow(ResumeBindingDriftError)

    expect(state.phase).toBe('migrating')
    expect(state.spaces[SPACE_DID].copies[0].providerId).toBe(1n)
    expect(state.spaces[SPACE_DID].copies[0].serviceProvider).toBe(
      '0x0000000000000000000000000000000000000001'
    )
  })

  it('fails fast when the planned dataSetId drifts from persisted state', () => {
    const state = createState({ copy0DataSetId: null })

    expect(() =>
      transitionToApproved(state, [
        createPerSpaceCost({
          spaceDID: SPACE_DID,
          copies: [
            createPlannedCopyCost({
              copyIndex: 0,
              providerId: 1n,
              serviceProvider: '0x0000000000000000000000000000000000000001',
              dataSetId: 13235n,
            }),
            createPlannedCopyCost({
              copyIndex: 1,
              providerId: 2n,
              serviceProvider: '0x0000000000000000000000000000000000000002',
              dataSetId: null,
            }),
          ],
        }),
      ])
    ).toThrow(ResumeBindingDriftError)

    expect(state.phase).toBe('migrating')
    expect(state.spaces[SPACE_DID].copies[0].dataSetId).toBeNull()
  })
})

/**
 * @param {object} [input]
 * @param {API.SpacePhase} [input.phase]
 * @param {string[]} [input.copy0FailedUploads]
 * @param {string[]} [input.copy1FailedUploads]
 * @param {string[]} [input.copy0Committed]
 * @param {bigint | null} [input.copy0DataSetId]
 */
function createState(input = {}) {
  return /** @type {API.MigrationState} */ ({
    phase: 'migrating',
    spaces: {
      [SPACE_DID]: {
        did: SPACE_DID,
        phase: input.phase ?? 'pending',
        copies: [
          createCopyState({
            copyIndex: 0,
            failedUploads: input.copy0FailedUploads,
            committed: input.copy0Committed,
            dataSetId: input.copy0DataSetId,
          }),
          createCopyState({
            copyIndex: 1,
            failedUploads: input.copy1FailedUploads,
          }),
        ],
      },
    },
    spacesInventories: {},
    readerProgressCursors: undefined,
  })
}

/**
 * @param {object} input
 * @param {number} input.copyIndex
 * @param {string[]} [input.failedUploads]
 * @param {string[]} [input.committed]
 * @param {bigint | null} [input.dataSetId]
 * @returns {API.SpaceCopyState}
 */
function createCopyState({ copyIndex, failedUploads, committed, dataSetId }) {
  return {
    copyIndex,
    providerId: BigInt(copyIndex + 1),
    serviceProvider: /** @type {`0x${string}`} */ (
      `0x${String(copyIndex + 1).padStart(40, '0')}`
    ),
    dataSetId: dataSetId ?? null,
    pulled: new Set(),
    committed: new Set(committed ?? []),
    failedUploads: new Set(failedUploads ?? []),
    storedShards: {},
  }
}

/**
 * @param {object} input
 * @param {API.SpaceDID} input.spaceDID
 * @param {[API.PerCopyCost, API.PerCopyCost]} input.copies
 * @returns {API.PerSpaceCost}
 */
function createPerSpaceCost({ spaceDID, copies }) {
  return /** @type {API.PerSpaceCost} */ ({
    spaceDID,
    copies,
    isResumed: false,
    bytesToMigrate: 0n,
    currentDataSetSize: 0n,
    lockupUSDFC: 0n,
    sybilFee: 0n,
    cdnFixedLockup: 0n,
    rateLockupDelta: 0n,
    ratePerEpoch: 0n,
    ratePerMonth: 0n,
  })
}

/**
 * @param {object} input
 * @param {number} input.copyIndex
 * @param {bigint} input.providerId
 * @param {`0x${string}`} input.serviceProvider
 * @param {bigint | null} input.dataSetId
 * @returns {API.PerCopyCost}
 */
function createPlannedCopyCost({
  copyIndex,
  providerId,
  serviceProvider,
  dataSetId,
}) {
  return /** @type {API.PerCopyCost} */ ({
    copyIndex,
    spaceDID: SPACE_DID,
    context: /** @type {API.StorageContext} */ (/** @type {unknown} */ ({})),
    providerId,
    serviceProvider,
    dataSetId,
    withCDN: true,
    isResumed: dataSetId != null,
    bytesToMigrate: 0n,
    currentDataSetSize: 0n,
    lockupUSDFC: 0n,
    sybilFee: 0n,
    cdnFixedLockup: 0n,
    rateLockupDelta: 0n,
    ratePerEpoch: 0n,
    ratePerMonth: 0n,
  })
}

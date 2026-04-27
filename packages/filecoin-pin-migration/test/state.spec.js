import { describe, it, expect } from 'vitest'
import { clearFailedUploadsForRetry } from '../src/state.js'

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

/**
 * @param {object} [input]
 * @param {API.SpacePhase} [input.phase]
 * @param {string[]} [input.copy0FailedUploads]
 * @param {string[]} [input.copy1FailedUploads]
 * @param {string[]} [input.copy0Committed]
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
 * @returns {API.SpaceCopyState}
 */
function createCopyState({ copyIndex, failedUploads, committed }) {
  return {
    copyIndex,
    providerId: BigInt(copyIndex + 1),
    serviceProvider: /** @type {`0x${string}`} */ (
      `0x${String(copyIndex + 1).padStart(40, '0')}`
    ),
    dataSetId: null,
    pulled: new Set(),
    committed: new Set(committed ?? []),
    failedUploads: new Set(failedUploads ?? []),
    storedShards: {},
  }
}

import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_PULL_RETRIES,
  DEFAULT_RETRY_MIN_TIMEOUT,
} from '../src/constants.js'
import { PullFailedFailure } from '../src/errors.js'
import { presignAndPullBatch } from '../src/migrator/pull.js'
import { createPieceCID } from './helpers.js'

/**
 * @import * as API from '../src/api.js'
 */

/**
 * @typedef {API.StorageContext & {
 *   presignForCommit: ReturnType<typeof vi.fn>
 *   pull: ReturnType<typeof vi.fn>
 * }} MockPullContext
 */

function createAbortError() {
  const error = new Error('This operation was aborted')
  error.name = 'AbortError'
  return error
}

/**
 * @param {ReturnType<typeof vi.fn>} pull
 * @returns {MockPullContext}
 */
function createPullContext(pull) {
  const context = {
    presignForCommit: vi.fn(async () => new Uint8Array([1, 2, 3])),
    pull,
  }

  const typedContext = /** @type {MockPullContext} */ (
    /** @type {unknown} */ (context)
  )

  return typedContext
}

/**
 * @param {string} root
 * @param {string} pieceCID
 * @param {string} sourceURL
 */
function createPullEntry(root, pieceCID, sourceURL) {
  return {
    root,
    pieceCID,
    sourceURL,
  }
}

describe('presignAndPullBatch', () => {
  it('presigns once and retries pull until a later attempt succeeds', async () => {
    const pieceCID = createPieceCID().toString()
    const batch = [
      createPullEntry(
        'bafy-root-pull-retry',
        pieceCID,
        'https://source.example/pull-retry'
      ),
    ]

    let pullCalls = 0
    const context = createPullContext(
      vi.fn(async ({ pieces }) => {
        pullCalls += 1
        if (pullCalls < 3) {
          throw new Error('fetch failed')
        }

        return {
          pieces: pieces.map(
            /**
             * @param {API.PieceCID} pieceCid
             */
            (pieceCid) => ({
              pieceCid,
              status: 'complete',
            })
          ),
        }
      })
    )

    const result = await presignAndPullBatch({
      batch,
      context,
      getPieceCID: (entry) => entry.pieceCID,
      getRoot: (entry) => entry.root,
      getSourceURL: (entry) => entry.sourceURL,
      phase: 'source-pull',
      signal: undefined,
    })

    expect(result.failedUploads.size).toBe(0)
    expect(result.pulledCandidates).toEqual(batch)
    expect(context.presignForCommit).toHaveBeenCalledTimes(1)
    expect(context.pull).toHaveBeenCalledTimes(3)
    expect(
      context.pull.mock.calls[0][0].extraData ===
        context.pull.mock.calls[1][0].extraData
    ).toBe(true)
  })

  it('attaches retry diagnostics to exhausted operational pull failures', async () => {
    const firstPieceCID = createPieceCID().toString()
    const batch = [
      createPullEntry(
        'bafy-root-pull-failed-1',
        firstPieceCID,
        'https://source.example/pull-failed-1'
      ),
    ]
    const context = createPullContext(
      vi.fn(async () => {
        throw new Error('fetch failed')
      })
    )

    const result = await presignAndPullBatch({
      batch,
      context,
      getPieceCID: (entry) => entry.pieceCID,
      getRoot: (entry) => entry.root,
      getSourceURL: (entry) => entry.sourceURL,
      phase: 'source-pull',
      signal: undefined,
    })

    expect(result.failureKind).toBe('operational')
    expect(result.stage).toBe('source-pull')
    expect(result.failedUploads).toEqual(new Set(['bafy-root-pull-failed-1']))
    expect(result.error).toBeInstanceOf(PullFailedFailure)
    expect(result.error?.message).toContain('phase=source-pull')
    expect(result.error?.message).toContain('attempts=4')

    const error = /** @type {API.PullDiagnosticError} */ (
      /** @type {unknown} */ (result.error)
    )
    expect(error.failureStep).toBe('pull')
    expect(error.phase).toBe('source-pull')
    expect(error.attempts).toBe(DEFAULT_PULL_RETRIES + 1)
    expect(error.retriesConfigured).toBe(DEFAULT_PULL_RETRIES)
    expect(error.pieceCount).toBe(1)
    expect(error.rootCount).toBe(1)
    expect(error.pieceCIDsSample).toEqual([firstPieceCID])
    expect(error.rootsSample).toEqual(['bafy-root-pull-failed-1'])
    expect(error.sourceURLsSample).toEqual([
      'https://source.example/pull-failed-1',
    ])
    expect(error.elapsedMs).toBeGreaterThanOrEqual(0)
  })

  it('does not retry aborted pull attempts', async () => {
    const batch = [
      createPullEntry(
        'bafy-root-pull-abort',
        createPieceCID().toString(),
        'https://source.example/pull-abort'
      ),
    ]
    const context = createPullContext(
      vi.fn(async () => {
        throw createAbortError()
      })
    )

    await expect(
      presignAndPullBatch({
        batch,
        context,
        getPieceCID: (entry) => entry.pieceCID,
        getRoot: (entry) => entry.root,
        getSourceURL: (entry) => entry.sourceURL,
        phase: 'source-pull',
        signal: undefined,
      })
    ).rejects.toMatchObject({ name: 'AbortError' })

    expect(context.presignForCommit).toHaveBeenCalledTimes(1)
    expect(context.pull).toHaveBeenCalledTimes(1)
  })

  it('stops promptly when aborted during retry backoff', async () => {
    const batch = [
      createPullEntry(
        'bafy-root-pull-backoff-abort',
        createPieceCID().toString(),
        'https://source.example/pull-backoff-abort'
      ),
    ]
    const controller = new AbortController()
    const context = createPullContext(
      vi.fn(async () => {
        throw new Error('fetch failed')
      })
    )

    const startedAt = Date.now()
    const pending = presignAndPullBatch({
      batch,
      context,
      getPieceCID: (entry) => entry.pieceCID,
      getRoot: (entry) => entry.root,
      getSourceURL: (entry) => entry.sourceURL,
      phase: 'source-pull',
      signal: controller.signal,
    })

    setTimeout(() => controller.abort(createAbortError()), 25)

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })

    expect(Date.now() - startedAt).toBeLessThan(DEFAULT_RETRY_MIN_TIMEOUT)
  })
})

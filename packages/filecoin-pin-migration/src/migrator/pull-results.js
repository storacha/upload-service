/**
 * Apply pull batch results to migration state and emit failure/checkpoint
 * events. Successful candidate handling is delegated to the caller.
 *
 * @template {{ root: string }} T
 * @param {object} args
 * @param {Array<import('../api.js').PullResult<T>>} args.pullResults
 * @param {import('../api.js').MigrationStore} args.store
 * @param {import('../api.js').MigrationState} args.state
 * @param {import('../api.js').SpaceDID} args.spaceDID
 * @param {number} args.copyIndex
 * @param {Set<string>} args.activeFailedRoots
 * @param {(candidate: T) => Iterable<string>} args.getFailureRoots
 * @param {(candidate: T) => boolean} args.onPulledCandidate
 * @returns {Generator<import('../api.js').MigrationEvent>}
 */
export function* applyPullResults({
  pullResults,
  store,
  state,
  spaceDID,
  copyIndex,
  activeFailedRoots,
  getFailureRoots,
  onPulledCandidate,
}) {
  let stateChanged = false

  for (const result of pullResults) {
    const hasFailures =
      result.failedEntries.length > 0 || result.failedUploads.size > 0

    if (hasFailures) {
      const failedRoots = new Set(result.failedUploads)

      for (const candidate of result.failedEntries) {
        for (const root of getFailureRoots(candidate)) {
          failedRoots.add(root)
        }
      }

      for (const root of failedRoots) {
        activeFailedRoots.add(root)
        stateChanged =
          store.recordFailedUpload(spaceDID, copyIndex, root) || stateChanged
      }

      yield /** @type {import('../api.js').MigrationEvent} */ {
        type: 'migration:batch:failed',
        spaceDID,
        copyIndex,
        stage: /** @type {import('../api.js').MigrationExecutionPhase} */ (
          result.stage
        ),
        error: /** @type {Error} */ (result.error),
        roots: [...failedRoots],
      }
    }

    for (const candidate of result.pulledCandidates) {
      if (activeFailedRoots.has(candidate.root)) continue
      stateChanged = onPulledCandidate(candidate) || stateChanged
    }
  }

  if (stateChanged) {
    yield /** @type {import('../api.js').MigrationEvent} */ ({
      type: 'state:checkpoint',
      state,
    })
  }
}

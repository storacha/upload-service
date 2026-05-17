import process from 'node:process'

const READER_SIGINT_DEBOUNCE_MS = 250

/**
 * @param {object} args
 * @param {string} args.stateFile
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} args.state
 * @param {AbortController} args.abortController
 * @param {() => 'reader' | 'planning' | 'migrating' | undefined} args.getCurrentRuntimePhase
 * @param {(stateFile: string, state: import('@storacha/filecoin-pin-migration/types').MigrationState) => void} args.saveStateSync
 */
export function setupMigrationSignals({
  stateFile,
  state,
  abortController,
  getCurrentRuntimePhase,
  saveStateSync,
}) {
  let stopRequested = false
  /** @type {'migrating' | undefined} */
  let gracefulStopNoticePhase
  let ignoreSigintUntil = 0

  const onSigint = () => {
    const now = Date.now()
    if (now < ignoreSigintUntil) {
      return
    }

    const currentRuntimePhase = getCurrentRuntimePhase()

    if (currentRuntimePhase === 'reader' && !stopRequested) {
      stopRequested = true
      ignoreSigintUntil = now + READER_SIGINT_DEBOUNCE_MS
      console.log(
        '\nWill finish the current reader page and save the current processing state before stopping.'
      )
      console.log(
        'If you are ok losing the in-flight reader page, press Ctrl+C again to abort immediately.'
      )
      return
    }

    if (currentRuntimePhase === 'migrating') {
      if (!stopRequested) {
        stopRequested = true
        gracefulStopNoticePhase = 'migrating'
      }
      return
    }

    if (stopRequested) {
      const tail =
        currentRuntimePhase === 'reader'
          ? ' The in-flight reader page may be lost if it has not been checkpointed yet.'
          : ''
      console.log(`\nAborting now.${tail}`)
    } else {
      stopRequested = true
      console.log('\nStopping after the current step and persisting state...')
    }

    saveStateSync(stateFile, state)
    abortController.abort()
  }

  process.on('SIGINT', onSigint)

  return {
    isStopRequested: () => stopRequested,
    consumeGracefulStopNoticePhase: () => {
      const phase = gracefulStopNoticePhase
      gracefulStopNoticePhase = undefined
      return phase
    },
    teardown: () => {
      process.off('SIGINT', onSigint)
    },
  }
}

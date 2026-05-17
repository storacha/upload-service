import fs from 'node:fs'
import process from 'node:process'
import chalk from 'chalk'
import { confirm, select } from '@inquirer/prompts'
import { deserializeState } from '@storacha/filecoin-pin-migration'
import { printResumeStatus } from './view/resume.js'

/**
 * Probe the state file without opening a store. Preserves the same parse
 * and deserialize pipeline as `JsonFileStore.open()` so that version-mismatch
 * and corrupt-JSON errors surface identically.
 *
 * @param {string} path
 * @returns {{ exists: false } | { exists: true, state: import('@storacha/filecoin-pin-migration/types').MigrationState, error?: undefined } | { exists: true, error: Error, state?: undefined }}
 */
function probeStateFile(path) {
  if (!fs.existsSync(path)) {
    return { exists: false }
  }

  try {
    const raw = fs.readFileSync(path, 'utf8')
    return { exists: true, state: deserializeState(JSON.parse(raw)) }
  } catch (err) {
    return {
      exists: true,
      error: err instanceof Error ? err : new Error(String(err)),
    }
  }
}

/**
 * Probe the state file and exit with a diagnostic message when the file is
 * required but missing or unreadable (--resume / --retry paths).
 *
 * @param {string} stateFile
 * @returns {import('@storacha/filecoin-pin-migration/types').MigrationState}
 */
function probeStateFileOrExit(stateFile) {
  const result = probeStateFile(stateFile)

  if (!result.exists) {
    console.error(
      `Error: resume requested but state file was not found: ${stateFile}`
    )
    process.exit(1)
  }

  if (result.error) {
    console.error(`Error: failed to read state file - ${result.error.message}`)
    process.exit(1)
  }

  return result.state
}

/**
 * Decide how the migration should start (fresh / resume / retry) by probing
 * the existing state file and prompting the user when necessary.
 *
 * Returns the selected mode plus whether an existing state file should be
 * replaced before opening the store. Does **not** open a store or own any
 * state. `migrate/index.js` opens the store after the mode decision so that a
 * user-cancelled run does not create an empty state file or leave a stale lock.
 *
 * @param {object} args
 * @param {string} args.stateFile
 * @param {boolean} args.resume
 * @param {boolean} args.retry
 * @returns {Promise<{ mode: 'fresh' | 'resume' | 'retry', replaceExisting: boolean } | null>}
 */
export async function resolveStartState({ stateFile, resume, retry }) {
  if (resume) {
    probeStateFileOrExit(stateFile)
    return { mode: 'resume', replaceExisting: false }
  }

  if (retry) {
    probeStateFileOrExit(stateFile)
    return { mode: 'retry', replaceExisting: false }
  }

  const existingState = probeStateFile(stateFile)
  if (!existingState.exists) {
    return { mode: 'fresh', replaceExisting: false }
  }

  if (existingState.error) {
    console.warn(
      chalk.yellow(
        `Existing state file found at ${stateFile}, but it could not be loaded: ${existingState.error.message}`
      )
    )

    if (
      !(await confirmFreshOverwrite({
        cancelMessage:
          'Migration cancelled. Keep the current file or restart with a compatible state file.',
      }))
    ) {
      return null
    }

    return { mode: 'fresh', replaceExisting: true }
  }

  printExistingStateSummary(stateFile, existingState.state)

  if (existingState.state.phase === 'complete') {
    return null
  }

  const action = await promptForExistingStateAction(existingState.state)

  if (action === 'cancel') {
    console.log(
      chalk.dim(
        'Migration cancelled. Re-run with --resume or --retry to use the existing state file.'
      )
    )
    return null
  }

  if (action === 'resume') {
    return { mode: 'resume', replaceExisting: false }
  }

  if (action === 'retry') {
    return { mode: 'retry', replaceExisting: false }
  }

  if (
    !(await confirmFreshOverwrite({
      cancelMessage:
        'Migration cancelled. Re-run with --resume or --retry to use the existing state file.',
    }))
  ) {
    return null
  }

  return { mode: 'fresh', replaceExisting: true }
}

/**
 * @param {string} stateFile
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} state
 */
function printExistingStateSummary(stateFile, state) {
  console.log(chalk.dim(`State file: ${stateFile}`))
  console.log('')

  printResumeStatus(state, {
    title:
      state.phase === 'complete'
        ? 'Existing Migration State (Completed)'
        : 'Existing Migration State',
    showWhenEmpty: true,
  })
}

/**
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} state
 * @returns {Promise<'resume' | 'retry' | 'fresh' | 'cancel'>}
 */
async function promptForExistingStateAction(state) {
  const recommendedAction = getRecommendedExistingStateAction(state)
  const hasFailedUploads = countFailedUploads(state) > 0
  const choices = [
    {
      name:
        recommendedAction === 'resume'
          ? 'Resume existing migration (Recommended)'
          : 'Resume existing migration',
      value: 'resume',
    },
  ]

  if (hasFailedUploads) {
    choices.push({
      name:
        recommendedAction === 'retry'
          ? 'Retry failed uploads (Recommended)'
          : 'Retry failed uploads',
      value: 'retry',
    })
  }

  choices.push({
    name: 'Start fresh and overwrite state file',
    value: 'fresh',
  })
  choices.push({
    name: 'Cancel',
    value: 'cancel',
  })

  const action = await select({
    message:
      'An existing migration state file was found. What do you want to do?',
    choices,
  }).catch(() => 'cancel')

  return /** @type {'resume' | 'retry' | 'fresh' | 'cancel'} */ (action)
}

/**
 * @param {object} [options]
 * @param {string} [options.cancelMessage]
 */
async function confirmFreshOverwrite({
  cancelMessage = 'Migration cancelled.',
} = {}) {
  const overwrite = await confirm({
    message: 'Start fresh and overwrite the current state file?',
    default: false,
  }).catch(() => false)

  if (overwrite) {
    return true
  }

  console.log(chalk.dim(cancelMessage))
  return false
}

/**
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} state
 */
function countFailedUploads(state) {
  let totalFailedUploads = 0

  for (const space of Object.values(state.spaces)) {
    for (const copy of space.copies) {
      totalFailedUploads += copy.failedUploads.size
    }
  }

  return totalFailedUploads
}

/**
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} state
 * @returns {'resume' | 'retry'}
 */
function getRecommendedExistingStateAction(state) {
  return countFailedUploads(state) > 0 ? 'retry' : 'resume'
}

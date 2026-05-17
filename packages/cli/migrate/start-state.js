import chalk from 'chalk'
import { confirm, select } from '@inquirer/prompts'
import { createInitialState } from '@storacha/filecoin-pin-migration'
import { printResumeStatus } from './view/resume.js'
import { loadStateOrExit, tryLoadState } from './state-file.js'

/**
 * @param {object} args
 * @param {string} args.stateFile
 * @param {boolean} args.resume
 * @param {boolean} args.retry
 * @returns {Promise<{ mode: 'fresh' | 'resume' | 'retry', state: import('@storacha/filecoin-pin-migration/types').MigrationState } | null>}
 */
export async function resolveStartState({ stateFile, resume, retry }) {
  if (resume) {
    return { mode: 'resume', state: loadStateOrExit(stateFile) }
  }

  if (retry) {
    return { mode: 'retry', state: loadStateOrExit(stateFile) }
  }

  const existingState = tryLoadState(stateFile)
  if (!existingState.exists) {
    return { mode: 'fresh', state: createInitialState() }
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

    return { mode: 'fresh', state: createInitialState() }
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
    return { mode: 'resume', state: existingState.state }
  }

  if (action === 'retry') {
    return { mode: 'retry', state: existingState.state }
  }

  if (
    !(await confirmFreshOverwrite({
      cancelMessage:
        'Migration cancelled. Re-run with --resume or --retry to use the existing state file.',
    }))
  ) {
    return null
  }

  return { mode: 'fresh', state: createInitialState() }
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

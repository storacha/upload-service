import fs from 'node:fs'
import process from 'node:process'
import chalk from 'chalk'
import { confirm, select } from '@inquirer/prompts'
import {
  deserializeState,
  MissingSqliteDependencyError,
} from '@storacha/filecoin-pin-migration'
import { printResumeStatus } from './view/resume.js'
import { line, renderBox } from './view/layout.js'

/**
 * @typedef {{
 *   phase: import('@storacha/filecoin-pin-migration/types').MigrationPhase
 *   failedUploads: number
 *   state?: import('@storacha/filecoin-pin-migration/types').MigrationState
 * }} ProbeSummary
 */

/**
 * Probe the state file without opening a store. Preserves the same parse
 * and deserialize pipeline as `JsonFileStore.open()` so that version-mismatch
 * and corrupt-JSON errors surface identically.
 *
 * @param {string} path
 * @param {'json' | 'sqlite'} format
 * @returns {Promise<{ exists: false } | { exists: true, summary: ProbeSummary, error?: undefined } | { exists: true, error: Error, summary?: undefined }>}
 */
async function probeStateForResume(path, format) {
  if (!fs.existsSync(path)) {
    return { exists: false }
  }

  try {
    if (format === 'json') {
      const raw = fs.readFileSync(path, 'utf8')
      const state = deserializeState(JSON.parse(raw))
      return {
        exists: true,
        summary: {
          phase: state.phase,
          failedUploads: countFailedUploads({
            phase: state.phase,
            failedUploads: 0,
            state,
          }),
          state,
        },
      }
    }

    return {
      exists: true,
      summary: await probeSqliteSummary(path),
    }
  } catch (err) {
    if (err instanceof MissingSqliteDependencyError) {
      throw err
    }
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
 * @param {'json' | 'sqlite'} stateFormat
 * @returns {Promise<ProbeSummary>}
 */
async function probeStateFileOrExit(stateFile, stateFormat) {
  const result = await probeStateForResume(stateFile, stateFormat)

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

  return result.summary
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
 * @param {'json' | 'sqlite'} args.stateFormat
 * @param {boolean} args.resume
 * @param {boolean} args.retry
 * @returns {Promise<{ mode: 'fresh' | 'resume' | 'retry', replaceExisting: boolean } | null>}
 */
export async function resolveStartState({
  stateFile,
  stateFormat,
  resume,
  retry,
}) {
  if (resume) {
    await probeStateFileOrExit(stateFile, stateFormat)
    return { mode: 'resume', replaceExisting: false }
  }

  if (retry) {
    await probeStateFileOrExit(stateFile, stateFormat)
    return { mode: 'retry', replaceExisting: false }
  }

  const existingState = await probeStateForResume(stateFile, stateFormat)
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

  printExistingStateSummary(stateFile, existingState.summary)

  if (existingState.summary.phase === 'complete') {
    return null
  }

  const action = await promptForExistingStateAction(existingState.summary)

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
 * @param {ProbeSummary} summary
 */
function printExistingStateSummary(stateFile, summary) {
  console.log(chalk.dim(`State file: ${stateFile}`))
  console.log('')

  if (summary.state) {
    printResumeStatus(summary.state, undefined, {
      title:
        summary.phase === 'complete'
          ? 'Existing Migration State (Completed)'
          : 'Existing Migration State',
      showWhenEmpty: true,
    })
    return
  }

  console.log(
    renderBox(
      summary.phase === 'complete'
        ? 'Existing Migration State (Completed)'
        : 'Existing Migration State',
      [
        line('Migration phase', summary.phase),
        line('Failed uploads', String(summary.failedUploads)),
        'SQLite resume probe used summary queries only.',
      ],
      chalk.cyan
    )
  )
  console.log('')
}

/**
 * @param {ProbeSummary} summary
 * @returns {Promise<'resume' | 'retry' | 'fresh' | 'cancel'>}
 */
async function promptForExistingStateAction(summary) {
  const recommendedAction = getRecommendedExistingStateAction(summary)
  const hasFailedUploads = summary.failedUploads > 0
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
 * @param {ProbeSummary} state
 */
function countFailedUploads(state) {
  if (!state.state) {
    return state.failedUploads
  }

  let totalFailedUploads = 0

  for (const space of Object.values(state.state.spaces)) {
    for (const copy of space.copies) {
      totalFailedUploads += copy.failedUploads.size
    }
  }

  return totalFailedUploads
}

/**
 * @param {ProbeSummary} state
 * @returns {'resume' | 'retry'}
 */
function getRecommendedExistingStateAction(state) {
  return countFailedUploads(state) > 0 ? 'retry' : 'resume'
}

/**
 * @param {string} path
 * @returns {Promise<ProbeSummary>}
 */
async function probeSqliteSummary(path) {
  const moduleName = 'better-sqlite3'

  let Database
  try {
    ;({ default: Database } = await import(moduleName))
  } catch (cause) {
    if (
      cause instanceof Error &&
      'code' in cause &&
      cause.code === 'ERR_MODULE_NOT_FOUND' &&
      cause.message.includes('better-sqlite3')
    ) {
      throw new MissingSqliteDependencyError()
    }
    throw cause
  }

  const db = /**
     @type {{
    prepare(source: string): {
      get(...args: unknown[]): unknown
      all(...args: unknown[]): unknown[]
    }
    close(): void
  }} */ (new Database(path, { readonly: true, fileMustExist: true }))

  try {
    const phaseRow =
      /** @type {{ phase?: import('@storacha/filecoin-pin-migration/types').MigrationPhase } | undefined} */ (
        db.prepare('SELECT phase FROM migration_state WHERE id = 1').get()
      )

    const failedRows = /** @type {Array<{ count: number }>} */ (
      db.prepare('SELECT COUNT(*) AS count FROM failed_uploads').all()
    )

    return {
      phase: phaseRow?.phase ?? 'reading',
      failedUploads: failedRows[0]?.count ?? 0,
    }
  } finally {
    db.close()
  }
}

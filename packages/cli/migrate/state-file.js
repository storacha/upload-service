import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {
  serializeState,
  deserializeState,
} from '@storacha/filecoin-pin-migration'

const DEFAULT_STATE_FILE_BASENAME = 'storacha-migration'

/**
 * @param {string} stateFile
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} state
 */
export async function saveState(stateFile, state) {
  await fs.promises.mkdir(path.dirname(stateFile), { recursive: true })
  await fs.promises.writeFile(stateFile, serializeStateForDisk(state))
}

/**
 * @param {string} stateFile
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} state
 */
export function saveStateSync(stateFile, state) {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true })
  fs.writeFileSync(stateFile, serializeStateForDisk(state))
}

/**
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} state
 */
export function serializeStateForDisk(state) {
  return JSON.stringify(serializeState(state))
}

/**
 * @param {string} stateFile
 */
export function loadStateOrExit(stateFile) {
  if (!fs.existsSync(stateFile)) {
    console.error(
      `Error: resume requested but state file was not found: ${stateFile}`
    )
    process.exit(1)
  }

  try {
    const raw = fs.readFileSync(stateFile, 'utf8')
    return deserializeState(JSON.parse(raw))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Error: failed to read state file - ${message}`)
    process.exit(1)
  }
}

/**
 * @param {string} stateFile
 * @returns {{ exists: false } | { exists: true, state: import('@storacha/filecoin-pin-migration/types').MigrationState, error?: undefined } | { exists: true, error: Error, state?: undefined }}
 */
export function tryLoadState(stateFile) {
  if (!fs.existsSync(stateFile)) {
    return { exists: false }
  }

  try {
    const raw = fs.readFileSync(stateFile, 'utf8')
    return { exists: true, state: deserializeState(JSON.parse(raw)) }
  } catch (err) {
    return {
      exists: true,
      error: err instanceof Error ? err : new Error(String(err)),
    }
  }
}

/**
 * @param {string} spaceDID
 */
export function defaultStateFileForSpace(spaceDID) {
  const safeSpace = spaceDID.replace(/[^a-zA-Z0-9._-]+/g, '-')
  return path.join(
    process.cwd(),
    `${DEFAULT_STATE_FILE_BASENAME}-${safeSpace}.json`
  )
}

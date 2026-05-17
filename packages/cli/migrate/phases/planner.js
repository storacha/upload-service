import ora from 'ora'
import {
  createMigrationPlan,
  ResumeBindingDriftError,
} from '@storacha/filecoin-pin-migration'
import { printPhaseTitle } from '../view/phase.js'

/**
 * @param {object} args
 * @param {import('@filoz/synapse-sdk').Synapse} args.synapse
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} args.state
 * @param {(state: import('@storacha/filecoin-pin-migration/types').MigrationState) => Promise<void>} args.persistCheckpoint
 * @param {AbortSignal} args.signal
 */
export async function planMigration({
  synapse,
  state,
  persistCheckpoint,
  signal,
}) {
  printPhaseTitle('Planning')
  const spinner = ora({
    text: 'Creating migration plan...',
    color: 'cyan',
  }).start()

  /** @type {import('@storacha/filecoin-pin-migration/types').MigrationPlan | undefined} */
  let plan

  try {
    for await (const event of createMigrationPlan({ synapse, state })) {
      switch (event.type) {
        case 'state:checkpoint':
          await persistCheckpoint(state)
          break
        case 'planner:ready':
          plan = event.plan
          break
      }

      if (signal.aborted) {
        spinner.stop()
        return { interrupted: true, plan }
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    spinner.fail(
      err instanceof ResumeBindingDriftError
        ? `Resume binding drift detected: ${message}`
        : `Failed to create migration plan: ${message}`
    )
    throw err
  }

  if (!plan) {
    spinner.fail('Failed to create migration plan')
    throw new Error('planner:ready event was never yielded')
  }

  spinner.succeed('Migration plan ready')
  return { interrupted: false, plan }
}

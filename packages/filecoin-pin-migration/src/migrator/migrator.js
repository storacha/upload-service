import { createExecutionConfig } from './execution-config.js'
import { runMigration } from './run-migration.js'
import { migrateSpace } from './space-runner.js'

/** @import * as API from '../api.js' */

/**
 * Execute a migration from Storacha to Filecoin on Chain (FOC).
 *
 * Yields MigrationEvents. Consumers iterate with `for await` and handle
 * persistence, progress display, and error reporting at their own pace.
 *
 * Flow per space:
 *   1. Fund once via synapse.payments.fundSync (pre-flight).
 *   2. Delegate space execution to `migrateSpace()`, which runs both copies:
 *      - copy 0 stores `shardsToStore`, source-pulls normal `shards`, then commits
 *      - copy 1 source-pulls normal `shards`, pulls stored pieces from copy 0,
 *        then commits
 *   3. Yield migration:complete with a summary derived from final state.
 *
 * Resume: pass the deserialized MigrationState. Shards already in a copy's
 * committed set are skipped. Shards already in a copy's pulled set are not
 * re-pulled and go straight to commit batching. createMigrationPlan() pins
 * SP and dataset bindings from state automatically.
 *
 * @param {API.ExecuteMigrationInput} input
 * @returns {AsyncGenerator<API.MigrationEvent>}
 */
export async function* executeMigration({
  plan,
  state,
  synapse,
  batchSize: batchSizeOpt,
  maxCommitRetries: maxCommitRetriesOpt,
  commitRetryTimeout: commitRetryTimeoutOpt,
  pullConcurrency: pullConcurrencyOpt,
  storeConcurrency: storeConcurrencyOpt,
  fetcher: fetcherOpt,
  signal,
}) {
  const requiresStoreFlow = plan.costs.perSpace.some(
    (perSpaceCost) =>
      (state.spacesInventories[perSpaceCost.spaceDID]?.shardsToStore.length ??
        0) > 0
  )
  const config = createExecutionConfig({
    batchSize: batchSizeOpt,
    maxCommitRetries: maxCommitRetriesOpt,
    commitRetryTimeout: commitRetryTimeoutOpt,
    pullConcurrency: pullConcurrencyOpt,
    storeConcurrency: storeConcurrencyOpt,
    fetcher: fetcherOpt,
    signal,
    fetcherErrorMessage: requiresStoreFlow
      ? 'executeMigration: a fetch implementation is required when shardsToStore are present'
      : undefined,
  })

  yield* runMigration({
    plan,
    state,
    synapse,
    signal,
    totalBytes: plan.totals.bytesToMigrate,
    getActionableShards: iterateInventoryActionableShards,
    prepareInventory: ({ sourceInventory }) => sourceInventory,
    executeSpace: ({ inventory, perSpaceCost }) =>
      migrateSpace({
        inventory,
        perSpaceCost,
        state,
        config,
      }),
  })
}

/**
 * @param {API.SpaceInventory} inventory
 * @returns {Generator<{ cid: string }>}
 */
function* iterateInventoryActionableShards(inventory) {
  yield* inventory.shards
  yield* inventory.shardsToStore
}

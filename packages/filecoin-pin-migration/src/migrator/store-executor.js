import { createExecutionConfig } from './execution-config.js'
import { runMigration } from './run-migration.js'
import { migrateSpace } from './space-runner.js'

/** @import * as API from '../api.js' */

const EMPTY_SHARDS = /** @type {API.ResolvedShard[]} */ (
  /** @type {unknown} */ (Object.freeze([]))
)

/**
 * Execute the standalone store() migration flow for selected uploads by
 * delegating to the shared `migrateSpace()` executor with a store-only
 * execution view.
 *
 * For each selected space, this rewrites the execution inventory so all
 * actionable shards flow through `shardsToStore`, then reuses the same mixed
 * source/store migrator logic as `executeMigration()`.
 *
 * @param {API.ExecuteStoreMigrationInput} input
 * @returns {AsyncGenerator<API.MigrationEvent>}
 */
export async function* executeStoreMigration({
  plan,
  state,
  synapse,
  batchSize: batchSizeOpt,
  fetcher: fetcherOpt,
  storeConcurrency: storeConcurrencyOpt,
  pullConcurrency: pullConcurrencyOpt,
  commitConcurrency: commitConcurrencyOpt,
  signal,
  maxCommitRetries: maxCommitRetriesOpt,
  commitRetryTimeout: commitRetryTimeoutOpt,
}) {
  const config = createExecutionConfig({
    batchSize: batchSizeOpt,
    maxCommitRetries: maxCommitRetriesOpt,
    commitRetryTimeout: commitRetryTimeoutOpt,
    pullConcurrency: pullConcurrencyOpt,
    storeConcurrency: storeConcurrencyOpt,
    commitConcurrency: commitConcurrencyOpt,
    fetcher: fetcherOpt,
    signal,
    fetcherErrorMessage:
      'executeStoreMigration: a fetch implementation is required',
  })

  yield* runMigration({
    plan,
    state,
    synapse,
    signal,
    totalBytes: plan.totals.bytesToMigrate,
    getActionableShards: (inventory) => inventory.shardsToStore,
    prepareInventory: ({ sourceInventory }) => {
      const inventory = prepareInventoryForExecution(sourceInventory)
      return inventory.shardsToStore.length > 0 ? inventory : undefined
    },
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
 * Build a store-executor-only execution view for a single inventory.
 *
 * This intentionally does not mutate the reader-owned inventory in state.
 * Reader output is shared across planning, resume, summaries, and the pull
 * executor, so the store executor keeps its merged shard bucket as a local
 * per-space view only. By emptying `shards` and routing everything through
 * `shardsToStore`, the shared `migrateSpace()` executor becomes a store-only
 * execution for that run.
 *
 * @param {API.SpaceInventory} inventory
 * @returns {API.SpaceInventory}
 */
function prepareInventoryForExecution(inventory) {
  let storeShards
  if (inventory.shards.length === 0) {
    storeShards = inventory.shardsToStore
  } else if (inventory.shardsToStore.length === 0) {
    storeShards = inventory.shards
  } else {
    storeShards = [...inventory.shardsToStore, ...inventory.shards]
  }

  return {
    did: inventory.did,
    name: inventory.name,
    uploads: inventory.uploads,
    shards: EMPTY_SHARDS,
    shardsToStore: storeShards,
    skippedUploads: inventory.skippedUploads,
    totalBytes: inventory.totalBytes,
    totalSizeToMigrate: inventory.totalSizeToMigrate,
  }
}

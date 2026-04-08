/**
 * @import * as API from './api.js'
 */

// ── Phase resolvers (pure, unexported) ────────────────────────────────────────
//
// Phase progression (read this before editing the resolvers below):
//
//   Upload:    pending → migrating → complete          (during batch loop, final=false)
//              pending → incomplete | complete          (after finalizeSpace, final=true)
//   Space:     pending → complete | incomplete | failed (after finalizeSpace)
//   Migration: approved → funded → complete | incomplete (after finalizeMigration)
//
// Rule: resolveUploadPhase(upload, false) during processing
//       resolveUploadPhase(upload, true)  in finalizeSpace

/**
 * Resolve upload phase.
 *
 * Pass `final=false` during the batch loop (partial progress is still 'migrating').
 * Pass `final=true` in finalizeSpace (partial progress becomes terminal 'incomplete').
 *
 * @param {{ committedShards: number; totalShards: number }} upload
 * @param {boolean} final
 * @returns {API.UploadPhase}
 */
function resolveUploadPhase({ committedShards, totalShards }, final) {
  if (committedShards === totalShards) return 'complete'
  if (committedShards > 0) return final ? 'incomplete' : 'migrating'
  return 'pending'
}

/**
 * Resolve space phase at finalization.
 * Must be called after all upload phases have been finalized (final=true).
 *
 * @param {API.SpaceState} space
 * @returns {API.SpacePhase}
 */
function resolveSpacePhase(space) {
  const uploads = Object.values(space.uploads)
  if (uploads.length === 0) return 'failed'
  if (uploads.every((u) => u.phase === 'complete')) return 'complete'
  if (uploads.some((u) => u.phase === 'incomplete')) return 'incomplete'
  return 'failed'
}

/**
 * Resolve top-level migration phase at finalization.
 *
 * @param {API.MigrationState} state
 * @returns {API.MigrationPhase}
 */
function resolveMigrationPhase(state) {
  const spaces = Object.values(state.spaces)
  if (spaces.every((s) => s.phase === 'complete')) return 'complete'
  return 'incomplete'
}

// ── Checkpoint functions ───────────────────────────────────────────────────────

/**
 * Checkpoint 1: user approves plan — BEFORE fundSync.
 *
 * Builds the full MigrationState from the cost result and plan inventory.
 * SP bindings (providerId, serviceProvider) are captured here so a re-run
 * after a crash binds to the same SP even if fundSync never landed.
 *
 * Upload counts are sourced from the plan inventory, not the cost calculation.
 *
 * @param {API.PerSpaceCost[]} perSpace
 * @param {API.PlanSpace[]} planSpaces
 * @returns {API.MigrationState}
 */
export function createApprovalState(perSpace, planSpaces) {
  /** @type {API.MigrationState['spaces']} */
  const spaces = {}

  for (const cost of perSpace) {
    const plan = planSpaces.find((s) => s.did === cost.spaceDID)

    /** @type {Record<string, API.UploadState>} */
    const uploads = {}
    for (const upload of plan?.uploads ?? []) {
      uploads[upload.root] = {
        phase: 'pending',
        totalShards: upload.shards.length,
        committedShards: 0,
      }
    }

    spaces[cost.spaceDID] = {
      spaceDID: cost.spaceDID,
      phase: 'pending',
      providerId: cost.providerId,
      serviceProvider: cost.serviceProvider,
      dataSetId: cost.dataSetId,
      uploads,
    }
  }

  return { phase: 'approved', spaces, committed: {} }
}

/**
 * Checkpoint 2: fundSync landed.
 *
 * @param {API.MigrationState} state - Mutated in place
 */
export function transitionToFunded(state) {
  state.phase = 'funded'
}

/**
 * Checkpoint 3: a shard was successfully committed.
 *
 * Updates the committed map, increments upload progress, and resolves the
 * active upload phase. Only counts toward upload progress on the first commit
 * for a given shard (any provider) — copies > 1 add to the committed array
 * but don't double-count committedShards.
 *
 * @param {API.MigrationState} state - Mutated in place
 * @param {API.SpaceDID} spaceDID
 * @param {string} uploadRoot
 * @param {string} shardCid
 * @param {string} provider
 * @param {bigint} dataSetId
 */
export function recordCommit(
  state,
  spaceDID,
  uploadRoot,
  shardCid,
  provider,
  dataSetId
) {
  const providers =
    state.committed[shardCid] ?? (state.committed[shardCid] = [])
  const isFirstCommit = providers.length === 0
  if (!providers.includes(provider)) {
    providers.push(provider)
  }

  const space = state.spaces[spaceDID]
  if (!space) return

  if (space.dataSetId === null) {
    space.dataSetId = dataSetId
  }

  if (!isFirstCommit) return

  const upload = space.uploads[uploadRoot]
  if (!upload) return
  upload.committedShards++
  upload.phase = resolveUploadPhase(upload, false)
}

/**
 * Checkpoint 4: space loop ends — resolve terminal phases for all uploads
 * and the space itself.
 *
 * @param {API.MigrationState} state - Mutated in place
 * @param {API.SpaceDID} spaceDID
 */
export function finalizeSpace(state, spaceDID) {
  const space = state.spaces[spaceDID]
  if (!space) return
  for (const upload of Object.values(space.uploads)) {
    upload.phase = resolveUploadPhase(upload, true)
  }
  space.phase = resolveSpacePhase(space)
}

/**
 * Checkpoint 5: all spaces processed — resolve terminal migration phase.
 *
 * @param {API.MigrationState} state - Mutated in place
 */
export function finalizeMigration(state) {
  state.phase = resolveMigrationPhase(state)
}

/**
 * Extract SP and dataset bindings from a persisted MigrationState.
 *
 * Called internally by createMigrationPlan() when a state argument is passed.
 * Consumers do not need to call this directly — pass the deserialized state to
 * createMigrationPlan() and it handles the extraction.
 *
 * @param {API.MigrationState} state
 * @returns {API.ResumeState}
 */
export function buildResumeState(state) {
  /** @type {Map<API.SpaceDID, bigint>} */
  const pinnedProviderIds = new Map()
  /** @type {Map<API.SpaceDID, bigint>} */
  const existingDataSetIds = new Map()

  for (const [did, space] of Object.entries(state.spaces)) {
    const spaceDID = /** @type {API.SpaceDID} */ (did)
    pinnedProviderIds.set(spaceDID, space.providerId)
    if (space.dataSetId != null) {
      existingDataSetIds.set(spaceDID, space.dataSetId)
    }
  }

  return { pinnedProviderIds, existingDataSetIds }
}

/**
 * Convert a MigrationState into a JSON-safe plain object.
 *
 * bigint fields are encoded as decimal strings since JSON.stringify cannot
 * serialize bigints:
 *   - spaces[did].providerId → decimal string
 *   - spaces[did].dataSetId → decimal string or null
 *
 * committed values are already string[] — no encoding needed.
 *
 * @param {API.MigrationState} state
 */
export function serializeState(state) {
  /** @type {Record<string, unknown>} */
  const spaces = {}
  for (const [did, space] of Object.entries(state.spaces)) {
    /** @type {Record<string, unknown>} */
    const uploads = {}
    for (const [root, upload] of Object.entries(space.uploads)) {
      uploads[root] = {
        phase: upload.phase,
        totalShards: upload.totalShards,
        committedShards: upload.committedShards,
      }
    }
    spaces[did] = {
      spaceDID: space.spaceDID,
      phase: space.phase,
      providerId: space.providerId.toString(10),
      serviceProvider: space.serviceProvider,
      dataSetId: space.dataSetId != null ? space.dataSetId.toString(10) : null,
      uploads,
    }
  }

  return {
    phase: state.phase,
    spaces,
    committed: { ...state.committed },
  }
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {string} context
 * @returns {bigint}
 */
function parseBigIntField(value, field, context) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new TypeError(
      `deserializeState: ${context} — "${field}" must be a decimal integer string, got ${JSON.stringify(
        value
      )}`
    )
  }
  return BigInt(value)
}

/**
 * Hydrate a MigrationState from a JSON-parsed object.
 *
 * Reverses serializeState — decimal strings back to bigint.
 *
 * @param {unknown} obj
 * @returns {API.MigrationState}
 */
export function deserializeState(obj) {
  if (!obj || typeof obj !== 'object') {
    throw new TypeError('deserializeState: expected an object')
  }
  const raw = /** @type {Record<string, unknown>} */ (obj)
  if (
    typeof raw.phase !== 'string' ||
    typeof raw.spaces !== 'object' ||
    typeof raw.committed !== 'object' ||
    raw.spaces === null ||
    raw.committed === null
  ) {
    throw new TypeError('deserializeState: missing phase, spaces, or committed')
  }

  /** @type {API.MigrationState['spaces']} */
  const spaces = {}
  for (const [did, rawSpace] of Object.entries(
    /** @type {Record<string, Record<string, unknown>>} */ (raw.spaces)
  )) {
    const rawUploads = /** @type {Record<string, Record<string, unknown>>} */ (
      rawSpace.uploads ?? {}
    )
    /** @type {Record<string, API.UploadState>} */
    const uploads = {}
    for (const [root, u] of Object.entries(rawUploads)) {
      uploads[root] = {
        phase: /** @type {API.UploadPhase} */ (u.phase),
        totalShards: /** @type {number} */ (u.totalShards),
        committedShards: /** @type {number} */ (u.committedShards),
      }
    }
    spaces[/** @type {API.SpaceDID} */ (did)] = {
      spaceDID: /** @type {API.SpaceDID} */ (rawSpace.spaceDID),
      phase: /** @type {API.SpacePhase} */ (rawSpace.phase),
      providerId: parseBigIntField(
        rawSpace.providerId,
        'providerId',
        `space "${did}"`
      ),
      serviceProvider: /** @type {`0x${string}`} */ (rawSpace.serviceProvider),
      dataSetId:
        rawSpace.dataSetId != null
          ? parseBigIntField(rawSpace.dataSetId, 'dataSetId', `space "${did}"`)
          : null,
      uploads,
    }
  }

  /** @type {API.MigrationState['committed']} */
  const committed = {}
  for (const [cid, providers] of Object.entries(
    /** @type {Record<string, string[]>} */ (raw.committed)
  )) {
    committed[cid] = providers
  }

  return {
    phase: /** @type {API.MigrationPhase} */ (raw.phase),
    spaces,
    committed,
  }
}

/**
 * @import * as API from './api.js'
 */

// ── Phase resolvers ────────────────────────────────────────────────────────────
//
// Phase progression:
//   Upload:    pending → migrating → complete | incomplete  (computed, never stored)
//   Space:     pending → complete | incomplete | failed     (set in finalizeSpace)
//   Migration: approved → funded → complete | incomplete   (set in finalizeMigration)
//
// resolveUploadPhase is exported as a consumer utility — not used internally.
// Space phase is resolved directly from CommittedShards.count vs inventory.totalShards.

/**
 * Compute upload phase from shard counts. Consumer utility — not used internally.
 *
 * Pass `final=false` during the batch loop (partial progress is still 'migrating').
 * Pass `final=true` at space finalization (partial progress becomes terminal 'incomplete').
 *
 * @param {{ committedShards: number; totalShards: number }} upload
 * @param {boolean} final
 * @returns {API.UploadPhase}
 */
export function resolveUploadPhase({ committedShards, totalShards }, final) {
  if (committedShards === totalShards) return 'complete'
  if (committedShards > 0) return final ? 'incomplete' : 'migrating'
  return 'pending'
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

// ── Initialization ─────────────────────────────────────────────────────────────

/**
 * Create the initial MigrationState before the reader runs.
 *
 * This is the single entry point for a new migration run. Pass the returned
 * state to buildMigrationInventories(), then to createMigrationPlan(), then
 * to executeMigration().
 *
 * @returns {API.MigrationState}
 */
export function createInitialState() {
  return /** @type {API.MigrationState} */ ({
    phase: 'reading',
    spaces: {},
    spacesInventories: {},
    readerProgressCursors: undefined,
  })
}

// ── Reader checkpoint ──────────────────────────────────────────────────────────

/**
 * Checkpoint a completed upload.list page into the space's inventory entry.
 *
 * The reader builds uploads as a Record and accumulates totalShards/totalBytes
 * during its natural shard-resolution pass — no extra iteration here.
 * This function does an O(uploads-on-page) merge and cursor update only.
 *
 * cursor present → space is still being read, save cursor for resume
 * cursor absent  → last page processed, space reading is complete
 *
 * @param {API.MigrationState} state - Mutated in place
 * @param {{
 *   spaceDID: API.SpaceDID
 *   uploads: Record<string, { shards: API.ResolvedShard[] }>
 *   skippedShards: Array<{ cid: string; reason: string }>
 *   totalShards: number
 *   totalBytes: bigint
 *   cursor: string | undefined
 * }} page
 */
export function checkpointInventoryPage(state, { spaceDID, uploads, skippedShards, totalShards, totalBytes, cursor }) {
  let inventory = state.spacesInventories[spaceDID]
  if (!inventory) {
    inventory = {
      did: spaceDID,
      uploads: {},
      skippedShards: [],
      totalUploads: 0,
      totalShards: 0,
      totalBytes: 0n,
    }
    state.spacesInventories[spaceDID] = inventory
  }

  Object.assign(inventory.uploads, uploads)
  inventory.skippedShards.push(...skippedShards)
  inventory.totalUploads += Object.keys(uploads).length
  inventory.totalShards += totalShards
  inventory.totalBytes += totalBytes

  if (cursor) {
    if (!state.readerProgressCursors) state.readerProgressCursors = {}
    state.readerProgressCursors[spaceDID] = cursor
  } else if (state.readerProgressCursors) {
    delete state.readerProgressCursors[spaceDID]
    if (Object.keys(state.readerProgressCursors).length === 0) {
      state.readerProgressCursors = undefined
    }
  }
}

// ── Approval checkpoint ────────────────────────────────────────────────────────

/**
 * Checkpoint 1: user approves plan — BEFORE fundSync.
 *
 * Populates state.spaces with SP bindings from the cost result. Upload tracking
 * is not pre-populated here — progress is derived at runtime from space.committed
 * and state.spacesInventories.
 *
 * SP bindings (providerId, serviceProvider) are captured here so a re-run
 * after a crash binds to the same SP even if fundSync never landed.
 *
 * @param {API.MigrationState} state - Mutated in place
 * @param {API.PerSpaceCost[]} perSpaceCost
 */
export function transitionToApproved(state, perSpaceCost) {
  for (const cost of perSpaceCost) {
    state.spaces[cost.spaceDID] = {
      did: cost.spaceDID,
      phase: 'pending',
      providerId: cost.providerId,
      serviceProvider: cost.serviceProvider,
      dataSetId: cost.dataSetId,
      committed: { shards: {}, count: 0 },
    }
  }
  state.phase = 'approved'
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
 * Updates the space's committed map. Only counts toward committed on the first
 * commit for a given shard (any provider) — copies > 1 add to the committed
 * array but the shard was already tracked.
 *
 * @param {API.MigrationState} state - Mutated in place
 * @param {API.SpaceDID} spaceDID
 * @param {string} shardCid
 * @param {string} provider
 * @param {bigint} dataSetId
 */
export function recordCommit(state, spaceDID, shardCid, provider, dataSetId) {
  const space = state.spaces[spaceDID]
  if (!space) return

  const { shards } = space.committed
  const providers = shards[shardCid] ?? (shards[shardCid] = [])
  const isFirstCommit = providers.length === 0
  if (!providers.includes(provider)) {
    providers.push(provider)
  }
  if (isFirstCommit) {
    space.committed.count++
  }

  if (space.dataSetId === null) {
    space.dataSetId = dataSetId
  }
}

/**
 * Checkpoint 4: space loop ends — resolve terminal phases for all uploads
 * and the space itself.
 *
 * Upload phases are computed from space.committed counts vs inventory shard
 * counts — not stored. resolveUploadPhase is called with computed values.
 *
 * @param {API.MigrationState} state - Mutated in place
 * @param {API.SpaceDID} spaceDID
 */
export function finalizeSpace(state, spaceDID) {
  const space = state.spaces[spaceDID]
  if (!space) return

  const inventory = state.spacesInventories[spaceDID]
  if (!inventory) {
    space.phase = 'failed'
    return
  }

  const { count } = space.committed
  if (count === 0) {
    space.phase = 'failed'
  } else if (count === inventory.totalShards) {
    space.phase = 'complete'
  } else {
    space.phase = 'incomplete'
  }
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
 *   - spacesInventories[did].totalBytes → decimal string
 *   - spacesInventories[did].uploads[root].shards[].sizeBytes → decimal string
 *
 * @param {API.MigrationState} state
 */
export function serializeState(state) {
  /** @type {Record<string, unknown>} */
  const spaces = {}
  for (const [did, space] of Object.entries(state.spaces)) {
    spaces[did] = {
      did: space.did,
      phase: space.phase,
      providerId: space.providerId.toString(10),
      serviceProvider: space.serviceProvider,
      dataSetId: space.dataSetId != null ? space.dataSetId.toString(10) : null,
      committed: {
        shards: { ...space.committed.shards },
        count: space.committed.count,
      },
    }
  }

  /** @type {Record<string, unknown>} */
  const spacesInventories = {}
  for (const [did, inventory] of Object.entries(state.spacesInventories)) {
    /** @type {Record<string, unknown>} */
    const uploads = {}
    for (const [root, upload] of Object.entries(inventory.uploads)) {
      uploads[root] = {
        shards: upload.shards.map((s) => ({
          cid: s.cid,
          pieceCID: s.pieceCID,
          sourceURL: s.sourceURL,
          sizeBytes: s.sizeBytes.toString(10),
        })),
      }
    }
    spacesInventories[did] = {
      did: inventory.did,
      uploads,
      skippedShards: [...inventory.skippedShards],
      totalUploads: inventory.totalUploads,
      totalShards: inventory.totalShards,
      totalBytes: inventory.totalBytes.toString(10),
    }
  }

  return {
    phase: state.phase,
    spaces,
    spacesInventories,
    readerProgressCursors: state.readerProgressCursors
      ? { ...state.readerProgressCursors }
      : undefined,
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
    typeof raw.spacesInventories !== 'object' ||
    raw.spaces === null ||
    raw.spacesInventories === null
  ) {
    throw new TypeError(
      'deserializeState: missing phase, spaces, or spacesInventories'
    )
  }

  /** @type {API.MigrationState['spaces']} */
  const spaces = {}
  for (const [did, rawSpace] of Object.entries(
    /** @type {Record<string, Record<string, unknown>>} */ (raw.spaces)
  )) {
    const rawCommitted = /** @type {{ shards?: Record<string, string[]>; count?: number }} */ (
      rawSpace.committed ?? {}
    )
    /** @type {Record<string, string[]>} */
    const committedShards = {}
    for (const [cid, providers] of Object.entries(rawCommitted.shards ?? {})) {
      committedShards[cid] = providers
    }
    spaces[/** @type {API.SpaceDID} */ (did)] = {
      did: /** @type {API.SpaceDID} */ (rawSpace.did),
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
      committed: {
        shards: committedShards,
        count: typeof rawCommitted.count === 'number' ? rawCommitted.count : Object.keys(committedShards).length,
      },
    }
  }

  /** @type {API.MigrationState['spacesInventories']} */
  const spacesInventories = {}
  for (const [did, rawInv] of Object.entries(
    /** @type {Record<string, Record<string, unknown>>} */ (raw.spacesInventories)
  )) {
    const rawUploads = /** @type {Record<string, Record<string, unknown>>} */ (
      rawInv.uploads ?? {}
    )
    /** @type {Record<string, { shards: API.ResolvedShard[] }>} */
    const uploads = {}
    for (const [root, u] of Object.entries(rawUploads)) {
      const rawShards = /** @type {Array<Record<string, unknown>>} */ (
        u.shards ?? []
      )
      uploads[root] = {
        shards: rawShards.map((s) => ({
          cid: /** @type {string} */ (s.cid),
          pieceCID: /** @type {string} */ (s.pieceCID),
          sourceURL: /** @type {string} */ (s.sourceURL),
          sizeBytes: parseBigIntField(s.sizeBytes, 'sizeBytes', `shard "${s.cid}"`),
        })),
      }
    }
    spacesInventories[/** @type {API.SpaceDID} */ (did)] = {
      did: /** @type {API.SpaceDID} */ (rawInv.did),
      uploads,
      skippedShards: /** @type {Array<{ cid: string; reason: string }>} */ (
        rawInv.skippedShards ?? []
      ),
      totalUploads: /** @type {number} */ (rawInv.totalUploads),
      totalShards: /** @type {number} */ (rawInv.totalShards),
      totalBytes: parseBigIntField(rawInv.totalBytes, 'totalBytes', `inventory "${did}"`),
    }
  }

  /** @type {Record<API.SpaceDID, string> | undefined} */
  const readerProgressCursors =
    raw.readerProgressCursors &&
    typeof raw.readerProgressCursors === 'object'
      ? /** @type {Record<API.SpaceDID, string>} */ ({
          .../** @type {object} */ (raw.readerProgressCursors),
        })
      : undefined

  return {
    phase: /** @type {API.MigrationPhase} */ (raw.phase),
    spaces,
    spacesInventories,
    readerProgressCursors,
  }
}

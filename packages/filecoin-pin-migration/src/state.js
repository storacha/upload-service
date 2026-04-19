/**
 * @import * as API from './api.js'
 */

/**
 * Build a copy state entry.
 *
 * @param {object} input
 * @param {number} input.copyIndex
 * @param {bigint} input.providerId
 * @param {`0x${string}`} input.serviceProvider
 * @param {bigint | null} input.dataSetId
 * @param {Set<string>} [input.pulled]
 * @param {Set<string>} [input.committed]
 * @param {Set<string>} [input.failedUploads]
 * @param {Record<string, string>} [input.storedShards]
 * @returns {API.SpaceCopyState}
 */
function createSpaceCopyState({
  copyIndex,
  providerId,
  serviceProvider,
  dataSetId,
  pulled = new Set(),
  committed = new Set(),
  failedUploads = new Set(),
  storedShards = {},
}) {
  return {
    copyIndex,
    providerId,
    serviceProvider,
    dataSetId,
    pulled,
    committed,
    failedUploads,
    storedShards,
  }
}

/**
 * @param {API.SpaceState} space
 * @param {number} copyIndex
 * @returns {API.SpaceCopyState | undefined}
 */
function getCopy(space, copyIndex) {
  return space.copies.find((copy) => copy.copyIndex === copyIndex)
}

// ── Phase resolvers ────────────────────────────────────────────────────────────
//
// Phase progression:
//   Upload:    pending → migrating → complete | incomplete  (computed, never stored)
//   Space:     pending → complete | incomplete | failed     (set in finalizeSpace)
//   Migration: approved → funded → complete | incomplete   (set in finalizeMigration)
//
// resolveUploadPhase is exported as a consumer utility — not used internally.
// Space phase is resolved directly from per-copy committed counts vs inventory.shards.length.

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
 * Append-only: pushes flat shards, upload roots, and failed roots.
 * Only byte counters are accumulated — uploads.length and shard bucket lengths are free.
 *
 * cursor present → space is still being read, save cursor for resume
 * cursor absent  → last page processed, space reading is complete
 *
 * @param {API.MigrationState} state - Mutated in place
 * @param {{
 *   spaceDID: API.SpaceDID
 *   name?: string
 *   shards: API.ResolvedShard[]
 *   shardsToStore: API.StoreShard[]
 *   uploads: string[]
 *   skippedUploads: string[]
 *   totalBytes: bigint
 *   totalSizeToMigrate: bigint
 *   cursor: string | undefined
 * }} page
 */
export function checkpointInventoryPage(
  state,
  {
    spaceDID,
    name,
    shards,
    shardsToStore,
    uploads,
    skippedUploads,
    totalBytes,
    totalSizeToMigrate,
    cursor,
  }
) {
  let inventory = state.spacesInventories[spaceDID]
  if (!inventory) {
    inventory = {
      did: spaceDID,
      name,
      uploads: [],
      shards: [],
      shardsToStore: [],
      skippedUploads: [],
      totalBytes: 0n,
      totalSizeToMigrate: 0n,
    }
    state.spacesInventories[spaceDID] = inventory
  } else if (name !== undefined) {
    inventory.name = name
  }

  inventory.shards.push(...shards)
  inventory.shardsToStore.push(...shardsToStore)
  inventory.uploads.push(...uploads)
  inventory.skippedUploads.push(...skippedUploads)
  inventory.totalBytes += totalBytes
  inventory.totalSizeToMigrate += totalSizeToMigrate

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
 * Populates state.spaces with per-copy SP bindings from the cost result.
 * Upload tracking is not pre-populated here — progress is derived at runtime
 * from each copy's committed set and state.spacesInventories.
 *
 * SP bindings are captured here so a re-run after a crash binds each copy to
 * the same provider even if fundSync never landed.
 *
 * @param {API.MigrationState} state - Mutated in place
 * @param {API.PerSpaceCost[]} perSpaceCost
 */
export function transitionToApproved(state, perSpaceCost) {
  for (const cost of perSpaceCost) {
    const existing = state.spaces[cost.spaceDID]
    const existingByIndex = new Map(
      existing?.copies.map((copy) => [copy.copyIndex, copy]) ?? []
    )
    const copies = cost.copies.map((plannedCopy) => {
      const existingCopy = existingByIndex.get(plannedCopy.copyIndex)
      return createSpaceCopyState({
        copyIndex: plannedCopy.copyIndex,
        providerId: plannedCopy.providerId,
        serviceProvider: plannedCopy.serviceProvider,
        dataSetId: existingCopy?.dataSetId ?? plannedCopy.dataSetId,
        pulled: existingCopy?.pulled ?? new Set(),
        committed: existingCopy?.committed ?? new Set(),
        failedUploads: existingCopy?.failedUploads ?? new Set(),
        storedShards: existingCopy?.storedShards ?? {},
      })
    })

    state.spaces[cost.spaceDID] = {
      did: cost.spaceDID,
      phase: existing?.phase ?? 'pending',
      copies,
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
 * Checkpoint 3: a shard was successfully pulled and is ready to commit.
 *
 * @param {API.MigrationState} state - Mutated in place
 * @param {API.SpaceDID} spaceDID
 * @param {number} copyIndex
 * @param {string} shardCid
 * @returns {boolean} true when state changed
 */
export function recordPull(state, spaceDID, copyIndex, shardCid) {
  const space = state.spaces[spaceDID]
  if (!space) return false

  const copy = getCopy(space, copyIndex)
  if (!copy || copy.committed.has(shardCid)) {
    return false
  }

  const before = copy.pulled.size
  copy.pulled.add(shardCid)
  if (space.phase === 'pending') {
    space.phase = 'migrating'
  }
  return copy.pulled.size !== before
}

/**
 * Checkpoint 4: an upload failed during migration.
 *
 * @param {API.MigrationState} state - Mutated in place
 * @param {API.SpaceDID} spaceDID
 * @param {number} copyIndex
 * @param {string} root
 * @returns {boolean} true when state changed
 */
export function recordFailedUpload(state, spaceDID, copyIndex, root) {
  const space = state.spaces[spaceDID]
  if (!space) return false

  const copy = getCopy(space, copyIndex)
  if (!copy) return false

  const before = copy.failedUploads.size
  copy.failedUploads.add(root)
  return copy.failedUploads.size !== before
}

/**
 * Checkpoint 5: a shard was successfully stored and its pieceCID is now durable.
 *
 * Stored shard tracking is only meaningful for copy 0, which performs store().
 *
 * @param {API.MigrationState} state - Mutated in place
 * @param {API.SpaceDID} spaceDID
 * @param {string} shardCid
 * @param {string} pieceCID
 * @returns {boolean} true when state changed
 */
export function recordStoredShard(state, spaceDID, shardCid, pieceCID) {
  const space = state.spaces[spaceDID]
  if (!space) return false

  const copy = getCopy(space, 0)
  if (!copy) return false

  const before = copy.storedShards[shardCid]
  copy.storedShards[shardCid] = pieceCID
  if (space.phase === 'pending') {
    space.phase = 'migrating'
  }
  return before !== pieceCID
}

/**
 * Checkpoint 6: a shard was successfully committed.
 *
 * Sets the shard CID in the committed set for a specific copy.
 *
 * @param {API.MigrationState} state - Mutated in place
 * @param {API.SpaceDID} spaceDID
 * @param {number} copyIndex
 * @param {string} shardCid
 * @param {bigint} dataSetId
 */
export function recordCommit(state, spaceDID, copyIndex, shardCid, dataSetId) {
  const space = state.spaces[spaceDID]
  if (!space) return

  const copy = getCopy(space, copyIndex)
  if (!copy) return

  copy.committed.add(shardCid)
  copy.pulled.delete(shardCid)
  if (space.phase === 'pending') {
    space.phase = 'migrating'
  }

  if (copy.dataSetId === null) {
    copy.dataSetId = dataSetId
  }
}

/**
 * Checkpoint 7: space loop ends — resolve terminal phases for all uploads
 * and the space itself.
 *
 * Upload phases are computed from per-copy committed counts vs inventory shard
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

  const copyStates = space.copies
  if (copyStates.length === 0) {
    space.phase = 'failed'
    return
  }

  const totalShards = inventory.shards.length + inventory.shardsToStore.length
  const allComplete = copyStates.every(
    (copy) => copy.committed.size === totalShards
  )
  const anyCommitted = copyStates.some((copy) => copy.committed.size > 0)

  if (!anyCommitted) {
    space.phase = 'failed'
  } else if (allComplete) {
    space.phase = 'complete'
  } else {
    space.phase = 'incomplete'
  }
}

/**
 * Checkpoint 8: all spaces processed — resolve terminal migration phase.
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
  /** @type {Map<API.SpaceDID, Map<number, bigint>>} */
  const pinnedProviderIds = new Map()
  /** @type {Map<API.SpaceDID, Map<number, bigint>>} */
  const existingDataSetIds = new Map()

  for (const [did, space] of Object.entries(state.spaces)) {
    const spaceDID = /** @type {API.SpaceDID} */ (did)
    const providers = new Map()
    const dataSets = new Map()

    for (const copy of space.copies) {
      providers.set(copy.copyIndex, copy.providerId)
      if (copy.dataSetId != null) {
        dataSets.set(copy.copyIndex, copy.dataSetId)
      }
    }

    if (providers.size > 0) {
      pinnedProviderIds.set(spaceDID, providers)
    }
    if (dataSets.size > 0) {
      existingDataSetIds.set(spaceDID, dataSets)
    }
  }

  return { pinnedProviderIds, existingDataSetIds }
}

/**
 * Convert a MigrationState into a JSON-safe plain object.
 *
 * bigint fields are encoded as decimal strings since JSON.stringify cannot
 * serialize bigints:
 *   - spaces[did].copies[*].providerId → decimal string
 *   - spaces[did].copies[*].dataSetId → decimal string or null
 *   - spacesInventories[did].totalBytes → decimal string
 *   - spacesInventories[did].totalSizeToMigrate → decimal string
 *   - spacesInventories[did].shards[].sizeBytes → decimal string
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
      copies: space.copies.map((copy) => ({
        copyIndex: copy.copyIndex,
        providerId: copy.providerId.toString(10),
        serviceProvider: copy.serviceProvider,
        dataSetId: copy.dataSetId != null ? copy.dataSetId.toString(10) : null,
        pulled: [...copy.pulled],
        committed: [...copy.committed],
        failedUploads: [...copy.failedUploads],
        storedShards: { ...copy.storedShards },
      })),
    }
  }

  /** @type {Record<string, unknown>} */
  const spacesInventories = {}
  for (const [did, inventory] of Object.entries(state.spacesInventories)) {
    spacesInventories[did] = {
      did: inventory.did,
      ...(inventory.name !== undefined ? { name: inventory.name } : {}),
      uploads: inventory.uploads,
      shards: inventory.shards.map((s) => ({
        root: s.root,
        cid: s.cid,
        pieceCID: s.pieceCID,
        sourceURL: s.sourceURL,
        sizeBytes: s.sizeBytes.toString(10),
      })),
      shardsToStore: inventory.shardsToStore.map((s) => ({
        root: s.root,
        cid: s.cid,
        pieceCID: s.pieceCID,
        sourceURL: s.sourceURL,
        sizeBytes: s.sizeBytes.toString(10),
      })),
      skippedUploads: inventory.skippedUploads,
      totalBytes: inventory.totalBytes.toString(10),
      totalSizeToMigrate: inventory.totalSizeToMigrate.toString(10),
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
 * @param {unknown} value
 * @param {string} field
 * @param {string} context
 * @returns {Set<string>}
 */
function parseStringSetField(value, field, context) {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item !== 'string') {
        throw new TypeError(
          `deserializeState: ${context} — "${field}" must contain only strings`
        )
      }
    }
    return new Set(value)
  }

  throw new TypeError(
    `deserializeState: ${context} — "${field}" must be an array of strings`
  )
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {string} context
 * @returns {Record<string, string>}
 */
function parseStringRecordField(value, field, context) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(
      `deserializeState: ${context} — "${field}" must be an object of string values`
    )
  }

  /** @type {Record<string, string>} */
  const record = {}
  for (const [key, item] of Object.entries(
    /** @type {Record<string, unknown>} */ (value)
  )) {
    if (typeof item !== 'string') {
      throw new TypeError(
        `deserializeState: ${context} — "${field}" must contain only string values`
      )
    }
    record[key] = item
  }
  return record
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
    const rawCopies = /** @type {Array<Record<string, unknown>>} */ (
      rawSpace.copies ?? []
    )
    if (rawCopies.length === 0) {
      throw new TypeError(
        `deserializeState: space "${did}" — "copies" must be a non-empty array`
      )
    }

    const copies = rawCopies.map((rawCopy, copyPosition) =>
      createSpaceCopyState({
        copyIndex:
          typeof rawCopy.copyIndex === 'number'
            ? rawCopy.copyIndex
            : copyPosition,
        providerId: parseBigIntField(
          rawCopy.providerId,
          'providerId',
          `space "${did}" copy ${copyPosition}`
        ),
        serviceProvider: /** @type {`0x${string}`} */ (rawCopy.serviceProvider),
        dataSetId:
          rawCopy.dataSetId != null
            ? parseBigIntField(
                rawCopy.dataSetId,
                'dataSetId',
                `space "${did}" copy ${copyPosition}`
              )
            : null,
        pulled: parseStringSetField(
          rawCopy.pulled,
          'pulled',
          `space "${did}" copy ${copyPosition}`
        ),
        committed: parseStringSetField(
          rawCopy.committed,
          'committed',
          `space "${did}" copy ${copyPosition}`
        ),
        failedUploads: parseStringSetField(
          rawCopy.failedUploads,
          'failedUploads',
          `space "${did}" copy ${copyPosition}`
        ),
        storedShards: parseStringRecordField(
          rawCopy.storedShards,
          'storedShards',
          `space "${did}" copy ${copyPosition}`
        ),
      })
    )

    spaces[/** @type {API.SpaceDID} */ (did)] = {
      did: /** @type {API.SpaceDID} */ (rawSpace.did),
      phase: /** @type {API.SpacePhase} */ (rawSpace.phase),
      copies,
    }
  }

  /** @type {API.MigrationState['spacesInventories']} */
  const spacesInventories = {}
  for (const [did, rawInv] of Object.entries(
    /** @type {Record<string, Record<string, unknown>>} */ (
      raw.spacesInventories
    )
  )) {
    const rawShards = /** @type {Array<Record<string, unknown>>} */ (
      rawInv.shards ?? []
    )
    const rawShardsToStore = /** @type {Array<Record<string, unknown>>} */ (
      rawInv.shardsToStore
    )
    spacesInventories[/** @type {API.SpaceDID} */ (did)] = {
      did: /** @type {API.SpaceDID} */ (rawInv.did),
      ...(typeof rawInv.name === 'string' ? { name: rawInv.name } : {}),
      uploads: /** @type {string[]} */ (rawInv.uploads ?? []),
      shards: rawShards.map((s) => ({
        root: /** @type {string} */ (s.root),
        cid: /** @type {string} */ (s.cid),
        pieceCID: /** @type {string} */ (s.pieceCID),
        sourceURL: /** @type {string} */ (s.sourceURL),
        sizeBytes: parseBigIntField(
          s.sizeBytes,
          'sizeBytes',
          `shard "${s.cid}"`
        ),
      })),
      shardsToStore: rawShardsToStore.map((s) => ({
        root: /** @type {string} */ (s.root),
        cid: /** @type {string} */ (s.cid),
        ...(s.pieceCID != null
          ? { pieceCID: /** @type {string} */ (s.pieceCID) }
          : {}),
        sourceURL: /** @type {string} */ (s.sourceURL),
        sizeBytes: parseBigIntField(
          s.sizeBytes,
          'sizeBytes',
          `store shard "${s.cid}"`
        ),
      })),
      skippedUploads: /** @type {string[]} */ (rawInv.skippedUploads ?? []),
      totalBytes: parseBigIntField(
        rawInv.totalBytes,
        'totalBytes',
        `inventory "${did}"`
      ),
      totalSizeToMigrate: parseBigIntField(
        rawInv.totalSizeToMigrate,
        'totalSizeToMigrate',
        `inventory "${did}"`
      ),
    }
  }

  /** @type {Record<API.SpaceDID, string> | undefined} */
  const readerProgressCursors =
    raw.readerProgressCursors && typeof raw.readerProgressCursors === 'object'
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

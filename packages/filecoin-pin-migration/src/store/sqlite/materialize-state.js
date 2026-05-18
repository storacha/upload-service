import * as State from '../../state.js'

/**
 * @import * as API from '../../api.js'
 */

/**
 * @param {ReturnType<import('./statements.js').prepareStatements>} stmts
 * @returns {API.MigrationState}
 */
export function materializeState(stmts) {
  const state = State.createInitialState()
  /**
     @type {Array<{
    space_did: API.SpaceDID
    root_cid: string
    skipped: number
  }>} */
  const uploadRows = /**
     @type {Array<{
    space_did: API.SpaceDID
    root_cid: string
    skipped: number
  }>} */ (stmts.selectUploads.all())

  const phaseRow = /** @type {{ phase?: API.MigrationPhase } | undefined} */ (
    stmts.selectMigrationState.get()
  )
  if (phaseRow?.phase) {
    state.phase = phaseRow.phase
  }

  /** @type {Map<API.SpaceDID, Map<string, string[]>>} */
  const rootsBySpaceAndShard = new Map()
  /** @type {Map<API.SpaceDID, Set<string>>} */
  const pullRootsBySpace = new Map()
  /** @type {Map<API.SpaceDID, API.SpacePhase>} */
  const phaseBySpace = new Map()

  for (const row of /**
     @type {Array<{
    did: API.SpaceDID
    name: string | null
    phase: API.SpacePhase
    total_bytes: bigint
    total_size_to_migrate: bigint
    reader_cursor: string | null
  }>} */ (stmts.selectSpaces.all())) {
    phaseBySpace.set(row.did, row.phase)
    state.spacesInventories[row.did] = {
      did: row.did,
      ...(row.name != null ? { name: row.name } : {}),
      uploads: [],
      shards: [],
      shardsToStore: [],
      skippedUploads: [],
      totalBytes: row.total_bytes,
      totalSizeToMigrate: row.total_size_to_migrate,
    }

    if (row.reader_cursor != null) {
      if (!state.readerProgressCursors) {
        state.readerProgressCursors = {}
      }
      state.readerProgressCursors[row.did] = row.reader_cursor
    }
  }

  for (const row of /**
     @type {Array<{
    space_did: API.SpaceDID
    shard_cid: string
    root_cid: string
    piece_cid: string | null
    source_url: string
    size_bytes: bigint
    kind: API.ShardKind
  }>} */ (stmts.selectShards.all())) {
    const inventory = state.spacesInventories[row.space_did]
    if (!inventory) continue

    let spaceRoots = rootsBySpaceAndShard.get(row.space_did)
    if (!spaceRoots) {
      spaceRoots = new Map()
      rootsBySpaceAndShard.set(row.space_did, spaceRoots)
    }
    const roots = spaceRoots.get(row.shard_cid) ?? []
    roots.push(row.root_cid)
    spaceRoots.set(row.shard_cid, roots)

    if (row.kind === 'pull') {
      let pullRoots = pullRootsBySpace.get(row.space_did)
      if (!pullRoots) {
        pullRoots = new Set()
        pullRootsBySpace.set(row.space_did, pullRoots)
      }
      pullRoots.add(row.root_cid)

      inventory.shards.push({
        root: row.root_cid,
        cid: row.shard_cid,
        pieceCID: /** @type {string} */ (row.piece_cid),
        sourceURL: row.source_url,
        sizeBytes: row.size_bytes,
      })
      continue
    }

    inventory.shardsToStore.push({
      root: row.root_cid,
      cid: row.shard_cid,
      ...(row.piece_cid != null ? { pieceCID: row.piece_cid } : {}),
      sourceURL: row.source_url,
      sizeBytes: row.size_bytes,
    })
  }

  for (const row of uploadRows) {
    const inventory = state.spacesInventories[row.space_did]
    if (!inventory) continue

    const pullRoots = pullRootsBySpace.get(row.space_did)
    const hasPullShard = pullRoots?.has(row.root_cid) ?? false
    const hasAnyShard =
      inventory.shards.some((shard) => shard.root === row.root_cid) ||
      inventory.shardsToStore.some((shard) => shard.root === row.root_cid)

    if (hasAnyShard && !hasPullShard) {
      continue
    }

    if (row.skipped === 1) {
      inventory.skippedUploads.push(row.root_cid)
      continue
    }
    inventory.uploads.push(row.root_cid)
  }

  /** @type {Map<API.SpaceDID, Map<number, API.SpaceCopyState>>} */
  const copiesBySpace = new Map()

  for (const row of /**
     @type {Array<{
    space_did: API.SpaceDID
    copy_index: number
    provider_id: string
    service_provider: `0x${string}`
    provider_url: string | null
    data_set_id: string | null
  }>} */ (stmts.selectSpaceCopies.all())) {
    let copyMap = copiesBySpace.get(row.space_did)
    if (!copyMap) {
      copyMap = new Map()
      copiesBySpace.set(row.space_did, copyMap)
    }

    copyMap.set(row.copy_index, {
      copyIndex: row.copy_index,
      providerId: BigInt(row.provider_id),
      serviceProvider: row.service_provider,
      providerURL: row.provider_url,
      dataSetId: row.data_set_id != null ? BigInt(row.data_set_id) : null,
      pulled: new Set(),
      committed: new Set(),
      failedUploads: new Set(),
      storedShards: {},
    })
  }

  /** @type {Map<string, { pulled: boolean, storedPiece: string | null }>} */
  const progressByKey = new Map()

  for (const row of /**
     @type {Array<{
    space_did: API.SpaceDID
    copy_index: number
    shard_cid: string
    pulled: number
    stored_piece: string | null
  }>} */ (stmts.selectShardProgress.all())) {
    progressByKey.set(
      progressKey(row.space_did, row.copy_index, row.shard_cid),
      {
        pulled: row.pulled === 1,
        storedPiece: row.stored_piece,
      }
    )

    const copy = copiesBySpace.get(row.space_did)?.get(row.copy_index)
    if (!copy || row.stored_piece == null) continue
    copy.storedShards[row.shard_cid] = row.stored_piece
  }

  for (const row of /**
     @type {Array<{
    space_did: API.SpaceDID
    copy_index: number
    shard_cid: string
    root_cid: string
  }>} */ (stmts.selectCommitProgress.all())) {
    const copy = copiesBySpace.get(row.space_did)?.get(row.copy_index)
    if (!copy) continue
    copy.committed.add(State.commitKey(row.shard_cid, row.root_cid))
  }

  for (const [spaceDID, copyMap] of copiesBySpace.entries()) {
    const inventory = state.spacesInventories[spaceDID]
    const rootsByShard = rootsBySpaceAndShard.get(spaceDID) ?? new Map()
    const spacePhase = phaseBySpace.get(spaceDID)

    const copies = [...copyMap.values()].sort(
      (a, b) => a.copyIndex - b.copyIndex
    )
    for (const copy of copies) {
      for (const [shardCid, roots] of rootsByShard.entries()) {
        const progress = progressByKey.get(
          progressKey(spaceDID, copy.copyIndex, shardCid)
        )
        if (!progress?.pulled) continue

        const fullyCommitted = roots.every(
          /** @param {string} root */
          (root) => copy.committed.has(State.commitKey(shardCid, root))
        )
        if (!fullyCommitted) {
          copy.pulled.add(shardCid)
        }
      }
    }

    if (!inventory) continue

    const existing = state.spaces[spaceDID]
    if (existing) {
      existing.phase = spacePhase ?? 'pending'
      existing.copies = copies
      continue
    }

    state.spaces[spaceDID] = {
      did: spaceDID,
      phase: spacePhase ?? 'pending',
      copies,
    }
  }

  for (const row of /**
     @type {Array<{
    space_did: API.SpaceDID
    copy_index: number
    root_cid: string
  }>} */ (stmts.selectFailedUploads.all())) {
    const copy = copiesBySpace.get(row.space_did)?.get(row.copy_index)
    if (!copy) continue
    copy.failedUploads.add(row.root_cid)
  }

  return state
}

/**
 * @param {API.SpaceDID} spaceDID
 * @param {number} copyIndex
 * @param {string} shardCid
 */
function progressKey(spaceDID, copyIndex, shardCid) {
  return `${spaceDID}#${copyIndex}#${shardCid}`
}

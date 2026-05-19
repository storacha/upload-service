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
  const phaseRow = /** @type {{ phase?: API.MigrationPhase } | undefined} */ (
    stmts.selectMigrationState.get()
  )
  if (phaseRow?.phase) {
    state.phase = phaseRow.phase
  }

  /** @type {Map<API.SpaceDID, API.SpacePhase>} */
  const phaseBySpace = new Map()

  for (const row of /**
     @type {Iterable<{
    did: API.SpaceDID
    name: string | null
    phase: API.SpacePhase
    total_bytes: bigint
    total_size_to_migrate: bigint
    reader_cursor: string | null
  }>} */ (stmts.selectSpaces.iterate())) {
    phaseBySpace.set(row.did, row.phase)
    state.spaceMigrationInventories ??= {}
    state.spaceMigrationInventories[row.did] = {
      did: row.did,
      ...(row.name != null ? { name: row.name } : {}),
      uploadsCount: 0,
      shardsCount: 0,
      shardsToStoreCount: 0,
      skippedUploadsCount: 0,
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
     @type {Iterable<{
    space_did: API.SpaceDID
    shards_count: number
    shards_to_store_count: number
  }>} */ (stmts.selectShardCountsBySpace.iterate())) {
    const summary = state.spaceMigrationInventories?.[row.space_did]
    if (!summary) continue
    summary.shardsCount = row.shards_count
    summary.shardsToStoreCount = row.shards_to_store_count
  }

  for (const row of /**
     @type {Iterable<{
    space_did: API.SpaceDID
    uploads_count: number
    skipped_uploads_count: number
  }>} */ (stmts.selectUploadCountsBySpace.iterate())) {
    const summary = state.spaceMigrationInventories?.[row.space_did]
    if (!summary) continue
    summary.uploadsCount = row.uploads_count
    summary.skippedUploadsCount = row.skipped_uploads_count
  }

  /** @type {Map<string, API.SpaceCopyState>} */
  const copyByKey = new Map()

  for (const row of /**
     @type {Iterable<{
    space_did: API.SpaceDID
    copy_index: number
    provider_id: string
    service_provider: `0x${string}`
    provider_url: string | null
    data_set_id: string | null
  }>} */ (stmts.selectSpaceCopies.iterate())) {
    let space = state.spaces[row.space_did]
    if (!space) {
      space = state.spaces[row.space_did] = {
        did: row.space_did,
        phase: phaseBySpace.get(row.space_did) ?? 'pending',
        copies: [],
      }
    }

    const copy = {
      copyIndex: row.copy_index,
      providerId: BigInt(row.provider_id),
      serviceProvider: row.service_provider,
      providerURL: row.provider_url,
      dataSetId: row.data_set_id != null ? BigInt(row.data_set_id) : null,
      pulled: new Set(),
      committed: new Set(),
      failedUploads: new Set(),
      storedShards: {},
    }
    space.copies.push(copy)
    copyByKey.set(progressKey(row.space_did, row.copy_index), copy)
  }

  for (const row of /**
     @type {Iterable<{
    space_did: API.SpaceDID
    copy_index: number
    shard_cid: string
    stored_piece: string
  }>} */ (stmts.selectStoredPieces.iterate())) {
    const copy = copyByKey.get(progressKey(row.space_did, row.copy_index))
    if (!copy) continue
    copy.storedShards[row.shard_cid] = row.stored_piece
  }

  for (const row of /**
     @type {Iterable<{
    space_did: API.SpaceDID
    copy_index: number
    shard_cid: string
  }>} */ (stmts.selectPendingPulledShards.iterate())) {
    const copy = copyByKey.get(progressKey(row.space_did, row.copy_index))
    if (!copy) continue
    copy.pulled.add(row.shard_cid)
  }

  for (const row of /**
     @type {Iterable<{
    space_did: API.SpaceDID
    copy_index: number
    shard_cid: string
    root_cid: string
  }>} */ (stmts.selectCommitProgress.iterate())) {
    const copy = copyByKey.get(progressKey(row.space_did, row.copy_index))
    if (!copy) continue
    copy.committed.add(State.commitKey(row.shard_cid, row.root_cid))
  }

  for (const space of Object.values(state.spaces)) {
    space.copies.sort((a, b) => a.copyIndex - b.copyIndex)
  }

  for (const row of /**
     @type {Iterable<{
    space_did: API.SpaceDID
    copy_index: number
    root_cid: string
  }>} */ (stmts.selectFailedUploads.iterate())) {
    const copy = copyByKey.get(progressKey(row.space_did, row.copy_index))
    if (!copy) continue
    copy.failedUploads.add(row.root_cid)
  }

  return state
}

/**
 * @param {API.SpaceDID} spaceDID
 * @param {number} copyIndex
 */
function progressKey(spaceDID, copyIndex) {
  return `${spaceDID}#${copyIndex}`
}

import assert from 'assert'
import * as Server from '@ucanto/server'
import * as SpaceBlob from '@storacha/capabilities/space/blob'
import * as SpaceIndex from '@storacha/capabilities/space/index'
import * as Upload from '@storacha/capabilities/upload'
import * as Store from '@storacha/capabilities/store'

// NOTE: T3 — these tests target the not-yet-existing disable-writes module.
// Importing from a non-existent path makes this suite fail at module-resolution
// time, which is the desired RED state.
import { WRITE_PATHS, applyWritesDisabled } from '../../src/disable-writes.js'

// `store/add` capability lives in @web3-storage/capabilities (legacy) and is
// not a direct dep of @storacha/upload-api. The disable-writes module keeps a
// `store/add` entry for defense-in-depth using a literal `{ can: 'store/add' }`
// stand-in (the runtime only reads `.can` for the log message). Tests use a
// generic stand-in where a capability is referenced for the store/add slot.

/** @type {Array<{ path: string[], can: string }>} */
const EXPECTED_WRITES = [
  { path: ['space', 'blob', 'add'], can: 'space/blob/add' },
  { path: ['space', 'blob', 'remove'], can: 'space/blob/remove' },
  { path: ['space', 'blob', 'replicate'], can: 'space/blob/replicate' },
  { path: ['space', 'index', 'add'], can: 'space/index/add' },
  { path: ['upload', 'add'], can: 'upload/add' },
  { path: ['upload', 'remove'], can: 'upload/remove' },
  { path: ['store', 'add'], can: 'store/add' },
  { path: ['store', 'remove'], can: 'store/remove' },
]

/**
 * Builds a synthetic service tree with the 8 in-scope write leaves wired to
 * trivial pass-through handlers, plus extra non-write leaves used for the
 * identity-comparison assertion.
 *
 * Each leaf is a `Server.provide(cap, () => ok)` handler.
 *
 * @returns {Record<string, any>}
 */
const buildService = () => {
  /**
   * @param {*} cap @param {*} ok
   * @param ok
   */
  const provide = (cap, ok) => Server.provide(cap, async () => ({ ok }))
  const passthrough = {
    space: {
      blob: {
        add: provide(SpaceBlob.add, {
          site: { 'ucan/await': ['.out.ok.site', null] },
        }),
        remove: provide(SpaceBlob.remove, { size: 0 }),
        replicate: provide(SpaceBlob.replicate, { site: [] }),
        // non-write read sibling
        list: provide(SpaceBlob.list, { size: 0, results: [] }),
      },
      index: {
        add: provide(SpaceIndex.add, {}),
      },
    },
    upload: {
      add: provide(Upload.add, { root: null }),
      remove: provide(Upload.remove, { root: null }),
      // non-write read sibling
      list: provide(Upload.list, { size: 0, results: [] }),
    },
    store: {
      // store/add capability schema is not importable from @storacha/capabilities;
      // use store.remove as a generic stand-in to satisfy Server.provide for the
      // synthetic service. The test's contract only cares about path-based
      // replacement, not the leaf's underlying capability identity.
      add: provide(Store.remove, { status: 'done' }),
      remove: provide(Store.remove, { size: 0 }),
      // non-write read sibling
      get: provide(Store.get, { link: null, size: 0, insertedAt: '' }),
    },
  }
  return passthrough
}

describe('disable-writes module: WRITE_PATHS', () => {
  it('exports an array of 8 entries', () => {
    assert.ok(Array.isArray(WRITE_PATHS))
    assert.equal(WRITE_PATHS.length, 8)
  })

  it('each entry has a path (string[]) and a capability with a .can string', () => {
    for (const entry of WRITE_PATHS) {
      assert.ok(Array.isArray(entry.path), 'entry.path is an array')
      for (const seg of entry.path) {
        assert.equal(typeof seg, 'string')
      }
      assert.ok(entry.capability, 'entry has a capability')
      assert.equal(typeof entry.capability.can, 'string')
    }
  })

  it('contains exactly the expected set of capability can values', () => {
    const actualCans = WRITE_PATHS.map((e) => e.capability.can).sort()
    const expectedCans = EXPECTED_WRITES.map((e) => e.can).sort()
    assert.deepEqual(actualCans, expectedCans)
  })

  it('each path matches its capability can (path joined by "/")', () => {
    for (const { path, capability } of WRITE_PATHS) {
      assert.equal(path.join('/'), capability.can)
    }
  })
})

describe('disable-writes module: applyWritesDisabled', () => {
  it('is exported as a function', () => {
    assert.equal(typeof applyWritesDisabled, 'function')
  })

  it('returns a service object whose write leaves are replaced', async () => {
    const service = buildService()
    const originals = {
      blobAdd: service.space.blob.add,
      uploadAdd: service.upload.add,
    }

    const disabled = applyWritesDisabled(service)

    assert.ok(disabled, 'returns a value')
    // The returned tree's write leaves must differ from the originals.
    assert.notStrictEqual(
      disabled.space.blob.add,
      originals.blobAdd,
      'space/blob/add leaf was replaced'
    )
    assert.notStrictEqual(
      disabled.upload.add,
      originals.uploadAdd,
      'upload/add leaf was replaced'
    )
  })

  it('non-write leaves on the same tree are NOT replaced (identity-preserved)', () => {
    const service = buildService()
    const reads = {
      blobList: service.space.blob.list,
      uploadList: service.upload.list,
      storeGet: service.store.get,
    }
    const disabled = applyWritesDisabled(service)
    assert.strictEqual(
      disabled.space.blob.list,
      reads.blobList,
      'space/blob/list (read) preserved'
    )
    assert.strictEqual(
      disabled.upload.list,
      reads.uploadList,
      'upload/list (read) preserved'
    )
    assert.strictEqual(
      disabled.store.get,
      reads.storeGet,
      'store/get (read) preserved'
    )
  })

  it('silently skips missing leaves (does not throw, does not introduce them)', () => {
    // Build a service with store/add missing — this is the realistic shape
    // after lib.js strips store/add via destructure-rest.
    const service = buildService()
    // @ts-ignore — intentionally removing a leaf for the test
    delete service.store.add
    assert.doesNotThrow(() => applyWritesDisabled(service))
    assert.equal(
      'add' in service.store,
      false,
      'missing leaf is NOT introduced'
    )
  })

  // For each in-scope write capability, walk to the leaf at WRITE_PATHS[i].path
  // in the disabled service and call it as a function directly. The contract
  // tested here is that the replaced leaf returns out.error.name ===
  // 'ServiceUnavailable' irrespective of nb shape — full end-to-end ucanto
  // dispatch with valid nb is covered by T6's disable-writes.spec.js.
  //
  // We do NOT roundtrip through ucanto's Client.connect here because the
  // client-side @ucanto/validator validates nb synchronously on .invoke(),
  // which would throw before reaching the disabled handler.
  for (const expected of EXPECTED_WRITES) {
    it(`replaced leaf for ${expected.can} returns out.error.name === 'ServiceUnavailable'`, async () => {
      const service = applyWritesDisabled(buildService())
      const entry = WRITE_PATHS.find((e) => e.capability.can === expected.can)
      assert.ok(entry, `WRITE_PATHS contains ${expected.can}`)
      /** @type {any} */
      let leaf = service
      for (const seg of entry.path) leaf = leaf?.[seg]
      assert.equal(
        typeof leaf,
        'function',
        `${expected.can} leaf is a function`
      )
      const result = await leaf(/** @type {any} */ ({}))
      assert.ok(
        result?.error,
        `${expected.can} leaf should return { error }, got: ${JSON.stringify(
          result
        )}`
      )
      assert.equal(
        result.error?.name,
        'ServiceUnavailable',
        `${expected.can} should return ServiceUnavailable`
      )
    })
  }
})

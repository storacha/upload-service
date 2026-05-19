import { printResumeStatus } from '../migrate-view.js'

/**
 * @param {() => void} fn
 */
function captureConsole(fn) {
  const output = []
  const originalLog = console.log

  console.log = (...args) => {
    output.push(args.join(' '))
  }

  try {
    fn()
  } finally {
    console.log = originalLog
  }

  return output.join('\n')
}

/** @type {import('entail').Suite} */
export const testMigrateView = {
  'printResumeStatus derives progress from persisted state inventories': (
    assert
  ) => {
    const spaceDID = /** @type {`did:key:${string}`} */ (
      'did:key:z6MkgMigrateViewState'
    )

    /** @type {import('@storacha/filecoin-pin-migration/types').MigrationState} */
    const state = {
      version: 2,
      phase: 'migrating',
      readerProgressCursors: {},
      spaces: {
        [spaceDID]: {
          did: spaceDID,
          phase: 'migrating',
          copies: [
            {
              copyIndex: 0,
              providerId: 1n,
              serviceProvider: '0x1111111111111111111111111111111111111111',
              providerURL: null,
              dataSetId: null,
              pulled: new Set(['bafy-shard-2']),
              committed: new Set(['bafy-shard-1#bafy-root-1']),
              failedUploads: new Set(['bafy-root-3']),
              storedShards: {},
            },
            {
              copyIndex: 1,
              providerId: 2n,
              serviceProvider: '0x2222222222222222222222222222222222222222',
              providerURL: null,
              dataSetId: null,
              pulled: new Set(),
              committed: new Set(),
              failedUploads: new Set(),
              storedShards: {},
            },
          ],
        },
      },
      spacesInventories: {
        [spaceDID]: {
          did: spaceDID,
          uploads: ['bafy-root-1', 'bafy-root-2'],
          shards: [
            {
              root: 'bafy-root-1',
              cid: 'bafy-shard-1',
              pieceCID: 'bafkz-piece-1',
              sourceURL: 'https://example.invalid/1',
              sizeBytes: 1n,
            },
          ],
          shardsToStore: [
            {
              root: 'bafy-root-2',
              cid: 'bafy-shard-2',
              sourceURL: 'https://example.invalid/2',
              sizeBytes: 1n,
            },
          ],
          skippedUploads: [],
          totalBytes: 2n,
          totalSizeToMigrate: 2n,
        },
      },
    }

    const output = captureConsole(() => {
      printResumeStatus(state, {
        title: 'Existing Migration State',
        showWhenEmpty: true,
      })
    })

    assert.match(output, /Existing Migration State/)
    assert.match(output, /Migration phase/)
    assert.match(output, /Total shards/)
    assert.match(output, /prepared 1\/2/)
    assert.match(output, /committed 1\/2/)
    assert.match(output, /failed uploads 1/)
  },

  'printResumeStatus keeps prepared shards and committed shard-root pairs separate':
    (assert) => {
      const spaceDID = /** @type {`did:key:${string}`} */ (
        'did:key:z6MkgMigrateViewDuplicateRoots'
      )

      /** @type {import('@storacha/filecoin-pin-migration/types').MigrationState} */
      const state = {
        version: 2,
        phase: 'complete',
        readerProgressCursors: {},
        spaces: {
          [spaceDID]: {
            did: spaceDID,
            phase: 'complete',
            copies: [
              {
                copyIndex: 0,
                providerId: 1n,
                serviceProvider: '0x1111111111111111111111111111111111111111',
                providerURL: null,
                dataSetId: 100n,
                pulled: new Set(),
                committed: new Set([
                  'bafy-shard-1#bafy-root-a',
                  'bafy-shard-1#bafy-root-b',
                ]),
                failedUploads: new Set(),
                storedShards: {
                  'bafy-shard-1': 'bafkz-piece-1',
                },
              },
              {
                copyIndex: 1,
                providerId: 2n,
                serviceProvider: '0x2222222222222222222222222222222222222222',
                providerURL: null,
                dataSetId: 200n,
                pulled: new Set(),
                committed: new Set(),
                failedUploads: new Set(),
                storedShards: {},
              },
            ],
          },
        },
        spacesInventories: {
          [spaceDID]: {
            did: spaceDID,
            uploads: ['bafy-root-a', 'bafy-root-b'],
            shards: [
              {
                root: 'bafy-root-a',
                cid: 'bafy-shard-1',
                pieceCID: 'bafkz-piece-1',
                sourceURL: 'https://example.invalid/a',
                sizeBytes: 1n,
              },
              {
                root: 'bafy-root-b',
                cid: 'bafy-shard-1',
                pieceCID: 'bafkz-piece-1',
                sourceURL: 'https://example.invalid/b',
                sizeBytes: 1n,
              },
            ],
            shardsToStore: [],
            skippedUploads: [],
            totalBytes: 2n,
            totalSizeToMigrate: 2n,
          },
        },
      }

      const output = captureConsole(() => {
        printResumeStatus(state, {
          title: 'Existing Migration State (Completed)',
          showWhenEmpty: true,
        })
      })

      assert.match(output, /Total shards/)
      assert.match(output, /Total shards/)
      assert.match(output, /prepared 1\/1/)
      assert.match(output, /committed 2\/2/)
      assert.ok(!/prepared 3\/2/.test(output))
    },

  'printResumeStatus requires a store for summary-only runtime state': (
    assert
  ) => {
    const spaceDID = /** @type {`did:key:${string}`} */ (
      'did:key:z6MkgMigrateViewSummaryOnly'
    )

    /** @type {import('@storacha/filecoin-pin-migration/types').MigrationState} */
    const state = {
      version: 2,
      phase: 'migrating',
      readerProgressCursors: {},
      spaces: {
        [spaceDID]: {
          did: spaceDID,
          phase: 'migrating',
          copies: [
            {
              copyIndex: 0,
              providerId: 1n,
              serviceProvider: '0x1111111111111111111111111111111111111111',
              providerURL: null,
              dataSetId: null,
              pulled: new Set(),
              committed: new Set(),
              failedUploads: new Set(),
              storedShards: {},
            },
            {
              copyIndex: 1,
              providerId: 2n,
              serviceProvider: '0x2222222222222222222222222222222222222222',
              providerURL: null,
              dataSetId: null,
              pulled: new Set(),
              committed: new Set(),
              failedUploads: new Set(),
              storedShards: {},
            },
          ],
        },
      },
      spaceMigrationInventories: {
        [spaceDID]: {
          did: spaceDID,
          uploadsCount: 1,
          skippedUploadsCount: 0,
          shardsCount: 1,
          shardsToStoreCount: 1,
          totalBytes: 2n,
          totalSizeToMigrate: 2n,
        },
      },
      spacesInventories: {},
    }

    assert.throws(
      () =>
        printResumeStatus(state, {
          title: 'Summary Only',
          showWhenEmpty: true,
        }),
      /summary-only runtime states require a MigrationStore/
    )
  },
}

import ora from 'ora'
import { buildMigrationInventories } from '@storacha/filecoin-pin-migration'
import { formatReaderOverrideEntries } from '../options.js'
import { formatBytes, formatDuration, truncateDID } from '../view/format.js'
import { printPhaseTitle } from '../view/phase.js'
import { printReaderShardFailed } from '../view/reader.js'

/**
 * @param {object} args
 * @param {import('@storacha/client').Client} args.client
 * @param {import('@storacha/filecoin-pin-migration/types').SourceURLResolver} args.resolver
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationStore} args.store
 * @param {string[]} [args.spaceDIDs]
 * @param {import('@storacha/filecoin-pin-migration/types').UploadRootsBySpace} [args.uploadRootsBySpace]
 * @param {import('@storacha/filecoin-pin-migration/types').BuildInventoriesInput['options']} [args.readerOptions]
 * @param {Array<[string, number | boolean]>} [args.readerOverrideEntries]
 * @param {() => boolean} [args.isStopRequested]
 * @param {() => Promise<void>} args.persistCheckpoint
 * @param {AbortSignal} args.signal
 */
export async function readInventories({
  client,
  resolver,
  store,
  spaceDIDs,
  uploadRootsBySpace,
  readerOptions,
  readerOverrideEntries,
  isStopRequested,
  persistCheckpoint,
  signal,
}) {
  printPhaseTitle('Scanning Space')
  if (readerOverrideEntries && readerOverrideEntries.length > 0) {
    console.log(
      `Advanced reader overrides: ${formatReaderOverrideEntries(
        readerOverrideEntries
      )}`
    )
  }
  const spinner = ora({
    text: 'Reading inventories...',
    color: 'cyan',
  }).start()

  /** @type {import('@storacha/filecoin-pin-migration/types').BuildInventoriesInput} */
  const readerInput = uploadRootsBySpace
    ? {
        client,
        resolver,
        store,
        uploadRootsBySpace,
        signal,
        options: readerOptions,
      }
    : {
        client,
        resolver,
        store,
        spaceDIDs: /** @type {`did:key:${string}`[]} */ (spaceDIDs),
        signal,
        options: readerOptions,
      }

  const startedAt = Date.now()
  /** @type {NodeJS.Timeout | undefined} */
  let spaceElapsedTimer
  /** @type {string | undefined} */
  let activeSpaceDID
  /** @type {number | undefined} */
  let activeSpaceStartedAt

  const clearSpaceElapsedTimer = () => {
    if (!spaceElapsedTimer) return
    clearInterval(spaceElapsedTimer)
    spaceElapsedTimer = undefined
  }

  const renderActiveSpaceText = () => {
    if (!activeSpaceDID || activeSpaceStartedAt == null) {
      spinner.text = 'Reading inventories...'
      return
    }

    spinner.text = `Reading space ${truncateDID(activeSpaceDID)} (${formatDuration(
      Date.now() - activeSpaceStartedAt
    )})`
  }

  for await (const event of buildMigrationInventories(readerInput)) {
    switch (event.type) {
      case 'reader:space:start':
        clearSpaceElapsedTimer()
        activeSpaceDID = event.spaceDID
        activeSpaceStartedAt = Date.now()
        renderActiveSpaceText()
        spaceElapsedTimer = setInterval(renderActiveSpaceText, 60_000)
        break
      case 'reader:space:complete': {
        clearSpaceElapsedTimer()
        const inventorySummary = store.getSpaceInventorySummary(event.spaceDID)
        if (!inventorySummary) {
          spinner.fail(
            `Reader completed space ${truncateDID(event.spaceDID)} without an inventory result`
          )
          throw new Error(
            `reader:space:complete emitted for ${event.spaceDID} before inventory was recorded`
          )
        }
        spinner.stopAndPersist({
          symbol: '✔',
          text: ` Completed ${inventorySummary.uploadsCount} uploads, ${
            inventorySummary.shardsCount
          } shards, ${
            inventorySummary.skippedUploadsCount
          } skipped uploads, ${formatBytes(inventorySummary.totalBytes)}`,
        })
        activeSpaceDID = undefined
        activeSpaceStartedAt = undefined
        spinner.start('Reading inventories...')
        break
      }
      case 'reader:shard:failed':
        spinner.stop()
        printReaderShardFailed(
          event.root,
          event.shard,
          event.reason.split(':')[0]
        )
        spinner.start()
        renderActiveSpaceText()
        break
      case 'state:checkpoint':
        await persistCheckpoint()
        if (isStopRequested?.()) {
          clearSpaceElapsedTimer()
          spinner.stop()
          return { interrupted: true }
        }
        break
    }

    if (signal.aborted) {
      clearSpaceElapsedTimer()
      spinner.stop()
      await persistCheckpoint()
      return { interrupted: true }
    }
  }

  clearSpaceElapsedTimer()

  if (signal.aborted) {
    spinner.stop()
    await persistCheckpoint()
    return { interrupted: true }
  }

  spinner.succeed(
    `Inventories ready (${formatDuration(Date.now() - startedAt)})`
  )
  return { interrupted: signal.aborted }
}

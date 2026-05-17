import { parseMigrationOptions } from '../migrate/options.js'

/** @type {import('entail').Suite} */
export const testMigrationOptions = {
  'parseMigrationOptions preserves selected roots and non-interactive flags': (
    assert
  ) => {
    const options = parseMigrationOptions({
      selectedRootsFile: '/tmp/selected-roots.ndjson',
      nonInteractive: true,
    })

    assert.equal(
      options.selectedRootsFile,
      '/tmp/selected-roots.ndjson',
      'selected roots path is preserved'
    )
    assert.equal(
      options.nonInteractive,
      true,
      'nonInteractive flag is preserved'
    )
  },
}

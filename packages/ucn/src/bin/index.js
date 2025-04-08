#!/usr/bin/env node

import sade from 'sade'

const cli = sade('ucn')

cli.version('1.0.0')

cli
  .command('whoami')
  .describe('Print your agent DID.')
  .action(async () => {
    const { handler } = await import('./cmd/whoami.js')
    await handler()
  })

cli
  .command('create')
  .describe('Create a new name.')
  .action(async () => {
    const { handler } = await import('./cmd/create.js')
    await handler()
  })

cli
  .command('update <name> <value>')
  .alias('u')
  .describe('Update the value for a name and publish to the network.')
  .action(async (name, value) => {
    const { handler } = await import('./cmd/update.js')
    await handler(name, value)
  })

cli
  .command('resolve <name>')
  .alias('r')
  .describe('Resolve the current value for the name.')
  .option(
    '-l, --local',
    'Resolve the current value using local data only.',
    false
  )
  .action(async (name, options) => {
    const { handler } = await import('./cmd/resolve.js')
    await handler(name, options)
  })

cli
  .command('ls')
  .alias('list')
  .describe('List names.')
  .option('-l', 'List names in long format.', false)
  .action(async (options) => {
    const { handler } = await import('./cmd/list.js')
    await handler(options)
  })

cli
  .command('rm <name>')
  .alias('remove')
  .describe('Remove a name.')
  .action(async (name) => {
    const { handler } = await import('./cmd/remove.js')
    await handler(name)
  })

cli
  .command('grant <name> <recipient>')
  .describe('Grant access to a name.')
  .option('-r, --read-only', 'Grant read only access.', false)
  .action(async (name, recipient, options) => {
    const { handler } = await import('./cmd/grant.js')
    await handler(name, recipient, options)
  })

cli
  .command('import <proof>')
  .describe('Add an existing name.')
  .action(async (proof) => {
    const { handler } = await import('./cmd/import.js')
    await handler(proof)
  })

cli.parse(process.argv)

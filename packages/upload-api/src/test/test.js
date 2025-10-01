import * as assert from 'assert'
import { cleanupContext, createContext } from './helpers/context.js'
import * as http from 'node:http'
import * as API from './types.js'

/**
 * @param {API.Tests|Record<string, API.Tests>} suite
 * @param {Omit<Parameters<typeof createContext>[0], 'http' | 'assert'>} [options]
 */
export const test = (suite, options = {}) => {
  for (const [name, member] of Object.entries(suite)) {
    if (typeof member === 'function') {
      const define = name.startsWith('only ')
        ? it.only
        : name.startsWith('skip ')
        ? it.skip
        : it

      define(name, async () => {
        const context = await createContext({ ...options, http, assert })
        try {
          await member(assert, context)
        } finally {
          await cleanupContext(context)
        }
      })
    } else {
      describe(name, () => test(member, options))
    }
  }
}

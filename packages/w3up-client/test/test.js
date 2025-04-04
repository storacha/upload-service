import { StoreMemory } from '@storacha/access/stores/store-memory'
import * as Context from '@storacha/upload-api/test/context'
import * as Client from '@storacha/client'
import * as assert from 'assert'
import { receiptsEndpoint } from './helpers/utils.js'

/**
 * @template [Context=void]
 * @typedef {(assert: Assert, context: Context) => unknown} Unit
 */
/**
 * @template [Context=undefined]
 * @typedef {object} Setup
 * @property {() => Context|PromiseLike<Context>} [before]
 * @property {() => PromiseLike<unknown>|unknown} [after]
 */

/**
 * @template [Context=undefined]
 * @typedef {{[name:string]: Unit<Context>|Suite<Context>}} Suite
 */

/**
 * @template Context
 * @param {object} descriptor
 * @param {(assert: Assert) => PromiseLike<Context>} descriptor.before
 * @param {(context: Context) => unknown} descriptor.after
 * @returns {(suite: Suite<Context>) => Suite}
 */

export const group =
  ({ before, after }) =>
  (suite) => {
    return Object.fromEntries(
      Object.entries(suite).map(([key, test]) => [
        key,
        typeof test === 'function'
          ? async (assert) => {
              const context = await before(assert)
              try {
                await test(assert, context)
              } finally {
                await after(context)
              }
            }
          : group({ before, after })(test),
      ])
    )
  }

/**
 * @typedef {Omit<typeof assert, 'ok'> & {ok(value:unknown, message?:string):void}} Assert
 */

/**
 * @param {Suite<void>|Record<string, Suite>} suite
 */
export const test = (suite) => {
  for (const [name, member] of Object.entries(suite)) {
    if (typeof member === 'function') {
      const define = name.startsWith('only ')
        ? it.only
        : name.startsWith('skip ')
        ? it.skip
        : it

      define(name, () => member(assert))
    } else {
      describe(name, () => test(member))
    }
  }
}

/**
 * @returns {(
 *   Promise<
 *     import('@storacha/upload-api/types').UcantoServerTestContext
 *     & {
 *       connect: () => Promise<import('@storacha/client').Client>
 *       client: import('@storacha/client').Client
 *       cleanup: () => void
 *     }
 *   >
 * )}
 */
export const setup = async () => {
  /** @type {import('@storacha/upload-api/types').UcantoServerTestContext} */
  const context = await Context.createContext({
    assert,
  })

  const connect = () =>
    Client.create({
      store: new StoreMemory(),
      serviceConf: {
        access: context.connection,
        upload: context.connection,
        filecoin: context.connection,
        gateway: context.connection,
      },
      receiptsEndpoint: new URL(receiptsEndpoint),
    })

  return {
    ...context,
    connect,
    client: await connect(),
    cleanup: () => Context.cleanupContext(context),
  }
}

export const withContext = group({
  before: setup,
  after: (context) => Context.cleanupContext(context),
})

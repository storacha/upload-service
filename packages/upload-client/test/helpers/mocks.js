import * as Server from '@ucanto/server'

const notImplemented = () => {
  throw new Server.Failure('not implemented')
}

/**
 * @param {Partial<{
 *   ucan: Partial<import('../../src/types.js').Service['ucan']>
 *   space: Partial<{
 *    blob: Partial<import('../../src/types.js').Service['space']['blob']>
 *    index: Partial<import('../../src/types.js').Service['space']['index']>
 *   }>
 *   upload: Partial<import('../../src/types.js').Service['upload']>
 *   usage: Partial<import('../../src/types.js').Service['usage']>
 *   filecoin: Partial<import('@storacha/filecoin-client/storefront').StorefrontService['filecoin']>
 * }>} impl
 */
export function mockService(impl) {
  const get = impl.space?.blob?.get
  return {
    ucan: {
      conclude: withCallCount(impl.ucan?.conclude ?? notImplemented),
    },
    space: {
      blob: {
        add: withCallCount(impl.space?.blob?.add ?? notImplemented),
        list: withCallCount(impl.space?.blob?.list ?? notImplemented),
        remove: withCallCount(impl.space?.blob?.remove ?? notImplemented),
        get: {
          0: {
            1: withCallCount(get ? get[0][1] : notImplemented),
          },
        },
        replicate: withCallCount(impl.space?.blob?.replicate ?? notImplemented),
      },
      index: {
        add: withCallCount(impl.space?.index?.add ?? notImplemented),
      },
    },
    upload: {
      add: withCallCount(impl.upload?.add ?? notImplemented),
      get: withCallCount(impl.upload?.get ?? notImplemented),
      list: withCallCount(impl.upload?.list ?? notImplemented),
      remove: withCallCount(impl.upload?.remove ?? notImplemented),
    },
    usage: {
      report: withCallCount(impl.usage?.report ?? notImplemented),
    },
    filecoin: {
      offer: withCallCount(impl.filecoin?.offer ?? notImplemented),
      submit: withCallCount(impl.filecoin?.submit ?? notImplemented),
      accept: withCallCount(impl.filecoin?.accept ?? notImplemented),
      info: withCallCount(impl.filecoin?.info ?? notImplemented),
    },
  }
}

/**
 * @template {Function} T
 * @param {T} fn
 */
function withCallCount(fn) {
  /** @param {T extends (...args: infer A) => any ? A : never} args */
  const countedFn = (...args) => {
    countedFn.called = true
    countedFn.callCount++
    return fn(...args)
  }
  countedFn.called = false
  countedFn.callCount = 0
  return countedFn
}

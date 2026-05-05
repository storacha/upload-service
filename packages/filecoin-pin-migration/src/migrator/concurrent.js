import { isAbortError } from '../utils.js'

/**
 * Stream async task results with bounded concurrency in completion order.
 * This keeps progress and failures responsive without holding later settled
 * work behind slower earlier items.
 *
 * @template TItem
 * @template TResult
 * @param {object} args
 * @param {Iterable<TItem>} args.items
 * @param {number} args.concurrency
 * @param {AbortSignal | undefined} args.signal
 * @param {(item: TItem) => Promise<TResult>} args.run
 * @returns {AsyncGenerator<TResult, { aborted: boolean }, void>}
 */
export async function* streamConcurrentTasks({
  items,
  concurrency,
  signal,
  run,
}) {
  /** @type {Iterator<TItem>} */
  const iterator = items[Symbol.iterator]()
  /** @type {Set<Promise<SettledTask<TResult>>>} */
  const inFlight = new Set()
  /** @type {unknown} */
  let fatalError
  let aborted = false
  const workerCount = Math.max(1, concurrency)

  /**
   * @returns {{ done: true } | { done: false, item: TItem }}
   */
  function takeNext() {
    if (aborted || fatalError || signal?.aborted) {
      aborted = true
      return { done: true }
    }

    const next = iterator.next()
    if (next.done) return { done: true }
    return { done: false, item: next.value }
  }

  /**
   * @returns {boolean}
   */
  function launchNext() {
    const next = takeNext()
    if (next.done) return false

    /** @type {Promise<SettledTask<TResult>>} */
    let promise
    promise = run(next.item).then(
      (result) =>
        /** @type {SettledTask<TResult>} */ ({
          promise,
          status: 'fulfilled',
          result,
        }),
      (error) =>
        /** @type {SettledTask<TResult>} */ ({
          promise,
          status: 'rejected',
          error,
        })
    )
    inFlight.add(promise)

    return true
  }

  function fillWorkers() {
    while (inFlight.size < workerCount && launchNext()) {
      // keep the worker pool full until we run out of items or abort
    }
  }

  fillWorkers()

  while (inFlight.size > 0) {
    const task = await Promise.race(inFlight)
    inFlight.delete(task.promise)

    if (task.status === 'rejected') {
      if (signal?.aborted || isAbortError(task.error)) {
        aborted = true
      } else {
        fatalError = task.error
      }
    } else if (!fatalError) {
      yield task.result
    }

    if (!aborted && !fatalError) {
      fillWorkers()
    }
  }

  if (fatalError) throw fatalError

  return { aborted: aborted || !!signal?.aborted }
}

/**
 * Drain a concurrent task stream while preserving its explicit aborted return
 * contract. This keeps call sites focused on per-result handling instead of
 * open-coding the iterator protocol.
 *
 * @template TResult
 * @template TYield
 * @param {AsyncGenerator<TResult, { aborted: boolean }, void>} stream
 * @param {(result: TResult) => Iterable<TYield> | AsyncIterable<TYield>} onResult
 * @returns {AsyncGenerator<TYield, { aborted: boolean }, void>}
 */
export async function* drainConcurrentStream(stream, onResult) {
  let next = await stream.next()

  while (!next.done) {
    yield* onResult(next.value)
    next = await stream.next()
  }

  return next.value
}

/**
 * Run async tasks with bounded concurrency while preserving already completed
 * results when an abort happens mid-flight.
 *
 * @template TItem
 * @template TResult
 * @param {object} args
 * @param {Iterable<TItem>} args.items
 * @param {number} args.concurrency
 * @param {AbortSignal | undefined} args.signal
 * @param {(item: TItem) => Promise<TResult>} args.run
 * @returns {Promise<{ aborted: boolean, results: TResult[] }>}
 */
export async function runConcurrentTasks(args) {
  const stream = streamConcurrentTasks(args)
  /** @type {TResult[]} */
  const results = []
  let next = await stream.next()

  while (!next.done) {
    results.push(next.value)
    next = await stream.next()
  }

  return {
    aborted: next.value.aborted,
    results,
  }
}

/**
 * @template TResult
 * @typedef {{
 *   promise: Promise<SettledTask<TResult>>
 *   status: 'fulfilled'
 *   result: TResult
 * } | {
 *   promise: Promise<SettledTask<TResult>>
 *   status: 'rejected'
 *   error: unknown
 * }} SettledTask
 */

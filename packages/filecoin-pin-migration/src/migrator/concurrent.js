import { isAbortError } from '../utils.js'

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
 */
export async function runConcurrentTasks({ items, concurrency, signal, run }) {
  /** @type {Iterator<TItem>} */
  const iterator = items[Symbol.iterator]()
  /** @type {Array<{ index: number, result: TResult }>} */
  const completed = []
  /** @type {unknown} */
  let fatalError
  let aborted = false
  let nextIndex = 0

  /**
   * @returns {{ done: true } | { done: false, item: TItem, index: number }}
   */
  function takeNext() {
    if (aborted || fatalError || signal?.aborted) {
      aborted = true
      return { done: true }
    }

    const next = iterator.next()
    if (next.done) return { done: true }

    const index = nextIndex
    nextIndex += 1
    return { done: false, item: next.value, index }
  }

  async function worker() {
    for (let next = takeNext(); !next.done; next = takeNext()) {
      try {
        const result = await run(next.item)
        completed.push({ index: next.index, result })
      } catch (error) {
        if (signal?.aborted || isAbortError(error)) {
          aborted = true
          return
        }
        fatalError = error
        return
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }, () => worker())
  )

  if (fatalError) throw fatalError

  completed.sort((a, b) => a.index - b.index)

  return {
    aborted: aborted || !!signal?.aborted,
    results: completed.map((entry) => entry.result),
  }
}

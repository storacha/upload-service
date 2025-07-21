/**
 * @template T
 * @param {ReadableStream<T>} stream
 */
export const collect = async (stream) => {
  /** @type {T[]} */
  const chunks = []
  await stream.pipeTo(
    new WritableStream({
      write(chunk) {
        chunks.push(chunk)
      },
    })
  )
  return chunks
}

/**
 * @template T
 * @param {Iterable<T>} iter
 */
export const from = (iter) => {
  const chunks = [...iter]
  return /** @type {ReadableStream<T>} */ (
    new ReadableStream({
      pull(controller) {
        const c = chunks.shift()
        if (!c) return controller.close()
        controller.enqueue(c)
      },
    })
  )
}

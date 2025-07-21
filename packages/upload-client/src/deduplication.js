/** @import { Block } from '@ipld/unixfs' */

/** @extends {TransformStream<Block, Block>} */
export class BlockDeduplicationStream extends TransformStream {
  constructor() {
    /** @type {Set<string>} */
    const seen = new Set()
    super({
      transform(block, controller) {
        const key = block.cid.toString()
        if (seen.has(key)) return
        seen.add(key)
        controller.enqueue(block)
      },
      flush() {
        seen.clear()
      },
    })
  }
}

/**
 * @param {Iterable<Block>} blocks
 * @returns {IterableIterator<Block>}
 */
export const dedupe = function* (blocks) {
  /** @type {Set<string>} */
  const seen = new Set()
  for (const b of blocks) {
    const key = b.cid.toString()
    if (seen.has(key)) continue
    seen.add(key)
    yield b
  }
}

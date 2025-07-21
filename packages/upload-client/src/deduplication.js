/** @import { Block } from '@ipld/unixfs' */

/** @extends {TransformStream<Block, Block>} */
export class BlockDeduplicationStream extends TransformStream {
  constructor() {
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

/** @param {Iterable<Block>} blocks */
export const dedupe = (blocks) => {
  const seen = new Set()
  const deduped = []
  for (const b of blocks) {
    const key = b.cid.toString()
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(b)
  }
  return deduped
}

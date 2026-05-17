import { readFile } from 'node:fs/promises'

/**
 * Load a JSON file containing an array of trusted upload root CID strings for
 * the current selected space.
 *
 * Expected file format:
 * ```json
 * [
 *   "bafy...",
 *   "bafy..."
 * ]
 * ```
 *
 * @param {object} input
 * @param {string} input.filePath
 * @param {import('../api.js').SpaceDID} input.spaceDID
 * @returns {Promise<import('../api.js').UploadRootsBySpace>}
 */
export async function loadSelectedRootsFile({ filePath, spaceDID }) {
  /** @type {unknown} */
  let parsed

  try {
    parsed = JSON.parse(await readFile(filePath, 'utf8'))
  } catch {
    throw new TypeError(
      `loadSelectedRootsFile: invalid JSON array in ${filePath}`
    )
  }

  if (!Array.isArray(parsed)) {
    throw new TypeError(
      `loadSelectedRootsFile: expected a JSON array of root CID strings in ${filePath}`
    )
  }

  if (parsed.length === 0) {
    throw new TypeError(
      `loadSelectedRootsFile: selected roots file is empty: ${filePath}`
    )
  }

  /** @type {string[]} */
  const roots = []
  const seenRoots = new Set()

  for (let index = 0; index < parsed.length; index += 1) {
    const root = parsed[index]
    const itemNumber = index + 1

    if (typeof root !== 'string' || root === '') {
      throw new TypeError(
        `loadSelectedRootsFile: expected a non-empty root CID string at ${filePath}[${itemNumber}]`
      )
    }

    if (seenRoots.has(root)) {
      throw new TypeError(
        `loadSelectedRootsFile: duplicate root "${root}" at ${filePath}[${itemNumber}]`
      )
    }

    seenRoots.add(root)
    roots.push(root)
  }

  return {
    [spaceDID]: roots,
  }
}

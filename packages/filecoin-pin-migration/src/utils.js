import { Piece } from '@web3-storage/data-segment'

/**
 * @import { PieceCID } from '@filoz/synapse-sdk'
 */

/**
 * Yields batches lazily without allocating them upfront.
 *
 * @template T
 * @param {T[]} arr
 * @param {number} size
 * @returns {Generator<T[]>}
 */
export function* batches(arr, size) {
  for (let i = 0; i < arr.length; i += size) {
    yield arr.slice(i, i + size)
  }
}

/**
 * Convert a pieceCID string to the SDK's typed PieceCID at the SDK boundary.
 *
 * @param {string} str
 * @returns {PieceCID}
 */
export function toPieceCID(str) {
  return Piece.fromString(str).link
}

/**
 * Best-effort abort detection for APIs that may throw DOMException,
 * AbortError-like objects, or plain Errors with the standard message.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
export function isAbortError(error) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  ) {
    return true
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message === 'This operation was aborted'
  }

  return false
}

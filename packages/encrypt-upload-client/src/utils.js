/**
 *
 * @param {string} str
 * @returns {Uint8Array}
 */
export function stringToBytes(str) {
  return new TextEncoder().encode(str)
}

/**
 *
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function bytesToString(bytes) {
  return new TextDecoder().decode(bytes)
}

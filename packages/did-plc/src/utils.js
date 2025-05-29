import { fetch } from 'cross-fetch'

/**
 * Universal fetch helper for Node and browser
 * 
 * @see https://github.com/lifaon76/cross-fetch
 * 
 * @param {RequestInfo} input
 * @param {RequestInit=} init
 * @returns {Promise<Response>}
 */
export async function universalFetch(input, init) {
  return fetch(input, init)
} 
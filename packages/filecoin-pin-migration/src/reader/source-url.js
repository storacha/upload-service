/**
 * @import * as API from '../api.js'
 */

const DEFAULT_ROUNDABOUT_URL = 'https://roundabout.web3.storage'

/**
 * Builds source URLs from shard pieceCID via the roundabout service.
 * No network calls — purely URL construction.
 *
 * @implements {API.SourceURLResolver}
 */
export class RoundaboutResolver {
  #baseURL

  /** @param {string} [baseURL] */
  constructor(baseURL = DEFAULT_ROUNDABOUT_URL) {
    this.#baseURL = baseURL.replace(/\/$/, '')
  }

  /** @param {API.ResolvedShard} shard */
  resolve(shard) {
    return `${this.#baseURL}/piece/${shard.pieceCID}`
  }
}

/**
 * Passes through the location URL already resolved by the reader.
 * No network calls — returns shard.sourceURL as-is.
 *
 * @implements {API.SourceURLResolver}
 */
export class ClaimsResolver {
  /** @param {API.ResolvedShard} shard */
  resolve(shard) {
    return shard.sourceURL
  }
}

/**
 * Create a SourceURLResolver from a strategy name.
 *
 * @param {{ strategy: 'roundabout' | 'claims', roundaboutURL?: string }} options
 * @returns {API.SourceURLResolver}
 */
export function createResolver({ strategy, roundaboutURL }) {
  if (strategy === 'claims') {
    return new ClaimsResolver()
  }
  return new RoundaboutResolver(roundaboutURL)
}

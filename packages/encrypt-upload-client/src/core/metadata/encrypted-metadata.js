/**
 * Universal Encrypted Metadata Orchestrator
 * Routes between different encryption strategies (Lit, KMS, etc.)
 * Each network gets its own version
 */

import * as LitMetadata from './lit-metadata.js'
import * as KMSMetadata from './kms-metadata.js'
import { CAR, error } from '@ucanto/core'
import * as dagCBOR from '@ipld/dag-cbor'
import { UnknownFormat } from '../errors.js'

const FORMATS = {
  [LitMetadata.version]: LitMetadata,   // 'encrypted-metadata@0.1' 
  [KMSMetadata.version]: KMSMetadata,   // 'encrypted-metadata@0.2'
}

/**
 * Universal extract function - tries each registered format
 *
 * @param {Uint8Array} archive
 * @returns {any}
 */
export const extract = (archive) => {
  // Decode CAR to check version
  const { roots } = CAR.decode(archive)
  
  if (!roots.length) {
    return error(new UnknownFormat('missing root block'))
  }

  const { code } = roots[0].cid
  if (code !== dagCBOR.code) {
    return error(
      new UnknownFormat(`unexpected root CID codec: 0x${code.toString(16)}`)
    )
  }

  // Check which version this metadata uses
  const value = dagCBOR.decode(roots[0].bytes)
  
  for (const [version, formatModule] of Object.entries(FORMATS)) {
    if (value && typeof value === 'object' && version in value) {
      // Found matching version, delegate to specific format module
      return formatModule.extract(archive)
    }
  }
  
  return error(new UnknownFormat('Unknown metadata format - no matching version found'))
}

/**
 * Create metadata for specific strategy
 *
 * @param {'lit' | 'kms'} strategy 
 * @param {any} data
 */
export const create = (strategy, data) => {
  switch (strategy) {
    case 'lit':
      return LitMetadata.create(data)
    case 'kms': 
      return KMSMetadata.create(data)
    default:
      throw new Error(`Unknown encryption strategy: ${strategy}`)
  }
}

/**
 * Get available format versions
 */
export const getSupportedVersions = () => Object.keys(FORMATS)

/**
 * Check if a version is supported
 *
 * @param {string} version 
 */
export const isVersionSupported = (version) => version in FORMATS

// Re-export format modules for direct access if needed
export { LitMetadata, KMSMetadata }

import * as Type from '../types.js'
import { Schema } from '@ucanto/core'

const METADATA_HEADER_SIZE = 1024
const MAX_JSON_DEPTH = 5
const MAX_JSON_OBJECTS = 20
const MAX_FIELD_LENGTH = 200
const MAX_CUSTOM_METADATA_SIZE = 10000

// Schema for file metadata validation
export const FileMetadataSchema = Schema.struct({
  name: Schema.string(),
  type: Schema.string(),
  extension: Schema.string(),
  metadata: Schema.optional(Schema.unknown()),
})

/**
 * Embed file metadata in a fixed-size header at the beginning of file content
 *
 * @param {Type.BlobLike} file - The file to embed metadata in
 * @param {Type.FileMetadata} [metadata] - Optional file metadata
 * @returns {Blob} File with embedded metadata header
 */
export const createFileWithMetadata = (file, metadata) => {
  if (metadata === undefined) {
    // No metadata - just return original file as Blob
    if (file instanceof Blob) {
      return file
    }
    // Handle known BlobLike types that are valid BlobParts
    if (file instanceof Uint8Array || file instanceof ArrayBuffer) {
      return new Blob([file])
    }
    throw new Error(
      'Unsupported BlobLike type - must be Blob, Uint8Array, or ArrayBuffer'
    )
  }

  // Validate and serialize metadata
  validateMetadataStructure(metadata)
  const metadataJson = JSON.stringify(metadata)
  const metadataBytes = new TextEncoder().encode(metadataJson)

  if (metadataBytes.length > METADATA_HEADER_SIZE - 4) {
    throw new Error(
      `Metadata too large: ${metadataBytes.length} bytes (max ${
        METADATA_HEADER_SIZE - 4
      })`
    )
  }

  // Create fixed-size header: [4 bytes length][metadata][padding]
  const header = new Uint8Array(METADATA_HEADER_SIZE)
  const lengthBytes = new Uint8Array(
    new Uint32Array([metadataBytes.length]).buffer
  )

  header.set(lengthBytes, 0) // First 4 bytes = length
  header.set(metadataBytes, 4) // Metadata starts at byte 4
  // Rest remains zero-filled

  let originalFile
  if (file instanceof Blob) {
    originalFile = file
  } else if (file instanceof Uint8Array || file instanceof ArrayBuffer) {
    originalFile = new Blob([file])
  } else {
    throw new Error(
      'Unsupported BlobLike type - must be Blob, Uint8Array, or ArrayBuffer'
    )
  }
  return new Blob([header, originalFile])
}

/**
 * Extract file metadata from encrypted file stream
 *
 * @param {ReadableStream} decryptedStream - The decrypted file stream
 * @returns {Promise<{fileStream: ReadableStream, fileMetadata?: Type.FileMetadata}>}
 */
export const extractFileMetadata = async (decryptedStream) => {
  const reader = decryptedStream.getReader()

  try {
    // Read fixed-size header
    const { bytes: header, remainder } = await readExactBytes(
      reader,
      METADATA_HEADER_SIZE
    )
    if (!header) {
      return { fileStream: createStreamFromReader(reader) }
    }

    // Read metadata length from first 4 bytes
    const lengthView = new DataView(header.buffer, 0, 4)
    const metadataLength = lengthView.getUint32(0, true)

    // Validate length
    if (metadataLength < 0 || metadataLength > METADATA_HEADER_SIZE - 4) {
      throw new Error('Invalid metadata length')
    }

    let fileMetadata = undefined
    if (metadataLength > 0) {
      // Extract and parse metadata
      const metadataBytes = header.slice(4, 4 + metadataLength)
      const metadataJson = new TextDecoder('utf-8', { fatal: true }).decode(
        metadataBytes
      )
      fileMetadata = secureJsonParse(metadataJson)
      validateMetadataStructure(fileMetadata)
    }

    // Create file stream (header is consumed, continue with rest)
    // Include any remainder bytes from the header read first
    let remainderEnqueued = false
    const fileStream = new ReadableStream({
      async pull(controller) {
        // First, enqueue any remainder bytes from header read
        if (!remainderEnqueued && remainder) {
          controller.enqueue(remainder)
          remainderEnqueued = true
          return
        }

        // Then continue with the reader
        const { done, value } = await reader.read()
        if (done) {
          controller.close()
        } else {
          controller.enqueue(value)
        }
      },
    })

    return { fileStream, fileMetadata }
  } catch (error) {
    console.warn('Metadata extraction failed:', error)
    return { fileStream: createStreamFromReader(reader) }
  }
}

/**
 * Read exact number of bytes from a stream reader
 *
 * @param {ReadableStreamDefaultReader} reader - Stream reader
 * @param {number} size - Number of bytes to read
 * @returns {Promise<{bytes: Uint8Array|null, remainder: Uint8Array|null}>} The bytes and any remainder
 */
async function readExactBytes(reader, size) {
  const chunks = []
  let totalRead = 0

  while (totalRead < size) {
    const { done, value } = await reader.read()

    if (done) {
      return { bytes: null, remainder: null } // Not enough data
    }

    chunks.push(value)
    totalRead += value.length
  }

  // Combine chunks and extract exact size
  const combined = new Uint8Array(totalRead)
  let offset = 0

  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.length
  }

  const bytes = combined.slice(0, size)
  const remainder = totalRead > size ? combined.slice(size) : null

  return { bytes, remainder }
}

/**
 * Parse JSON with security validations
 *
 * @param {string} jsonString - JSON string to parse
 * @returns {Type.FileMetadata} Parsed metadata
 */
function secureJsonParse(jsonString) {
  // Validate JSON structure before parsing
  if (jsonString.length > 800) {
    // Leave room for encoding overhead
    throw new Error('JSON too large')
  }

  // Check nesting depth
  const depth = calculateJsonDepth(jsonString)
  if (depth > MAX_JSON_DEPTH) {
    throw new Error('JSON too deeply nested')
  }

  // Check object count
  const objectCount = (jsonString.match(/[{[]/g) || []).length
  if (objectCount > MAX_JSON_OBJECTS) {
    throw new Error('Too many JSON objects')
  }

  return JSON.parse(jsonString)
}

/**
 * Calculate maximum nesting depth of JSON string
 *
 * @param {string} jsonString - JSON string
 * @returns {number} Maximum depth
 */
function calculateJsonDepth(jsonString) {
  let depth = 0
  let maxDepth = 0

  for (const char of jsonString) {
    if (char === '{' || char === '[') {
      depth++
      maxDepth = Math.max(maxDepth, depth)
    } else if (char === '}' || char === ']') {
      depth--
    }
  }

  return maxDepth
}

/**
 * Validate file metadata structure using schema
 *
 * @param {Type.FileMetadata} metadata - Metadata to validate
 */
function validateMetadataStructure(metadata) {
  if (!FileMetadataSchema.is(metadata)) {
    throw new Error('Invalid metadata structure')
  }

  // Additional length validations
  if (
    metadata.name.length > MAX_FIELD_LENGTH ||
    metadata.type.length > MAX_FIELD_LENGTH ||
    metadata.extension.length > MAX_FIELD_LENGTH
  ) {
    throw new Error('Metadata field too long')
  }

  // Validate optional metadata size
  if (metadata.metadata !== undefined) {
    const metadataStr = JSON.stringify(metadata.metadata)
    if (metadataStr.length > MAX_CUSTOM_METADATA_SIZE) {
      throw new Error('Custom metadata too large')
    }
  }
}

/**
 * Create a readable stream from an existing reader
 *
 * @param {ReadableStreamDefaultReader} reader - Stream reader
 * @returns {ReadableStream} New readable stream
 */
function createStreamFromReader(reader) {
  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) {
        controller.close()
      } else {
        controller.enqueue(value)
      }
    },
  })
}

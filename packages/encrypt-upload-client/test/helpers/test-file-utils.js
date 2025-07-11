import { KMSMetadata } from '../../src/core/metadata/encrypted-metadata.js'

/**
 * Create test data with specific patterns for easy verification
 *
 * @param {number} sizeMB - Size of the test file in megabytes
 * @returns {Blob} A Blob containing test data with predictable patterns
 */
export function createTestFile(sizeMB) {
  const chunkSize = 64 * 1024 // 64KB chunks
  const totalSize = sizeMB * 1024 * 1024
  const numChunks = Math.ceil(totalSize / chunkSize)

  const chunks = []
  for (let i = 0; i < numChunks; i++) {
    const isLastChunk = i === numChunks - 1
    const currentChunkSize = isLastChunk
      ? totalSize % chunkSize || chunkSize
      : chunkSize
    const chunk = new Uint8Array(currentChunkSize)
    // Create pattern: chunk index in first byte, then sequence
    chunk[0] = i % 256
    for (let j = 1; j < currentChunkSize; j++) {
      chunk[j] = (i + j) % 256
    }
    chunks.push(chunk)
  }

  return new Blob(chunks, { type: 'application/octet-stream' })
}

/**
 * Convert ReadableStream to Uint8Array
 *
 * @param {ReadableStream} stream - The stream to convert
 * @returns {Promise<Uint8Array>} The stream content as a Uint8Array
 */
export async function streamToUint8Array(stream) {
  const reader = stream.getReader()
  const chunks = []
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  const totalLength = chunks.reduce((acc, val) => acc + val.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}

/**
 * @param {Uint8Array} arr
 * @returns {string}
 */
export function uint8ArrayToString(arr) {
  return new TextDecoder().decode(arr)
}

/**
 * @param {string} str
 * @returns {Uint8Array}
 */
export function stringToUint8Array(str) {
  return new TextEncoder().encode(str)
}

/**
 * Check if an error is a memory-related error (out of heap space, etc.)
 *
 * @param {unknown} error - The error to check
 * @returns {boolean} True if the error appears to be memory-related
 */
export function isMemoryError(error) {
  const errorMessage = error instanceof Error ? error.message : String(error)
  return (
    errorMessage.includes('heap') ||
    errorMessage.includes('memory') ||
    errorMessage.includes('allocation failed') ||
    errorMessage.includes('out of memory')
  )
}

/**
 * Test an encryption operation and expect it might fail with memory errors
 *
 * @param {Function} encryptOperation - Function that performs encryption
 * @param {string} operationName - Name of the operation for logging
 * @returns {Promise<{success: boolean, error?: Error}>} Result of the operation
 */
export async function testEncryptionWithMemoryHandling(
  encryptOperation,
  operationName
) {
  try {
    await encryptOperation()
    return { success: true }
  } catch (error) {
    if (isMemoryError(error)) {
      console.log(`✓ ${operationName} failed as expected: Out of memory`)
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    } else {
      // Re-throw if it's not a memory error
      throw error
    }
  }
}

/**
 * Create a CAR file with KMS metadata content
 *
 * @param {any} content - The KMS metadata content
 * @returns {Promise<{car: Uint8Array, actualRootCID: import('multiformats').UnknownLink}>}
 */
export async function createTestCar(content) {
  // Create KMS metadata and archive it to get the CAR
  const kmsMetadata = KMSMetadata.create(content)
  const { cid, bytes } = await kmsMetadata.archiveBlock()

  // Use UCANTO's CAR encoding to create a proper CAR file
  const { CAR } = await import('@ucanto/core')
  const car = CAR.encode({ roots: [{ cid, bytes }] })

  return { car, actualRootCID: cid }
}

/**
 * Create a mock BlobLike object for testing
 *
 * @param {Uint8Array} data
 * @returns {import('../../src/types.js').BlobLike}
 */
export function createMockBlob(data) {
  return {
    stream() {
      return new ReadableStream({
        start(controller) {
          controller.enqueue(data)
          controller.close()
        },
      })
    },
  }
}

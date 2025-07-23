import { describe, it } from 'node:test'
import assert from 'assert'
import {
  createFileWithMetadata,
  extractFileMetadata,
} from '../src/utils/file-metadata.js'

/**
 * Create a mock file for testing
 *
 * @param {string} content - The file content
 * @param {string} filename - The filename
 * @returns {Blob} Mock file blob
 */
const createMockFile = (
  content = 'test file content',
  filename = 'test.txt'
) => {
  return new Blob([content], { type: 'text/plain' })
}

/**
 * Convert stream to array buffer for testing
 *
 * @param {ReadableStream} stream - The stream to convert
 * @returns {Promise<ArrayBuffer>} The converted array buffer
 */
const streamToArrayBuffer = async (stream) => {
  const reader = stream.getReader()
  const chunks = []

  let done = false
  while (!done) {
    const result = await reader.read()
    done = result.done
    if (!done) {
      chunks.push(result.value)
    }
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0

  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }

  return result.buffer
}

await describe('File Metadata Utils', async () => {
  await describe('createFileWithMetadata', async () => {
    await it('should create file without metadata', () => {
      const originalFile = createMockFile()
      const result = createFileWithMetadata(originalFile)

      assert(result instanceof Blob)
      assert.equal(result.size, originalFile.size)
    })

    await it('should create file with metadata', () => {
      const originalFile = createMockFile()
      const metadata = {
        name: 'test.txt',
        type: 'text/plain',
        extension: 'txt',
      }

      const result = createFileWithMetadata(originalFile, metadata)

      assert(result instanceof Blob)
      assert.equal(result.size, originalFile.size + 1024) // Original file + 1KB header
    })

    await it('should reject metadata that is too large', () => {
      const originalFile = createMockFile()
      const largeMetadata = {
        name: 'test.txt',
        type: 'text/plain',
        extension: 'txt',
        metadata: {
          description: 'a'.repeat(1000), // Very long description
        },
      }

      assert.throws(
        () => createFileWithMetadata(originalFile, largeMetadata),
        /Metadata too large/
      )
    })

    await it('should handle empty files', () => {
      const emptyFile = new Blob([''])
      const metadata = {
        name: 'empty.txt',
        type: 'text/plain',
        extension: 'txt',
      }

      const result = createFileWithMetadata(emptyFile, metadata)
      assert.equal(result.size, 1024) // Just the header
    })

    await it('should handle binary files', () => {
      const binaryData = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]) // PNG header
      const binaryFile = new Blob([binaryData], { type: 'image/png' })
      const metadata = {
        name: 'image.png',
        type: 'image/png',
        extension: 'png',
      }

      const result = createFileWithMetadata(binaryFile, metadata)
      assert.equal(result.size, binaryData.length + 1024)
    })

    await it('should handle international characters in metadata', () => {
      const originalFile = createMockFile()
      const metadata = {
        name: '测试文件.txt', // Chinese characters
        type: 'text/plain',
        extension: 'txt',
        metadata: {
          author: '作者',
          emoji: '🎉📁',
        },
      }

      const result = createFileWithMetadata(originalFile, metadata)
      assert(result instanceof Blob)
      assert.equal(result.size, originalFile.size + 1024)
    })

    await it('should reject invalid metadata structure - null', () => {
      const originalFile = createMockFile()
      assert.throws(
        () => createFileWithMetadata(originalFile, /** @type {any} */ (null)),
        /Invalid metadata structure/
      )
    })

    await it('should reject invalid metadata structure - array', () => {
      const originalFile = createMockFile()
      assert.throws(
        () =>
          createFileWithMetadata(
            originalFile,
            /** @type {any} */ (['name', 'type'])
          ),
        /Invalid metadata structure/
      )
    })

    await it('should reject missing required fields', () => {
      const originalFile = createMockFile()
      const incompleteMetadata = { name: 'test.txt' } // Missing type and extension

      assert.throws(
        () =>
          createFileWithMetadata(
            originalFile,
            /** @type {any} */ (incompleteMetadata)
          ),
        /Invalid metadata structure/
      )
    })

    await it('should reject fields that are too long', () => {
      const originalFile = createMockFile()
      const longFieldMetadata = {
        name: 'a'.repeat(250), // Exceeds MAX_FIELD_LENGTH
        type: 'text/plain',
        extension: 'txt',
      }

      assert.throws(
        () => createFileWithMetadata(originalFile, longFieldMetadata),
        /Metadata field too long/
      )
    })

    await it('should reject wrong field types', () => {
      const originalFile = createMockFile()
      const wrongTypeMetadata = {
        name: 123, // Should be string
        type: 'text/plain',
        extension: 'txt',
      }

      assert.throws(
        () =>
          createFileWithMetadata(
            originalFile,
            /** @type {any} */ (wrongTypeMetadata)
          ),
        /Invalid metadata structure/
      )
    })

    await it('should handle Uint8Array input without metadata', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5])
      const result = createFileWithMetadata(/** @type {any} */ (data))

      assert(result instanceof Blob)
      assert.equal(result.size, data.length)
    })

    await it('should handle Uint8Array input with metadata', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5])
      const metadata = {
        name: 'data.bin',
        type: 'application/octet-stream',
        extension: 'bin',
      }

      const result = createFileWithMetadata(/** @type {any} */ (data), metadata)

      assert(result instanceof Blob)
      assert.equal(result.size, data.length + 1024) // Data + 1KB header
    })

    await it('should handle ArrayBuffer input without metadata', () => {
      const buffer = new ArrayBuffer(10)
      const result = createFileWithMetadata(/** @type {any} */ (buffer))

      assert(result instanceof Blob)
      assert.equal(result.size, buffer.byteLength)
    })

    await it('should handle ArrayBuffer input with metadata', () => {
      const buffer = new ArrayBuffer(10)
      const metadata = {
        name: 'buffer.dat',
        type: 'application/octet-stream',
        extension: 'dat',
      }

      const result = createFileWithMetadata(
        /** @type {any} */ (buffer),
        metadata
      )

      assert(result instanceof Blob)
      assert.equal(result.size, buffer.byteLength + 1024) // Buffer + 1KB header
    })

    await it('should throw error for unsupported BlobLike type', () => {
      const unsupportedBlobLike = {
        stream: () => new ReadableStream(),
        size: 100,
      }

      assert.throws(
        () => createFileWithMetadata(/** @type {any} */ (unsupportedBlobLike)),
        /Unsupported BlobLike type - must be Blob, Uint8Array, or ArrayBuffer/
      )
    })

    await it('should throw error for unsupported BlobLike type with metadata', () => {
      const unsupportedBlobLike = {
        stream: () => new ReadableStream(),
        size: 100,
      }
      const metadata = {
        name: 'test.txt',
        type: 'text/plain',
        extension: 'txt',
      }

      assert.throws(
        () =>
          createFileWithMetadata(
            /** @type {any} */ (unsupportedBlobLike),
            metadata
          ),
        /Unsupported BlobLike type - must be Blob, Uint8Array, or ArrayBuffer/
      )
    })
  })

  await describe('extractFileMetadata', async () => {
    await it('should extract metadata from file with header', async () => {
      const originalContent = 'test file content'
      const originalFile = createMockFile(originalContent)
      const metadata = {
        name: 'document.pdf',
        type: 'application/pdf',
        extension: 'pdf',
      }

      // Create file with metadata
      const fileWithMetadata = createFileWithMetadata(originalFile, metadata)

      // Convert to stream (simulating decrypted stream)
      const stream = fileWithMetadata.stream()

      // Extract metadata
      const { fileStream, fileMetadata } = await extractFileMetadata(stream)

      // Verify metadata was extracted correctly
      assert.deepEqual(fileMetadata, metadata)

      // Verify file content is preserved
      const extractedContent = await streamToArrayBuffer(fileStream)
      const originalArrayBuffer = await originalFile.arrayBuffer()

      assert.deepEqual(
        new Uint8Array(extractedContent),
        new Uint8Array(originalArrayBuffer)
      )
    })

    await it('should handle file without metadata', async () => {
      const originalFile = createMockFile()
      const stream = originalFile.stream()

      const { fileStream, fileMetadata } = await extractFileMetadata(stream)

      assert.equal(fileMetadata, undefined)
      assert(fileStream instanceof ReadableStream)
    })

    await it('should handle malformed metadata gracefully', async () => {
      // Create a file with invalid header
      const invalidHeader = new Uint8Array(1024)
      invalidHeader[0] = 255 // Invalid length
      invalidHeader[1] = 255
      invalidHeader[2] = 255
      invalidHeader[3] = 255

      const originalContent = 'test content'
      const combined = new Blob([invalidHeader, originalContent])
      const stream = combined.stream()

      const { fileStream, fileMetadata } = await extractFileMetadata(stream)

      // Should gracefully handle error and return stream without metadata
      assert.equal(fileMetadata, undefined)
      assert(fileStream instanceof ReadableStream)
    })

    // NEW EDGE CASE TESTS
    await it('should handle empty streams', async () => {
      const emptyBlob = new Blob([])
      const stream = emptyBlob.stream()

      const { fileStream, fileMetadata } = await extractFileMetadata(stream)

      assert.equal(fileMetadata, undefined)
      assert(fileStream instanceof ReadableStream)
    })

    await it('should handle streams smaller than header size', async () => {
      const smallBlob = new Blob(['small'])
      const stream = smallBlob.stream()

      const { fileStream, fileMetadata } = await extractFileMetadata(stream)

      assert.equal(fileMetadata, undefined)
      assert(fileStream instanceof ReadableStream)
    })

    await it('should handle malformed JSON in metadata', async () => {
      const header = new Uint8Array(1024)
      const malformedJson = '{name:"test",invalid}'
      const jsonBytes = new TextEncoder().encode(malformedJson)

      // Set valid length but invalid JSON
      const lengthBytes = new Uint8Array(
        new Uint32Array([jsonBytes.length]).buffer
      )
      header.set(lengthBytes, 0)
      header.set(jsonBytes, 4)

      const combined = new Blob([header, 'content'])
      const stream = combined.stream()

      const { fileStream, fileMetadata } = await extractFileMetadata(stream)

      // Should handle malformed JSON gracefully
      assert.equal(fileMetadata, undefined)
      assert(fileStream instanceof ReadableStream)
    })

    await it('should handle JSON that is too large', async () => {
      const header = new Uint8Array(1024)
      const largeJson = JSON.stringify({
        name: 'test.txt',
        type: 'text/plain',
        extension: 'txt',
        metadata: { data: 'x'.repeat(800) }, // Creates JSON > 800 chars
      })
      const jsonBytes = new TextEncoder().encode(largeJson)

      if (jsonBytes.length <= 1020) {
        // If it fits in header
        const lengthBytes = new Uint8Array(
          new Uint32Array([jsonBytes.length]).buffer
        )
        header.set(lengthBytes, 0)
        header.set(jsonBytes, 4)

        const combined = new Blob([header, 'content'])
        const stream = combined.stream()

        const { fileStream, fileMetadata } = await extractFileMetadata(stream)

        // Should handle oversized JSON gracefully
        assert.equal(fileMetadata, undefined)
        assert(fileStream instanceof ReadableStream)
      }
    })

    await it('should handle deeply nested JSON', async () => {
      const header = new Uint8Array(1024)
      const deeplyNested = {
        name: 'test.txt',
        type: 'text/plain',
        extension: 'txt',
        metadata: {
          level1: {
            level2: {
              level3: {
                level4: {
                  level5: {
                    level6: 'too deep', // Exceeds MAX_JSON_DEPTH (5)
                  },
                },
              },
            },
          },
        },
      }
      const jsonBytes = new TextEncoder().encode(JSON.stringify(deeplyNested))

      if (jsonBytes.length <= 1020) {
        // If it fits in header
        const lengthBytes = new Uint8Array(
          new Uint32Array([jsonBytes.length]).buffer
        )
        header.set(lengthBytes, 0)
        header.set(jsonBytes, 4)

        const combined = new Blob([header, 'content'])
        const stream = combined.stream()

        const { fileStream, fileMetadata } = await extractFileMetadata(stream)

        // Should handle deeply nested JSON gracefully
        assert.equal(fileMetadata, undefined)
        assert(fileStream instanceof ReadableStream)
      }
    })

    await it('should handle binary file content after metadata', async () => {
      const binaryData = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ])
      const binaryFile = new Blob([binaryData])
      const metadata = { name: 'test.png', type: 'image/png', extension: 'png' }

      const fileWithMetadata = createFileWithMetadata(binaryFile, metadata)
      const stream = fileWithMetadata.stream()

      const { fileStream, fileMetadata } = await extractFileMetadata(stream)

      assert.deepEqual(fileMetadata, metadata)

      // Verify binary content is preserved
      const extractedContent = await streamToArrayBuffer(fileStream)
      assert.deepEqual(new Uint8Array(extractedContent), binaryData)
    })

    await it('should handle international characters in extracted metadata', async () => {
      const originalFile = createMockFile('内容')
      const metadata = {
        name: '测试文件.txt',
        type: 'text/plain',
        extension: 'txt',
        metadata: {
          author: '作者',
          emoji: '🎉📁',
        },
      }

      const fileWithMetadata = createFileWithMetadata(originalFile, metadata)
      const stream = fileWithMetadata.stream()

      const { fileMetadata } = await extractFileMetadata(stream)

      assert.deepEqual(fileMetadata, metadata)
    })

    await it('should handle zero-length metadata', async () => {
      const header = new Uint8Array(1024)
      // Set length to 0
      const lengthBytes = new Uint8Array(new Uint32Array([0]).buffer)
      header.set(lengthBytes, 0)

      const combined = new Blob([header, 'content'])
      const stream = combined.stream()

      const { fileStream, fileMetadata } = await extractFileMetadata(stream)

      assert.equal(fileMetadata, undefined)
      assert(fileStream instanceof ReadableStream)
    })
  })

  await describe('round-trip test', async () => {
    await it('should preserve file content and metadata through full cycle', async () => {
      const originalContent = 'This is a test file with some content.'
      const originalFile = createMockFile(originalContent)
      const metadata = {
        name: 'test-document.txt',
        type: 'text/plain',
        extension: 'txt',
        metadata: {
          author: 'Test Author',
          created: '2024-01-15',
        },
      }

      // Step 1: Create file with metadata
      const fileWithMetadata = createFileWithMetadata(originalFile, metadata)

      // Step 2: Extract metadata (simulating decryption)
      const stream = fileWithMetadata.stream()
      const { fileStream, fileMetadata } = await extractFileMetadata(stream)

      // Step 3: Verify metadata
      assert.deepEqual(fileMetadata, metadata)

      // Step 4: Verify file content
      const extractedContent = await streamToArrayBuffer(fileStream)
      const originalArrayBuffer = await originalFile.arrayBuffer()

      assert.deepEqual(
        new Uint8Array(extractedContent),
        new Uint8Array(originalArrayBuffer)
      )
    })

    await it('should preserve binary files with international metadata', async () => {
      const binaryData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) // JPEG header
      const originalFile = new Blob([binaryData], { type: 'image/jpeg' })
      const metadata = {
        name: '照片.jpg',
        type: 'image/jpeg',
        extension: 'jpg',
        metadata: {
          camera: 'Canon EOS 📷',
          location: 'Tokyo 🗾',
        },
      }

      const fileWithMetadata = createFileWithMetadata(originalFile, metadata)
      const stream = fileWithMetadata.stream()
      const { fileStream, fileMetadata } = await extractFileMetadata(stream)

      assert.deepEqual(fileMetadata, metadata)

      const extractedContent = await streamToArrayBuffer(fileStream)
      assert.deepEqual(new Uint8Array(extractedContent), binaryData)
    })

    await it('should handle large files efficiently', async () => {
      // Create a 1MB file
      const largeContent = new Uint8Array(1024 * 1024).fill(42)
      const largeFile = new Blob([largeContent])
      const metadata = {
        name: 'large-file.bin',
        type: 'application/octet-stream',
        extension: 'bin',
      }

      const fileWithMetadata = createFileWithMetadata(largeFile, metadata)
      const stream = fileWithMetadata.stream()
      const { fileStream, fileMetadata } = await extractFileMetadata(stream)

      assert.deepEqual(fileMetadata, metadata)

      const extractedContent = await streamToArrayBuffer(fileStream)
      assert.deepEqual(new Uint8Array(extractedContent), largeContent)
    })
  })
})

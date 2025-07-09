import assert from 'node:assert'
import { describe, test } from 'node:test'
import { BrowserAesCtrCrypto } from '../src/crypto/symmetric/browser-aes-ctr-crypto.js'

/**
 * Create a test file of specified size in chunks
 *
 * @param {number} sizeInMB - Size in megabytes
 * @returns {Blob} Test file blob
 */
function createTestFile(sizeInMB) {
  const chunkSize = 64 * 1024 // 64KB chunks
  const totalSize = sizeInMB * 1024 * 1024
  const numChunks = Math.ceil(totalSize / chunkSize)

  const chunks = []
  for (let i = 0; i < numChunks; i++) {
    const isLastChunk = i === numChunks - 1
    const currentChunkSize = isLastChunk
      ? totalSize % chunkSize || chunkSize
      : chunkSize

    // Create chunk with pattern that includes chunk index for verification
    const chunk = new Uint8Array(currentChunkSize)
    const pattern = i % 256 // Use chunk index as pattern
    chunk.fill(pattern)

    chunks.push(chunk)
  }

  return new Blob(chunks, { type: 'application/octet-stream' })
}

/**
 * Stream data and track memory usage
 *
 * @param {ReadableStream} stream - Stream to process
 * @returns {Promise<{bytes: number, peakMemory: number}>}
 */
async function streamWithMemoryTracking(stream) {
  let totalBytes = 0
  let peakMemory = 0

  const reader = stream.getReader()

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      totalBytes += value.length

      // Track memory usage (approximate)
      if (globalThis.gc) {
        globalThis.gc() // Force garbage collection if available
      }

      const memUsage = process.memoryUsage ? process.memoryUsage().heapUsed : 0
      peakMemory = Math.max(peakMemory, memUsage)
    }
  } finally {
    reader.releaseLock()
  }

  return { bytes: totalBytes, peakMemory }
}

/**
 * Measure processing time
 *
 * @param {Function} fn - Function to measure
 * @returns {Promise<{result: any, duration: number}>}
 */
async function measureTime(fn) {
  const start = performance.now()
  const result = await fn()
  const duration = performance.now() - start
  return { result, duration }
}

await describe('Streaming Performance Tests', async () => {
  await describe('Counter Fix Performance', async () => {
    await test('should handle large files without counter overflow (16MB)', async () => {
      const crypto = new BrowserAesCtrCrypto()
      const testFile = createTestFile(16) // 16MB = ~256+ chunks at 64KB each

      console.log(`Testing 16MB file (${testFile.size} bytes)...`)

      const { result: encryptResult, duration: encryptTime } =
        await measureTime(async () => {
          return await crypto.encryptStream(testFile)
        })

      const { key, iv, encryptedStream } = encryptResult

      // Verify encryption completed successfully
      assert(key instanceof Uint8Array, 'Should return encryption key')
      assert(iv instanceof Uint8Array, 'Should return IV')
      assert(
        encryptedStream instanceof ReadableStream,
        'Should return encrypted stream'
      )

      console.log(`Encryption completed in ${encryptTime.toFixed(2)}ms`)

      // Test decryption
      const { result: decryptedStream, duration: decryptTime } =
        await measureTime(async () => {
          return await crypto.decryptStream(encryptedStream, key, iv)
        })

      console.log(`Decryption setup completed in ${decryptTime.toFixed(2)}ms`)

      // Stream the decrypted data and verify no memory bloat
      const { bytes: decryptedBytes, peakMemory } =
        await streamWithMemoryTracking(decryptedStream)

      assert.strictEqual(
        decryptedBytes,
        testFile.size,
        'Decrypted size should match original'
      )

      // Memory should stay bounded (under 100MB for 16MB file)
      const maxMemoryMB = peakMemory / (1024 * 1024)
      console.log(`Peak memory usage: ${maxMemoryMB.toFixed(2)}MB`)
      assert(
        maxMemoryMB < 100,
        `Memory usage should stay bounded, got ${maxMemoryMB.toFixed(2)}MB`
      )
    })

    await test('should handle very large files without counter overflow (1GB)', async () => {
      const crypto = new BrowserAesCtrCrypto()
      const testFile = createTestFile(1024) // 1GB = ~16,000+ chunks

      console.log(`Testing 1GB file (${testFile.size} bytes)...`)

      const { result: encryptResult, duration: encryptTime } =
        await measureTime(async () => {
          return await crypto.encryptStream(testFile)
        })

      const { encryptedStream } = encryptResult

      console.log(`1GB encryption completed in ${encryptTime.toFixed(2)}ms`)

      // Test streaming performance - don't store all data in memory
      let totalBytes = 0
      let peakMemory = 0
      const startStreamTime = performance.now()

      const reader = encryptedStream.getReader()
      try {
        let done = false
        while (!done) {
          const result = await reader.read()
          done = result.done
          if (done) break
          const value = result.value

          totalBytes += value.length

          // Track memory periodically (every ~100MB of data)
          if (totalBytes % (100 * 1024 * 1024) < value.length) {
            if (globalThis.gc) globalThis.gc()
            const memUsage = process.memoryUsage
              ? process.memoryUsage().heapUsed
              : 0
            peakMemory = Math.max(peakMemory, memUsage)
            console.log(
              `Processed ${(totalBytes / (1024 * 1024)).toFixed(0)}MB...`
            )
          }
        }
      } finally {
        reader.releaseLock()
      }

      const streamTime = performance.now() - startStreamTime
      const totalTime = encryptTime + streamTime
      const throughputMBps = testFile.size / (1024 * 1024) / (totalTime / 1000)

      assert.strictEqual(
        totalBytes,
        testFile.size,
        'Encrypted size should match original'
      )

      // Memory should stay bounded even for 1GB files (under 100MB)
      const maxMemoryMB = peakMemory / (1024 * 1024)
      console.log(
        `1GB file - Peak memory: ${maxMemoryMB.toFixed(
          2
        )}MB, Throughput: ${throughputMBps.toFixed(2)} MB/s`
      )
      assert(
        maxMemoryMB < 100,
        `Memory usage should stay bounded for 1GB files, got ${maxMemoryMB.toFixed(
          2
        )}MB`
      )

      // Throughput should remain reasonable for large files (at least 10 MB/s)
      assert(
        throughputMBps > 10,
        `Throughput should be reasonable for 1GB files, got ${throughputMBps.toFixed(
          2
        )} MB/s`
      )
    }) // Note: 1GB test may take 30-60 seconds depending on system performance

    await test('should validate counter implementation prevents overflow', async () => {
      const crypto = new BrowserAesCtrCrypto()

      // Test counter increment directly
      const initialCounter = new Uint8Array(16) // 128-bit counter
      initialCounter[15] = 250 // Start near overflow of last byte

      // Test incrementing past single byte overflow
      const incremented = crypto.incrementCounter(initialCounter, 10)

      // Should have incremented properly with carry
      assert.strictEqual(
        incremented[15],
        4,
        'Last byte should wrap around: (250 + 10) % 256 = 4'
      )
      assert.strictEqual(incremented[14], 1, 'Should carry to next byte')

      // Test large increment
      const largeIncrement = crypto.incrementCounter(initialCounter, 1000)

      // Verify carry propagation works correctly
      const expected = 250 + 1000 // 1250
      assert.strictEqual(
        largeIncrement[15],
        expected % 256,
        'Should handle large increments'
      )
      assert.strictEqual(
        largeIncrement[14],
        Math.floor(expected / 256),
        'Should carry properly'
      )
    })

    await test('should maintain streaming performance characteristics', async () => {
      const crypto = new BrowserAesCtrCrypto()

      // Test with multiple file sizes to ensure consistent performance
      const fileSizes = [1, 4, 16] // 1MB, 4MB, 16MB
      const results = []

      for (const sizeMB of fileSizes) {
        const testFile = createTestFile(sizeMB)

        const { result: encryptResult, duration: encryptTime } =
          await measureTime(async () => {
            return await crypto.encryptStream(testFile)
          })

        const { encryptedStream } = encryptResult
        const { duration: streamTime } = await measureTime(async () => {
          return await streamWithMemoryTracking(encryptedStream)
        })

        const totalTime = encryptTime + streamTime
        const throughputMBps = sizeMB / (totalTime / 1000)

        results.push({
          sizeMB,
          totalTime,
          throughputMBps,
        })

        console.log(
          `${sizeMB}MB: ${totalTime.toFixed(2)}ms (${throughputMBps.toFixed(
            2
          )} MB/s)`
        )
      }

      // Verify performance scales reasonably (not exponentially worse)
      const smallFile = results[0] // 1MB
      const largeFile = results[results.length - 1] // 16MB

      const expectedTimeRatio = largeFile.sizeMB / smallFile.sizeMB // 16x size
      const actualTimeRatio = largeFile.totalTime / smallFile.totalTime

      // Time should scale roughly linearly, allowing for some overhead (max 2x the expected ratio)
      assert(
        actualTimeRatio < expectedTimeRatio * 2,
        `Performance should scale linearly. Expected ~${expectedTimeRatio}x, got ${actualTimeRatio.toFixed(
          2
        )}x`
      )

      // Throughput should remain reasonable (at least 5 MB/s for streaming)
      for (const result of results) {
        assert(
          result.throughputMBps > 5,
          `Throughput should be reasonable, got ${result.throughputMBps.toFixed(
            2
          )} MB/s for ${result.sizeMB}MB file`
        )
      }
    })
  })

  await describe('Memory Efficiency Tests', async () => {
    await test('should maintain bounded memory usage during streaming', async () => {
      const crypto = new BrowserAesCtrCrypto()
      const testFile = createTestFile(32) // 32MB file

      console.log('Testing memory efficiency with 32MB file...')

      const { key, iv, encryptedStream } = await crypto.encryptStream(testFile)
      const decryptedStream = await crypto.decryptStream(
        encryptedStream,
        key,
        iv
      )

      // Track memory during streaming
      let maxMemoryDelta = 0
      let samples = 0
      const baseMemory = process.memoryUsage
        ? process.memoryUsage().heapUsed
        : 0

      const reader = decryptedStream.getReader()
      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done } = await reader.read()
          if (done) break

          // Sample memory every ~1MB of data
          if (samples % 16 === 0) {
            // Every 16 chunks (~1MB at 64KB chunks)
            if (globalThis.gc) globalThis.gc()

            const currentMemory = process.memoryUsage
              ? process.memoryUsage().heapUsed
              : 0
            const memoryDelta = currentMemory - baseMemory
            maxMemoryDelta = Math.max(maxMemoryDelta, memoryDelta)
          }
          samples++
        }
      } finally {
        reader.releaseLock()
      }

      const maxMemoryMB = maxMemoryDelta / (1024 * 1024)
      console.log(`Maximum memory delta: ${maxMemoryMB.toFixed(2)}MB`)

      // Memory delta should be much less than file size (streaming working properly)
      assert(
        maxMemoryMB < 50,
        `Memory usage should be bounded during streaming, got ${maxMemoryMB.toFixed(
          2
        )}MB`
      )
    })

    await test('should handle many small chunks efficiently', async () => {
      const crypto = new BrowserAesCtrCrypto()

      // Create file with many small chunks to stress test counter operations
      const chunks = []
      const numChunks = 1000
      const chunkSize = 1024 // 1KB chunks = 1MB total, 1000 counter increments

      for (let i = 0; i < numChunks; i++) {
        const chunk = new Uint8Array(chunkSize)
        chunk.fill(i % 256)
        chunks.push(chunk)
      }

      const testFile = new Blob(chunks, { type: 'application/octet-stream' })
      console.log(
        `Testing ${numChunks} small chunks (${testFile.size} bytes total)...`
      )

      const startTime = performance.now()
      const { encryptedStream } = await crypto.encryptStream(testFile)

      // Verify all chunks processed
      const { bytes } = await streamWithMemoryTracking(encryptedStream)
      const endTime = performance.now()

      assert.strictEqual(bytes, testFile.size, 'All chunks should be processed')

      const duration = endTime - startTime
      const chunksPerSecond = numChunks / (duration / 1000)
      console.log(
        `Processed ${numChunks} chunks in ${duration.toFixed(
          2
        )}ms (${chunksPerSecond.toFixed(0)} chunks/sec)`
      )

      // Should handle reasonable throughput of small chunks
      assert(
        chunksPerSecond > 1000,
        `Should efficiently handle small chunks, got ${chunksPerSecond.toFixed(
          0
        )} chunks/sec`
      )
    })
  })

  await describe('Counter Arithmetic Validation', async () => {
    await test('should correctly handle counter overflow edge cases', async () => {
      const crypto = new BrowserAesCtrCrypto()

      // Test edge cases for counter arithmetic
      const testCases = [
        { initial: [0, 0, 0, 255], increment: 1, expected: [0, 0, 1, 0] }, // Single byte overflow
        { initial: [0, 0, 255, 255], increment: 1, expected: [0, 1, 0, 0] }, // Two byte overflow
      ]

      for (const testCase of testCases) {
        const counter = new Uint8Array(16)

        // Set up the test counter (using last 4 bytes for simplicity)
        counter[12] = testCase.initial[0]
        counter[13] = testCase.initial[1]
        counter[14] = testCase.initial[2]
        counter[15] = testCase.initial[3]

        const result = crypto.incrementCounter(counter, testCase.increment)

        assert.strictEqual(
          result[12],
          testCase.expected[0],
          `Byte 12 should be ${testCase.expected[0]}`
        )
        assert.strictEqual(
          result[13],
          testCase.expected[1],
          `Byte 13 should be ${testCase.expected[1]}`
        )
        assert.strictEqual(
          result[14],
          testCase.expected[2],
          `Byte 14 should be ${testCase.expected[2]}`
        )
        assert.strictEqual(
          result[15],
          testCase.expected[3],
          `Byte 15 should be ${testCase.expected[3]}`
        )
      }

      // Test actual overflow - all 16 bytes set to 255
      const maxCounter = new Uint8Array(16).fill(255)
      assert.throws(
        () => {
          crypto.incrementCounter(maxCounter, 1)
        },
        /Counter overflow/,
        'Should throw overflow error when all 16 bytes are 255'
      )
    })

    await test('should maintain counter uniqueness across large file', async () => {
      const crypto = new BrowserAesCtrCrypto()

      // Track unique counter values during encryption
      const usedCounters = new Set()
      const baseCounter = new Uint8Array(16)

      // Simulate processing 1000 chunks
      for (let i = 0; i < 1000; i++) {
        const chunkCounter = crypto.incrementCounter(baseCounter, i)
        const counterString = Array.from(chunkCounter).join(',')

        assert(
          !usedCounters.has(counterString),
          `Counter should be unique for chunk ${i}`
        )
        usedCounters.add(counterString)
      }

      assert.strictEqual(
        usedCounters.size,
        1000,
        'All counters should be unique'
      )
      console.log(`Verified ${usedCounters.size} unique counter values`)
    })
  })
})

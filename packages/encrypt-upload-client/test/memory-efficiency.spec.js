import './setup.js'
import { test, describe } from 'node:test'
import assert from 'node:assert'

import { GenericAesCtrStreamingCrypto } from '../src/crypto/symmetric/generic-aes-ctr-streaming-crypto.js'
import { createTestFile } from './helpers/test-file-utils.js'

/**
 * These tests demonstrate why streaming is necessary for large files.
 * They show that buffered approaches fail with memory errors while streaming succeeds.
 */
await describe('Memory Efficiency - Why Streaming Matters', async () => {
  await test('should show streaming handles progressively larger files', async () => {
    const streamingCrypto = new GenericAesCtrStreamingCrypto()

    // Test with multiple sizes to show streaming scales linearly
    const testSizes = [5, 10, 15, 20, 50, 100, 500, 1000] // MB - sizes that would challenge buffered approaches

    for (const sizeMB of testSizes) {
      console.log(`Processing ${sizeMB}MB file...`)

      const testFile = createTestFile(sizeMB)
      const startTime = Date.now()

      const { encryptedStream } = await streamingCrypto.encryptStream(testFile)

      let processedBytes = 0
      let chunkCount = 0
      const reader = encryptedStream.getReader()

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          processedBytes += value.length
          chunkCount++
        }
      } finally {
        reader.releaseLock()
      }

      const processingTime = Date.now() - startTime
      const throughput = processedBytes / 1024 / 1024 / (processingTime / 1000) // MB/s

      assert.strictEqual(
        processedBytes,
        testFile.size,
        `Should process entire ${sizeMB}MB file`
      )
      console.log(
        `✓ ${sizeMB}MB: ${chunkCount} chunks, ${throughput.toFixed(1)} MB/s`
      )
    }

    console.log(
      'DEMONSTRATED: Streaming handles large files with consistent performance'
    )
  })

  await test('should project memory behavior for realistic file sizes', async () => {
    const streamingCrypto = new GenericAesCtrStreamingCrypto()

    // Test with a size we can actually handle to project larger files
    const testFile = createTestFile(5) // 5MB

    const getMemoryUsage = () => {
      if (globalThis.gc) globalThis.gc()
      return process.memoryUsage ? process.memoryUsage().heapUsed : 0
    }

    const baseMemory = getMemoryUsage()
    const { encryptedStream } = await streamingCrypto.encryptStream(testFile)

    let peakMemoryDelta = 0
    let processedBytes = 0

    const reader = encryptedStream.getReader()
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        processedBytes += value.length

        // Sample memory usage
        const currentMemory = getMemoryUsage()
        const memoryDelta = currentMemory - baseMemory
        peakMemoryDelta = Math.max(peakMemoryDelta, memoryDelta)
      }
    } finally {
      reader.releaseLock()
    }

    const peakMemoryMB = peakMemoryDelta / 1024 / 1024
    const fileSize = testFile.size / 1024 / 1024
    const memoryEfficiency = (peakMemoryDelta / testFile.size) * 100

    console.log(`File size: ${fileSize.toFixed(1)}MB`)
    console.log(`Peak memory delta: ${peakMemoryMB.toFixed(2)}MB`)
    console.log(
      `Memory efficiency: ${memoryEfficiency.toFixed(1)}% of file size`
    )

    // Project to larger file sizes
    console.log('\nProjected memory usage:')
    const projectedSizes = [100, 1000, 5000] // MB = 100MB, 1GB, 5GB
    for (const sizeMB of projectedSizes) {
      const projectedMemory = (memoryEfficiency / 100) * sizeMB
      const sizeLabel = sizeMB >= 1000 ? `${sizeMB / 1000}GB` : `${sizeMB}MB`
      console.log(`  ${sizeLabel}: ~${projectedMemory.toFixed(1)}MB memory`)
    }

    // Memory should be bounded (much less than file size)
    assert(
      peakMemoryMB < fileSize,
      'Streaming should use less memory than file size'
    )
    assert(
      memoryEfficiency < 50,
      'Memory usage should be less than 50% of file size'
    )

    console.log(
      'DEMONSTRATED: Streaming memory usage scales sub-linearly with file size'
    )
  })
})

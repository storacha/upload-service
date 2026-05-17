import { formatEther } from 'viem'
import { filesize } from '../../lib.js'

/**
 * @param {string} value
 */
export function truncateDID(value) {
  const prefixLength = 18
  const suffixLength = 5

  if (value.length <= prefixLength + suffixLength) return value

  const start = value.slice(0, prefixLength)
  const end = value.slice(-suffixLength)

  return `${start}...${end}`
}

/**
 * @param {string} value
 * @param {number} [maxLength]
 */
export function truncateValue(value, maxLength = 64) {
  if (value.length <= maxLength) return value
  const visible = Math.max(maxLength - 3, 10)
  const head = Math.ceil(visible * 0.65)
  const tail = Math.floor(visible * 0.35)
  return `${value.slice(0, head)}...${value.slice(-tail)}`
}

/**
 * @param {bigint} bytes
 */
export function formatBytes(bytes) {
  return filesize(Number(bytes))
}

/**
 * @param {bigint} value
 */
export function formatTokenAmount(value) {
  return Number(formatEther(value)).toLocaleString(undefined, {
    maximumFractionDigits: 4,
  })
}

/**
 * @param {number} durationMs
 */
export function formatDuration(durationMs) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }

  return `${seconds}s`
}

import { DID, UnknownLink } from '@w3ui/react'

export const B = 1024
export const MB = 1024 * B
export const GB = 1024 * MB
export const TB = 1024 * GB

export function shortenCID(cid: UnknownLink) {
  return shorten(cid.toString(), 5, 4)
}

export function shortenDID(did: DID) {
  return shorten(did, 14, 4)
}

function shorten(text: string, front: number = 3, back: number = 3): string {
  return `${text.slice(0, front)}…${text.slice(-back)}`
}

export function filesize (bytes: number) {
  if (bytes < B / 2) return `${bytes}B` // avoid 0.0KB
  if (bytes < MB / 2) return `${(bytes / 1024).toFixed(1)}KB` // avoid 0.0MB
  if (bytes < GB / 2) return `${(bytes / 1024 / 1024).toFixed(1)}MB` // avoid 0.0GB
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`
}

import type { UnknownLink } from '../api.js'

export type LocationCommitmentRange = [number, number?]

export interface LocationCommitmentMetadata {
  /** shard */
  s?: UnknownLink
  /** range */
  r?: LocationCommitmentRange
  /** expiration */
  e?: number | bigint
  /** claim */
  c?: UnknownLink
}

export interface EqualsClaimMetadata {
  /** equals link */
  '='?: UnknownLink
}

export interface IPNIProviderIdentity {
  Addrs?: string[]
}

export interface IPNIProviderResult {
  Metadata?: string
  Provider?: IPNIProviderIdentity
}

export interface IPNIMultihashResult {
  Multihash?: string
  ProviderResults?: IPNIProviderResult[]
}

export interface IPNIFindResponse {
  MultihashResults?: IPNIMultihashResult[]
}

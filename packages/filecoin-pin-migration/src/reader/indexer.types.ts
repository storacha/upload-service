import type { UnknownLink } from '../api.js'

export type LocationCommitmentRange = [number | bigint, (number | bigint)?]

export interface LocationCommitmentMetadata {
  s?: UnknownLink
  r?: LocationCommitmentRange
  e?: number | bigint
  c?: UnknownLink
}

export interface EqualsClaimMetadata {
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

import { Failure, Result, UnknownLink } from '@ucanto/interface'
import {
  AccountDID,
  ProviderDID,
  SpaceDID,
  UsageData,
  EgressData,
  EgressUsageData,
} from '@storacha/capabilities/types'

export type { UsageData, EgressUsageData }

export interface UsageStorage {
  report: (
    provider: ProviderDID,
    space: SpaceDID,
    period: { from: Date; to: Date }
  ) => Promise<Result<UsageData, Failure>>
  reportEgress: (
    provider: ProviderDID,
    space: SpaceDID,
    period: { from: Date; to: Date }
  ) => Promise<Result<EgressUsageData, Failure>>
  record: (
    /** The space which contains the resource that was served. */
    space: SpaceDID,
    /** The customer that is being billed for the egress traffic. */
    customer: AccountDID,
    /** The resource that was served to the customer through the gateway. */
    resource: UnknownLink,
    /** The number of bytes that were served. */
    bytes: number,
    /** The date and time when the resource was served. */
    servedAt: Date,
    /** Identifier of the invocation that caused the egress traffic. */
    cause: UnknownLink
  ) => Promise<Result<EgressData, Failure>>
}

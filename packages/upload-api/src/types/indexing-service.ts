import {
  ConnectionView,
  DID,
  Principal,
  Proof,
  Signer,
} from '@ucanto/interface'
import {
  IndexingService as Service,
  IndexingServiceQueryClient as Client,
  Claim,
} from '@storacha/indexing-service-client/api'

export type { ConnectionView, DID, Principal, Proof, Signer }
export type { Service, Client, Claim }

export interface InvocationConfig {
  /** Signing authority issuing the UCAN invocation(s). */
  issuer: Signer
  /** The principal delegated to in the current UCAN. */
  audience: Principal
  /** The resource the invocation applies to. */
  with: DID
  /** Proof(s) the issuer has the capability to perform the action. */
  proofs?: Proof[]
}

export interface ClientConfig {
  invocationConfig: InvocationConfig
  connection: ConnectionView<Service>
}

export interface Context {
  indexingService: ClientConfig
}

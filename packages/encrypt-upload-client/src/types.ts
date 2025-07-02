import { Wallet } from 'ethers'
import { UnknownLink } from 'multiformats'
import { Client as StorachaClient } from '@storacha/client'
import { Result, Failure, Block } from '@ucanto/interface'
import { LitNodeClient } from '@lit-protocol/lit-node-client'
import {
  AccessControlConditions,
  AuthMethod,
  AuthSig,
  SessionSigsMap,
} from '@lit-protocol/types'
import type {
  BlobLike,
  AnyLink,
  Signer,
  DID,
  SigAlg,
} from '@storacha/client/types'

export type { IPLDBlock } from '@ucanto/interface'
export type { SpaceDID } from '@storacha/capabilities/types'
export type { UnknownFormat } from '@storacha/capabilities/types'
export type { Result, UnknownLink }
export type { BlobLike, AnyLink }

// Import SpaceDID for use in interfaces
import type { SpaceDID } from '@storacha/capabilities/types'

export interface EncryptedClient {
  encryptAndUploadFile(file: BlobLike, options?: EncryptionOptions): Promise<AnyLink>
  retrieveAndDecryptFile(
    cid: AnyLink,
    delegationCAR: Uint8Array,
    decryptionOptions: DecryptionOptions
  ): Promise<ReadableStream>
}

export type EncryptedClientOptions = {
  storachaClient: StorachaClient
  cryptoAdapter: CryptoAdapter
  gatewayURL?: URL
}

export interface EncryptOutput {
  key: Uint8Array
  iv: Uint8Array
  encryptedStream: ReadableStream
}

export interface SymmetricCrypto {
  encryptStream(data: BlobLike): Promise<EncryptOutput>
  decryptStream(
    encryptedData: ReadableStream,
    key: Uint8Array,
    iv: Uint8Array
  ): Promise<ReadableStream>
  
  // Algorithm-specific key/IV management
  combineKeyAndIV(key: Uint8Array, iv: Uint8Array): Uint8Array
  splitKeyAndIV(combined: Uint8Array): { key: Uint8Array, iv: Uint8Array }
}

export interface CryptoAdapter {
  // Symmetric crypto operations (delegated to composed SymmetricCrypto)
  encryptStream(data: BlobLike): Promise<EncryptOutput>
  decryptStream(
    encryptedData: ReadableStream,
    key: Uint8Array,
    iv: Uint8Array
  ): Promise<ReadableStream>
  
  // Strategy-specific key management
  createEncryptionContext(
    encryptionOptions: EncryptionOptions
  ): Promise<EncryptionContext>
  createDecryptionContext(params: {
    decryptionOptions: DecryptionOptions
    metadata: ExtractedMetadata
    delegationCAR: Uint8Array
    resourceCID: AnyLink
    issuer: Signer<DID, SigAlg>
    audience: DID
  }): Promise<DecryptionContext>
  encryptSymmetricKey(
    key: Uint8Array,
    iv: Uint8Array,
    encryptionContext: EncryptionContext
  ): Promise<EncryptedKeyResult>
  decryptSymmetricKey(
    encryptedKey: string,
    decryptionContext: DecryptionContext
  ): Promise<{ key: Uint8Array, iv: Uint8Array }>
  extractEncryptedMetadata(car: Uint8Array): ExtractedMetadata
  getEncryptedKey(metadata: ExtractedMetadata): string
  encodeMetadata(
    encryptedDataCID: string,
    encryptedKey: string,
    metadata: LitKeyMetadata | KMSKeyMetadata
  ): Promise<{ cid: AnyLink, bytes: Uint8Array }>
}

// User-provided options
export interface EncryptionOptions {
  /**
   * The DID of the space to encrypt the file for
   */
  spaceDID: SpaceDID
  /**
   * The access or decrypt proof for the space
   */
  spaceAccessProof?: unknown
}

export interface EncryptionContext {
  spaceDID: SpaceDID
  // Lit-specific (adapter-created)
  accessControlConditions?: AccessControlConditions
  litClient?: LitNodeClient
  // KMS-specific (adapter-created)
  privateGatewayURL?: URL
  privateGatewayDID?: string
  spaceAccessProof?: unknown
}

export interface DecryptionOptions {
  // User-provided options
  // Lit-specific (signer information)
  wallet?: Wallet
  sessionSigs?: SessionSigsMap
  // Lit PKP-specific (signer information)
  pkpPublicKey?: string
  authMethod?: AuthMethod
  // KMS-specific
  spaceDID?: SpaceDID
  spaceAccessProof?: unknown
}

export interface DecryptionContext {
  // Adapter-created internal context
  // Lit-specific (adapter-created)
  litClient?: LitNodeClient
  sessionSigs?: SessionSigsMap
  spaceDID?: SpaceDID
  plaintextKeyHash?: string
  accessControlConditions?: AccessControlConditions
  wrappedInvocationJSON?: string
  // KMS-specific (adapter-created)
  privateGatewayURL?: URL
  privateGatewayDID?: string
  spaceAccessProof?: unknown
}

export interface EncryptedKeyResult {
  strategy: EncryptionStrategy
  encryptedKey: string
  metadata: LitKeyMetadata | KMSKeyMetadata
}

export type EncryptionStrategy = 'lit' | 'kms'

export interface LitKeyMetadata {
  plaintextKeyHash: string
  accessControlConditions: AccessControlConditions
}

export interface KMSKeyMetadata {
  space: SpaceDID
  kms: {
    provider: 'google-kms'
    keyId: string
    algorithm: 'RSA-OAEP-2048-SHA256'
  }
}

export type EncryptedPayload = {
  strategy: EncryptionStrategy
  encryptedKey: string
  metadata: LitKeyMetadata | KMSKeyMetadata
  encryptedBlobLike: BlobLike
}

export type GenericAccessControlCondition = [Record<string, any>] // eslint-disable-line @typescript-eslint/no-explicit-any

export interface EncryptedMetadataInput {
  encryptedDataCID: string
  identityBoundCiphertext: string
  plaintextKeyHash: string
  accessControlConditions: AccessControlConditions
}

export interface EncryptedMetadata {
  encryptedDataCID: UnknownLink
  identityBoundCiphertext: Uint8Array
  plaintextKeyHash: Uint8Array
  accessControlConditions: AccessControlConditions
}

export interface EncryptedMetadataView extends EncryptedMetadata {
  /** Encode it to a CAR file. */
  archive(): Promise<Result<Uint8Array>>
  archiveBlock(): Promise<Block>
  toJSON(): EncryptedMetadataInput
}

export interface DecodeFailure extends Failure {
  name: 'DecodeFailure'
}

export interface SessionSignatureOptions {
  wallet: Wallet
  accessControlConditions: AccessControlConditions
  dataToEncryptHash: string
  expiration?: string
  capabilityAuthSigs?: AuthSig[] // Required if the capacity credit is delegated to the decrypting user
}

export interface PkpSessionSignatureOptions {
  pkpPublicKey: string
  authMethod: AuthMethod
  accessControlConditions: AccessControlConditions
  dataToEncryptHash: string
  expiration?: string
  capabilityAuthSigs?: AuthSig[] // Required if the capacity credit is delegated to the decrypting user
}

export interface LitPkpSigner {
  pkpPublicKey: string
  authMethod: AuthMethod
}

export interface LitWalletSigner {
  wallet: Wallet
}

export interface CreateDecryptWrappedInvocationOptions {
  delegationCAR: Uint8Array
  issuer: Signer<DID, SigAlg>
  audience: `did:${string}:${string}`
  spaceDID: `did:key:${string}`
  resourceCID: AnyLink
  expiration: number
}

export interface ExecuteUcanValidationOptions {
  sessionSigs: SessionSigsMap
  spaceDID: `did:key:${string}`
  identityBoundCiphertext: string
  plaintextKeyHash: string
  accessControlConditions: AccessControlConditions
  wrappedInvocationJSON: string
}

// Strategy-specific metadata types
export type ExtractedMetadata = LitExtractedMetadata | KMSExtractedMetadata

export interface LitExtractedMetadata {
  strategy: 'lit'
  encryptedDataCID: string
  identityBoundCiphertext: string
  plaintextKeyHash: string
  accessControlConditions: AccessControlConditions
}

export interface KMSExtractedMetadata {
  strategy: 'kms'
  encryptedDataCID: string
  encryptedSymmetricKey: string
  space: SpaceDID
  kms: {
    provider: 'google-kms'
    keyId: string
    algorithm: 'RSA-OAEP-2048-SHA256'
  }
}

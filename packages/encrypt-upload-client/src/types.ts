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
export type { SpaceDID } from '@storacha/capabilities/utils'
export type { UnknownFormat } from '@storacha/capabilities/types'
export type { Result, UnknownLink }
export type { BlobLike, AnyLink }

export interface EncryptedClient {
  uploadEncryptedFile(file: BlobLike): Promise<AnyLink>
  retrieveAndDecryptFile(
    signer: LitWalletSigner | LitPkpSigner,
    cid: AnyLink,
    delegationCAR: Uint8Array
  ): Promise<ReadableStream>
}

export type EncryptedClientOptions = {
  storachaClient: StorachaClient
  cryptoAdapter: CryptoAdapter
  litClient?: LitNodeClient
  gatewayURL?: URL
}

export interface CryptoAdapter {
  encryptStream(data: BlobLike): Promise<EncryptOutput>
  decryptStream(
    encryptedData: ReadableStream,
    key: Uint8Array,
    iv: Uint8Array
  ): Promise<ReadableStream>
}

export interface EncryptOutput {
  key: Uint8Array
  iv: Uint8Array
  encryptedStream: ReadableStream
}

export type EncryptedPayload = {
  identityBoundCiphertext: string
  plaintextKeyHash: string
  encryptedBlobLike: BlobLike
}

export type GenericAccessControlCondition = [Record<string, any>] // eslint-disable-line @typescript-eslint/no-explicit-any

export interface EncryptedMetadataInput {
  encryptedDataCID: string
  identityBoundCiphertext: string
  plaintextKeyHash: string
  accessControlConditions: GenericAccessControlCondition
}

export interface EncryptedMetadata {
  encryptedDataCID: UnknownLink
  identityBoundCiphertext: Uint8Array
  plaintextKeyHash: Uint8Array
  accessControlConditions: GenericAccessControlCondition
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

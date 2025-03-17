import { ethers } from 'ethers'
import {Client as StorachaClient} from '@storacha/client'
import { LitNodeClient } from '@lit-protocol/lit-node-client'
import type {BlobLike, AnyLink} from '@storacha/client/types'
import { UnknownLink } from 'multiformats'
import { Result, Failure, Block } from '@ucanto/interface'

export type { UnknownFormat } from '@storacha/capabilities/types'
export type { IPLDBlock } from '@ucanto/interface'
export type { Result, UnknownLink }

export type {SpaceDID} from '@storacha/capabilities/utils'
export type {BlobLike, AnyLink}

export type EncryptedClientOptions = {
    storachaClient: StorachaClient
    litClient?: LitNodeClient
    gatewayURL?: URL
}
 

export interface EncryptedClient {
    uploadEncryptedFile(file: BlobLike): Promise<AnyLink>
    retrieveAndDecryptFile(wallet: ethers.Wallet, cid: AnyLink): Promise<ReadableStream>
}

export type EncryptedPayload = {
    identityBoundCiphertext: string
    plaintextKeyHash: string
    encryptedBlobLike: BlobLike
}

export interface EncryptedMetadataInput {
    encryptedDataCID: string
    identityBoundCiphertext: string
    plaintextKeyHash: string
    accessControlConditions: [Record<string, any>]
  }
  
  export interface EncryptedMetadata {
    encryptedDataCID: UnknownLink
    identityBoundCiphertext: Uint8Array
    plaintextKeyHash: Uint8Array
    accessControlConditions: [Record<string, any>]
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
  
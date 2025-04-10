import type {
  HandlerExecutionError,
  Signer,
  InboundCodec,
  CapabilityParser,
  ParsedCapability,
  InferInvokedCapability,
  RevocationChecker,
  Match,
  Unit,
  Result,
  ConnectionView,
} from '@ucanto/interface'
import type { ProviderInput } from '@ucanto/server'
import { InvocationConfig } from '@storacha/filecoin-client/types'

export * as UcantoInterface from '@ucanto/interface'
export type { Result, Variant } from '@ucanto/interface'
export * from '@storacha/filecoin-client/types'
export * from '@storacha/capabilities/types'

// Resources
export interface Queue<Message> {
  add: (
    message: Message,
    options?: QueueMessageOptions
  ) => Promise<Result<Unit, QueueAddError>>
}

export interface Store<RecKey, Rec> {
  /**
   * Puts a record in the store.
   */
  put: (record: Rec) => Promise<Result<Unit, StorePutError>>
  /**
   * Gets a record from the store.
   */
  get: (key: RecKey) => Promise<Result<Rec, StoreGetError>>
  /**
   * Determine if a record already exists in the store for the given key.
   */
  has: (key: RecKey) => Promise<Result<boolean, StoreGetError>>
}

export interface UpdatableStore<RecKey, Rec> {
  /**
   * Updates a record from the store.
   */
  update: (
    key: RecKey,
    record: Partial<Rec>
  ) => Promise<Result<Rec, StoreGetError>>
}

export interface ReadableStreamStore<RecKey, Rec> {
  /**
   * Puts a record in the store.
   */
  put: (record: Rec) => Promise<Result<Unit, StorePutError>>
  /**
   * Gets a record from the store.
   */
  stream: (key: RecKey) => Promise<Result<ReadableStream<Rec>, StoreGetError>>
}

export interface ListSuccess<R> {
  /**
   * Opaque string specifying where to start retrival of the next page of
   * results.
   */
  cursor?: string
  results: R[]
}

export interface Pageable {
  /**
   * Opaque string specifying where to start retrival of the next page of
   * results.
   */
  cursor?: string
  /**
   * Maximum number of items to return.
   */
  size?: number
}

export interface QueryableStore<Query, Rec> {
  /**
   * Queries for record matching a given criteria.
   */
  query: (
    search: Query,
    options?: Pageable
  ) => Promise<Result<ListSuccess<Rec>, StoreGetError>>
}

export interface QueueMessageOptions {
  messageGroupId?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ServiceConfig<T extends Record<string, any>> {
  connection: ConnectionView<T>
  invocationConfig: InvocationConfig
}

// Errors

export type StorePutError = StoreOperationError | EncodeRecordFailed
export type StoreGetError =
  | StoreOperationError
  | EncodeRecordFailed
  | RecordNotFound
export type QueueAddError = QueueOperationError | EncodeRecordFailed

export interface QueueOperationError extends Error {
  name: 'QueueOperationFailed'
}

export interface StoreOperationError extends Error {
  name: 'StoreOperationFailed'
}

export interface RecordNotFound extends Error {
  name: 'RecordNotFound'
}

export interface EncodeRecordFailed extends Error {
  name: 'EncodeRecordFailed'
}

// Service utils

export interface UcantoServerContext extends RevocationChecker {
  id: Signer
  codec?: InboundCodec
  errorReporter: ErrorReporter
}

export interface ErrorReporter {
  catch: (error: HandlerExecutionError) => void
}

// test

export interface UcantoServerContextTest extends UcantoServerContext {
  queuedMessages: Map<string, unknown[]>
}

export type Test<S> = (
  assert: Assert,
  context: UcantoServerContextTest & S
) => unknown
export type Tests<S> = Record<string, Test<S>>

export type Input<C extends CapabilityParser<Match<ParsedCapability>>> =
  ProviderInput<InferInvokedCapability<C> & ParsedCapability>

export interface Assert {
  equal: <Actual, Expected extends Actual>(
    actual: Actual,
    expected: Expected,
    message?: string
  ) => unknown
  deepEqual: <Actual, Expected extends Actual>(
    actual: Actual,
    expected: Expected,
    message?: string
  ) => unknown
  ok: <Actual>(actual: Actual, message?: string) => unknown
}

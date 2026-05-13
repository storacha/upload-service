export const DEFAULT_STOP_ON_ERROR = true
export const DEFAULT_PULL_RETRIES = 3
export const DEFAULT_STORE_OPERATION_RETRIES = 4
export const DEFAULT_MAX_COMMIT_RETRIES = 3
export const DEFAULT_COMMIT_RETRY_TIMEOUT = 30_000
export const DEFAULT_RETRY_BACKOFF_FACTOR = 2
export const DEFAULT_RETRY_MIN_TIMEOUT = 500
export const DEFAULT_RETRY_MAX_TIMEOUT = 10_000
export const DEFAULT_RETRY_RANDOMIZE = true
export const DEFAULT_ENABLE_CDN = true
export const DEFAULT_PULL_BATCH_SIZE = 20
export const DEFAULT_PULL_CONCURRENCY = 4
export const DEFAULT_COMMIT_CONCURRENCY = 4
export const DEFAULT_UPLOAD_PAGE_SIZE = 100
export const DEFAULT_SHARD_LIST_CONCURRENCY = 8
export const DEFAULT_CHECKPOINT_EVERY_PAGES = 1
export const DEFAULT_QUERY_CLAIMS_BATCH_CONCURRENCY = 1
export const DEFAULT_CARPARK_CONCURRENCY = 8
// Per-request timeout for cid.contact IPNI lookups during reader fallback.
// Caps tail latency so a single slow response cannot dominate a fallback round.
export const DEFAULT_IPNI_REQUEST_TIMEOUT_MS = 10_000
// Whether to bypass the cid.contact repair step entirely during reader
// fallback. When true, only the primary claims path and carpark fallback run.
export const DEFAULT_SKIP_IPNI_FALLBACK = false
export const DEFAULT_PULL_DIAGNOSTIC_SAMPLE_SIZE = 5
export const DEFAULT_STORE_CONCURRENCY = 20
export const MAX_CREATE_DATASET_COMMIT_BATCH_PIECES = 0
export const MAX_ADD_PIECES_COMMIT_BATCH_PIECES = 0
export const MAX_COMMIT_EXTRADATA_BYTES = 8_192
// queryClaims begins hitting HTTP 414 around 300 SHA-256 multihashes per
// request. 200 keeps a conservative safety margin under the deployed URL limit.
export const MAX_QUERY_CLAIMS_HASHES_PER_REQUEST = 200

export const PRIMARY_COPY_INDEX = 0
export const SECONDARY_COPY_INDEX = 1

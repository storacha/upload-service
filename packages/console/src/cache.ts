import { DID } from '@ucanto/interface'

export const createUploadsListKey = (
  space: DID<'key'>,
  cursor?: string,
  pre?: boolean
) => `/space/${space}/uploads?cursor=${cursor ?? ''}&pre=${pre ?? false}`

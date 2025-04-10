import { Space } from '@storacha/capabilities'
import * as Provider from '@ucanto/server'
import * as API from './types.js'

import { info } from './space/info.js'
import { provide as provideRecordEgress } from './space/record.js'
import { createService as createBlobService } from './blob.js'
import { createService as createIndexService } from './index.js'

/**
 * @param {API.SpaceServiceContext & API.BlobServiceContext & API.LegacyBlobServiceContext & API.IndexServiceContext & API.UsageServiceContext} ctx
 */
export const createService = (ctx) => ({
  info: Provider.provide(Space.info, (input) => info(input, ctx)),
  blob: createBlobService(ctx),
  index: createIndexService(ctx),
  content: { serve: { egress: { record: provideRecordEgress(ctx) } } },
})

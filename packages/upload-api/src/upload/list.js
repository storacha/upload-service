import * as Server from '@ucanto/server'
import * as Upload from '@storacha/capabilities/upload'
import * as API from '../types.js'

/**
 * @param {API.UploadServiceContext} context
 * @returns {API.ServiceMethod<API.UploadList, API.UploadListSuccess, API.Failure>}
 */
export function uploadListProvider(context) {
  return Server.provide(Upload.list, async ({ capability }) => {
    const { cursor, size, pre } = capability.nb
    const space = Server.DID.parse(capability.with).did()
    return await context.uploadTable.list(space, { size, cursor, pre })
  })
}

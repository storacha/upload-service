import * as Server from '@ucanto/server'
import * as UploadShard from '@storacha/capabilities/upload/shard'
import * as API from '../../types.js'

/**
 * @param {API.UploadServiceContext} context
 * @returns {API.ServiceMethod<API.UploadShardList, API.UploadShardListSuccess, API.UploadShardListFailure>}
 */
export const uploadShardListProvider = (context) =>
  Server.provide(UploadShard.list, ({ capability }) => {
    const { root, cursor, size } = capability.nb
    const space = Server.DID.parse(capability.with).did()
    return context.uploadTable.listShards(space, root, { size, cursor })
  })

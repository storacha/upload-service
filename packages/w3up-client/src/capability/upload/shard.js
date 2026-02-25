import { UploadShard } from '@storacha/upload-client'
import { Upload as UploadCapabilities } from '@storacha/capabilities'
import { Base } from '../../base.js'

/**
 * Client for interacting with the `upload/shard/*` capabilities.
 */
export class UploadShardClient extends Base {
  /**
   * List upload shards.
   *
   * Required delegated capabilities:
   * - `upload/shard/list`
   *
   * @param {import('../../types.js').UnknownLink} root - Root data CID for the DAG that was stored.
   * @param {import('../../types.js').ListRequestOptions} [options]
   */
  async list(root, options = {}) {
    const conf = await this._invocationConfig([UploadCapabilities.list.can])
    options.connection = this._serviceConf.upload
    return UploadShard.list(conf, root, options)
  }
}

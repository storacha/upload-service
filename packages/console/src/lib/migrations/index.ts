import { ConnectionView, DIDKey, Proof, Service, Signer } from '@w3ui/react'
import retry, { AbortError } from 'p-retry'
import * as StoreCapabilities from '@web3-storage/capabilities/store'
import * as UploadCapabilities from '@web3-storage/capabilities/upload'
import { UploadsSource, Shard, Upload, MigrationSource, MigrationSourceConfiguration } from './api'
import { NFTStorageMigrator } from './nft-storage'

const REQUEST_RETRIES = 3

export const create = (source: MigrationSource, config: MigrationSourceConfiguration) => {
  switch (source) {
    case 'classic.nft.storage':
      return new NFTStorageMigrator(config)
    default:
      throw new Error(`not implemented`)
  }
}

export const migrate = async ({
  signal,
  uploads,
  issuer,
  space,
  proofs,
  connection,
  onStoreAdd,
  onUploadAdd,
  onError
}: {
  signal: AbortSignal
  uploads: UploadsSource
  issuer: Signer
  space: DIDKey
  proofs: Proof[]
  connection: ConnectionView<Service>
  onStoreAdd: (upload: Upload, shard: Shard) => unknown
  onUploadAdd: (upload: Upload) => unknown
  onError: (err: Error, upload: Upload, shard?: Shard) => unknown
}) => {
  for await (const upload of uploads) {
    let allShardsStored = true

    for (const shard of upload.shards) {
      if (signal.aborted) return

      try {
        const result = await retry(async () => {
          const receipt = await StoreCapabilities.add
            .invoke({
              issuer,
              audience: connection.id,
              with: space,
              nb: { link: shard.link, size: await shard.size() },
              proofs
            })
            .execute(connection)

          if (!receipt.out.ok) {
            throw receipt.out.error
          }
          return receipt.out.ok
        }, { onFailedAttempt: console.warn, retries: REQUEST_RETRIES })

        if (signal.aborted) return
        onStoreAdd(upload, shard)

        if (result.status === 'done') {
          continue
        }

        const res = await retry(async () => {
          try {
            const res = await fetch(result.url, {
              method: 'PUT',
              body: await shard.bytes(),
              headers: result.headers,
              signal,
              // @ts-expect-error
              duplex: 'half',
            })
            if (res.status >= 400 && res.status < 500) {
              throw new AbortError(`upload failed: ${res.status}`)
            }
            return res
          } catch (err) {
            if (signal?.aborted === true) {
              throw new AbortError('upload aborted')
            }
            throw err
          }
        }, { onFailedAttempt: console.warn, retries: REQUEST_RETRIES })
      
        if (!res.ok) {
          throw new Error(`upload failed: ${res.status}`)
        }
      } catch (err: any) {
        if (signal.aborted) return
        onError(err, upload, shard)
        allShardsStored = false
        break
      }
    }

    // do no register an upload if not all the shards uploaded successfully
    if (!allShardsStored) continue

    try {
      const receipt = await UploadCapabilities.add.invoke({
        issuer,
        audience: connection.id,
        proofs,
        with: space,
        nb: {
          root: upload.root,
          shards: upload.shards.map(s => s.link),
        },
      }).execute(connection)

      if (receipt.out.error) {
        throw receipt.out.error
      }

      if (signal.aborted) return
      onUploadAdd(upload)
    } catch (err: any) {
      if (signal.aborted) return
      onError(err, upload)
    }
  }
}

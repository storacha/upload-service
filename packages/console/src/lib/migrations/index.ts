import { ConnectionView, DIDKey, Proof, Service, Signer } from '@storacha/ui-react'
import retry, { AbortError } from 'p-retry'
import * as StoreCapabilities from '@storacha/capabilities/store'
import * as UploadCapabilities from '@storacha/capabilities/upload'
import { Reader, Shard, Upload, DataSourceID, DataSourceConfiguration } from './api'
import * as NFTStorage from './nft-storage'
import * as Web3Storage from './web3-storage'
import * as Web3StoragePSA from './web3-storage-psa'

const REQUEST_RETRIES = 3

const dataSources = [NFTStorage, Web3Storage, Web3StoragePSA]

export const createReader = (source: DataSourceID, config: DataSourceConfiguration): Reader => {
  const ds = dataSources.find(m => m.id === source)
  if (!ds) throw new Error(`not implemented: ${source}`)
  return ds.createReader(config)
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
  onError,
  onComplete
}: {
  signal: AbortSignal
  uploads: Reader
  issuer: Signer
  space: DIDKey
  proofs: Proof[]
  connection: ConnectionView<Service>
  onStoreAdd: (upload: Upload, shard: Shard) => unknown
  onUploadAdd: (upload: Upload) => unknown
  onError: (err: Error, upload: Upload, shard?: Shard) => unknown
  onComplete: () => unknown
}) => {
  for await (const upload of uploads) {
    let allShardsStored = Boolean(upload.shards.length) // if 0 shards we did not store them

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
            throw new Error('failed to store/add invocation', { cause: receipt.out.error })
          }
          return receipt.out.ok
        }, { onFailedAttempt: console.warn, retries: REQUEST_RETRIES })

        if (signal.aborted) return
        await onStoreAdd(upload, shard)

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
        await onError(err, upload, shard)
        allShardsStored = false
        break
      }
    }

    // signal that this upload failed if it has no shards
    if (upload.shards.length === 0) {
      await onError(new Error('upload has no shards'), upload)
    }

    // do no register an upload if not all the shards uploaded successfully
    if (!allShardsStored) {
      continue
    }

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
      await onUploadAdd(upload)
    } catch (err: any) {
      if (signal.aborted) return
      await onError(err, upload)
    }
  }
  await onComplete()
}

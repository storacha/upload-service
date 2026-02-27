import type { JSX } from 'react'
import { useMemo } from 'react'
import { base58btc } from 'multiformats/bases/base58'

type BlobItem = {
  blob: { digest: Uint8Array; size: number }
  insertedAt: string
}

export interface SpaceBlobsProps {
  blobs: BlobItem[]
  loading: boolean
  validating: boolean
  onNext?: () => void
  onPrev?: () => void
  onRefresh: () => void
  uploadHref?: string
}

function humanFileSize(bytes: number): string {
  const size = (bytes / (1024 * 1024)).toFixed(2)
  return `${size} MiB`
}

function BlobRow({ blob }: { blob: BlobItem }): JSX.Element {
  const digestStr = useMemo(() => base58btc.encode(blob.blob.digest), [blob.blob.digest])
  return (
    <tr className="cursor-pointer border-t border-hot-red hover:bg-hot-yellow-light bg-white">
      <td className="w-full">
        <div className="block px-4 py-2 font-mono text-xs overflow-hidden no-wrap text-ellipsis">{digestStr}</div>
      </td>
      <td title={blob.insertedAt}>
        <div className="block px-2 py-2 font-mono text-xs overflow-hidden no-wrap text-ellipsis w-48">{new Date(blob.insertedAt).toLocaleString()}</div>
      </td>
      <td title={`${blob.blob.size} bytes`}>
        <div className="block px-2 py-2 font-mono text-xs overflow-hidden no-wrap text-ellipsis">{humanFileSize(blob.blob.size)}</div>
      </td>
    </tr>
  )
}

export function SpaceBlobs(props: SpaceBlobsProps): JSX.Element {
  const { blobs, loading, validating, onNext, onPrev, onRefresh, uploadHref } = props
  return blobs === undefined || blobs.length === 0 ? (
    <div className="max-w-4xl">
      {loading ? null : (
        <div className="text-hot-red text-center mb-5">
          No uploads.
          {uploadHref ? (
            <a href={uploadHref} className="underline ml-1">Upload a file.</a>
          ) : null}
        </div>
      )}
      <nav className="flex flex-row justify-center">
        <button onClick={(e) => { e.preventDefault(); onRefresh() }} className="inline-block bg-white border border-hot-red hover:outline hover:bg-hot-red hover:text-white font-epilogue text-hot-red uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap">
          {loading ? 'Loading' : 'Reload'}
        </button>
      </nav>
    </div>
  ) : (
    <div className="max-w-4xl">
      <div className="shadow rounded-2xl border border-hot-red overflow-hidden">
        <table className={`border-collapse table-fixed w-full transition-opacity ${loading ? 'opacity-50' : 'opacity-100'}`}>
          <thead className="bg-white text-xs font-bold text-left text-hot-red">
            <tr>
              <th className="p-4 w-96 font-epilogue uppercase text-sm">CID</th>
              <th className="p-4 pl-2 w-48 font-epilogue uppercase text-sm">Timestamp</th>
              <th className="p-4 pl-2 w-40 font-epilogue uppercase text-sm">Size</th>
            </tr>
          </thead>
          <tbody>
            {blobs.map((blob, i) => (
              <BlobRow blob={blob} key={i} />
            ))}
          </tbody>
        </table>
      </div>
      <nav className="flex flex-row justify-between my-4">
        <button onClick={(e) => { e.preventDefault(); onPrev && onPrev() }} className={`inline-block bg-white border border-hot-red font-epilogue text-hot-red uppercase text-sm pl-3 pr-6 py-2 rounded-full whitespace-nowrap ${onPrev ? 'hover:outline hover:bg-hot-red hover:text-white' : 'opacity-30'}`} disabled={!onPrev || loading}>
          Previous
        </button>
        <button onClick={(e) => { e.preventDefault(); onRefresh() }} className="inline-block bg-white border border-hot-red hover:outline hover:bg-hot-red hover:text-white font-epilogue text-hot-red uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap">
          {loading || validating ? 'Loading' : 'Reload'}
        </button>
        <button onClick={(e) => { e.preventDefault(); onNext && onNext() }} className={`inline-block bg-white border border-hot-red font-epilogue text-hot-red uppercase text-sm pl-6 pr-3 py-2 rounded-full whitespace-nowrap ${onNext ? 'hover:outline hover:bg-hot-red hover:text-white' : 'opacity-30'}`} disabled={!onNext || loading}>
          Next
        </button>
      </nav>
    </div>
  )
}
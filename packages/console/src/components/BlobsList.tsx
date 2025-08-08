import React from 'react'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon,
} from '@heroicons/react/20/solid'
import { Space, SpaceBlobListSuccess } from '@storacha/ui-react'
import * as Digest from 'multiformats/hashes/digest'
import * as MFLink from 'multiformats/link'
import { codec as CAR } from '@ucanto/transport/car'

import Link from 'next/link'
import { BlobItem } from '@storacha/access'
import { usePathname } from 'next/navigation'

interface BlobsProps {
  space: Space
  blobs: SpaceBlobListSuccess['results']
  loading: boolean
  validating: boolean
  onNext: (() => void) | undefined
  onPrev: (() => void) | undefined
  onRefresh: () => void
}

function Blobs({
  space,
  blobs,
  loading,
  validating,
  onNext,
  onPrev,
  onRefresh,
}: BlobsProps): JSX.Element {
  return blobs === undefined || blobs.length === 0 ? (
    <div className="max-w-4xl">
      {loading ? null : (
        <div className="text-hot-red text-center mb-5">
          No uploads.{' '}
          <Link href={`/space/${space.did()}/upload`} className="underline">
            Upload a file.
          </Link>
        </div>
      )}
      <nav className="flex flex-row justify-center">
        <button
          onClick={(e) => {
            e.preventDefault()
            onRefresh()
          }}
          className="inline-block bg-white border border-hot-red hover:outline hover:bg-hot-red hover:text-white font-epilogue text-hot-red uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap"
        >
          <ArrowPathIcon
            className={`h-5 w-5  ${
              loading ? 'animate-spin' : ''
            } inline-block mr-1 align-middle`}
          />{' '}
          {loading ? 'Loading' : 'Reload'}
        </button>
      </nav>
    </div>
  ) : (
    <div className="max-w-4xl">
      <div className="shadow rounded-2xl border border-hot-red overflow-hidden">
        <table
          className={`border-collapse table-fixed w-full transition-opacity ${
            loading ? 'opacity-50' : 'opacity-100'
          }`}
        >
          <thead className="bg-white text-xs font-bold text-left text-hot-red">
            <tr>
              <th className="p-4 w-full font-epilogue uppercase text-sm">
                CID
              </th>
              <th className="p-4 pl-2 w-40 font-epilogue uppercase text-sm">
                Timestamp
              </th>
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
        <button
          onClick={(e) => {
            e.preventDefault()
            onPrev && onPrev()
          }}
          className={`inline-block bg-white border border-hot-red font-epilogue text-hot-red uppercase text-sm pl-3 pr-6 py-2 rounded-full whitespace-nowrap ${
            onPrev
              ? 'hover:outline hover:bg-hot-red hover:text-white'
              : 'opacity-30'
          }`}
          disabled={!onPrev || loading}
        >
          <ChevronLeftIcon className="h-5 w-5 inline-block mr-1 align-middle" />{' '}
          Previous
        </button>
        <button
          onClick={(e) => {
            e.preventDefault()
            onRefresh()
          }}
          className="inline-block bg-white border border-hot-red hover:outline hover:bg-hot-red hover:text-white font-epilogue text-hot-red uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap"
        >
          <ArrowPathIcon
            className={`h-5 w-5  ${
              loading || validating ? 'animate-spin' : ''
            } inline-block mr-1 align-middle`}
          />{' '}
          {loading || validating ? 'Loading' : 'Reload'}
        </button>
        <button
          onClick={(e) => {
            e.preventDefault()
            onNext && onNext()
          }}
          className={`inline-block bg-white border border-hot-red font-epilogue text-hot-red uppercase text-sm pl-6 pr-3 py-2 rounded-full whitespace-nowrap ${
            onNext
              ? 'hover:outline hover:bg-hot-red hover:text-white'
              : 'opacity-30'
          }`}
          disabled={!onNext || loading}
        >
          Next{' '}
          <ChevronRightIcon className="h-5 w-5 inline-block ml-1 align-middle" />
        </button>
      </nav>
    </div>
  )
}

function BlobRow({
  blob,
}: {
  blob: BlobItem
}) {
  const cid = MFLink.create(CAR.code, Digest.decode(blob.blob.digest)).toV1()
  const pathname = usePathname()
  return (
    <tr
      className={`cursor-pointer border-t border-hot-red hover:bg-hot-yellow-light bg-white`}
    >
      <td className="w-full">
        <a
          href={`${pathname}/${cid.toString()}`}
          className="block px-4 py-2 font-mono text-xs overflow-hidden no-wrap text-ellipsis"
        >
          {cid.toString()}
        </a>
      </td>
      <td title={blob.insertedAt}>
        <a
          href={`${pathname}/${cid.toString()}`}
          className="block p-2 text-xs text-left tabular-nums overflow-hidden no-wrap text-ellipsis"
        >
          {new Date(blob.insertedAt).toLocaleString()}
        </a>
      </td>
    </tr>
  )
}

export const BlobsList = (props: BlobsProps): JSX.Element => {
  return (
    <div className="mb-5">
      <Blobs {...props} />
    </div>
  )
}

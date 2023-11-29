import React from 'react'
import { ChevronLeftIcon, ChevronRightIcon, ArrowPathIcon } from '@heroicons/react/20/solid'
import { Space, UnknownLink, UploadListSuccess } from '@w3ui/react'

interface UploadsProps {
  space: Space
  uploads: UploadListSuccess['results']
  loading: boolean
  validating: boolean
  onSelect: (root: UnknownLink) => void
  onNext: (() => void) | undefined
  onPrev: (() => void) | undefined
  onRefresh: () => void
}

function Uploads ({ uploads, loading, validating, onSelect, onNext, onPrev, onRefresh }: UploadsProps): JSX.Element {
  return uploads === undefined || uploads.length === 0
    ? (
      <>
        {loading ? null : <div>No uploads</div>}
        <nav className='flex flex-row justify-center'>
          <button onClick={e => { e.preventDefault(); onRefresh() }} className='inline-block bg-zinc-950 hover:outline text-white font-bold text-sm px-6 py-2 rounded-full whitespace-nowrap'>
            <ArrowPathIcon className={`h-5 w-5  ${loading ? 'animate-spin' : ''} inline-block mr-1 align-middle`}/> {loading ? 'Loading' : 'Reload'}
          </button>
        </nav>
      </>
      )
    : (
      <div className='max-w-4xl'>
        <div className='shadow rounded-md border border-gray-900/60 overflow-hidden'>
          <table className={`border-collapse table-fixed w-full divide-y divide-zinc-600 transition-opacity ${loading ? 'opacity-50' : 'opacity-100'}`}>
            <thead className='bg-gray-900/60 text-xs font-bold text-left text-white'>
              <tr>
                <th className='p-2 pl-3 w-full'>Root CID</th>
                <th className='p-2 pl-2 w-40'>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((upload, i) => (
                <tr key={upload.root.toString()} className={`cursor-pointer hover:bg-white/40 ${i % 2 == 0 ? 'bg-gray-900/10' : ''}`}>
                  <td className='w-full'>
                    <a href='#' className='block p-2 pl-3 font-mono text-xs overflow-hidden no-wrap text-ellipsis' onClick={e => { e.preventDefault(); onSelect(upload.root) }}>
                      {upload.root.toString()}
                    </a>
                  </td>
                  <td title={upload.updatedAt}>
                    <a href={`./root/${upload.root.toString()}`} className='block p-2 text-xs text-left tabular-nums overflow-hidden no-wrap text-ellipsis' onClick={e => { e.preventDefault(); onSelect(upload.root) }}>
                      {new Date(upload.updatedAt).toLocaleString()}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <nav className='flex flex-row justify-between my-4'>
          <button onClick={e => { e.preventDefault(); onPrev && onPrev() }} className={`inline-block bg-zinc-950 text-white font-bold text-sm pl-3 pr-6 py-2 rounded-full whitespace-nowrap ${onPrev ? 'hover:outline' : 'opacity-10'}`} disabled={!onPrev || loading}>
            <ChevronLeftIcon className='h-5 w-5 inline-block mr-1 align-middle'/> Previous
          </button>
          <button onClick={e => { e.preventDefault(); onRefresh() }} className='inline-block bg-zinc-950 hover:outline text-white font-bold text-sm px-6 py-2 rounded-full whitespace-nowrap'>
            <ArrowPathIcon className={`h-5 w-5  ${loading || validating ? 'animate-spin' : ''} inline-block mr-1 align-middle`}/> {loading || validating ? 'Loading' : 'Reload'}
          </button>
          <button onClick={e => { e.preventDefault(); onNext && onNext() }} className={`inline-block bg-zinc-950 text-white font-bold text-sm pl-6 pr-3 py-2 rounded-full whitespace-nowrap ${onNext ? 'hover:outline' : 'opacity-10'}`} disabled={!onNext || loading}>
            Next <ChevronRightIcon className='h-5 w-5 inline-block ml-1 align-middle'/>
          </button>
        </nav>
      </div>
      )
}

export const UploadsList = (props: UploadsProps): JSX.Element => {
  return (
    <div className='mb-5'>
      <Uploads {...props} />
    </div>
  )
}

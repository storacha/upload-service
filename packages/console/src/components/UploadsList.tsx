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
        {loading ? null : <div className='text-hot-red text-center mb-5'>No uploads</div>}
        <nav className='flex flex-row justify-center'>
          <button onClick={e => { e.preventDefault(); onRefresh() }} className='inline-block bg-white border border-hot-red hover:outline hover:bg-hot-red hover:text-white font-epilogue text-hot-red uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap'>
            <ArrowPathIcon className={`h-5 w-5  ${loading ? 'animate-spin' : ''} inline-block mr-1 align-middle`}/> {loading ? 'Loading' : 'Reload'}
          </button>
        </nav>
      </>
      )
    : (
      <div className='max-w-4xl'>
        <div className='shadow rounded-2xl border border-hot-red overflow-hidden'>
          <table className={`border-collapse table-fixed w-full transition-opacity ${loading ? 'opacity-50' : 'opacity-100'}`}>
            <thead className='bg-white text-xs font-bold text-left text-hot-red'>
              <tr>
                <th className='p-4 w-full font-epilogue uppercase text-sm'>Root CID</th>
                <th className='p-4 pl-2 w-40 font-epilogue uppercase text-sm'>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((upload, i) => (
                <tr key={upload.root.toString()} className={`cursor-pointer border-t border-hot-red hover:bg-hot-yellow-light ${i % 2 == 0 ? 'bg-white' : 'bg-white'}`}>
                  <td className='w-full'>
                    <a href='#' className='block px-4 py-2 font-mono text-hot-red text-xs overflow-hidden no-wrap text-ellipsis' onClick={e => { e.preventDefault(); onSelect(upload.root) }}>
                      {upload.root.toString()}
                    </a>
                  </td>
                  <td title={upload.updatedAt}>
                    <a href={`./root/${upload.root.toString()}`} className='block p-2 text-hot-red text-xs text-left tabular-nums overflow-hidden no-wrap text-ellipsis' onClick={e => { e.preventDefault(); onSelect(upload.root) }}>
                      {new Date(upload.updatedAt).toLocaleString()}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <nav className='flex flex-row justify-between my-4'>
          <button onClick={e => { e.preventDefault(); onPrev && onPrev() }} className={`inline-block bg-white border border-hot-red font-epilogue text-hot-red uppercase text-sm pl-3 pr-6 py-2 rounded-full whitespace-nowrap ${onPrev ? 'hover:outline hover:bg-hot-red hover:text-white' : 'opacity-30'}`} disabled={!onPrev || loading}>
            <ChevronLeftIcon className='h-5 w-5 inline-block mr-1 align-middle'/> Previous
          </button>
          <button onClick={e => { e.preventDefault(); onRefresh() }} className='inline-block bg-white border border-hot-red hover:outline hover:bg-hot-red hover:text-white font-epilogue text-hot-red uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap'>
            <ArrowPathIcon className={`h-5 w-5  ${loading || validating ? 'animate-spin' : ''} inline-block mr-1 align-middle`}/> {loading || validating ? 'Loading' : 'Reload'}
          </button>
          <button onClick={e => { e.preventDefault(); onNext && onNext() }} className={`inline-block bg-white border border-hot-red font-epilogue text-hot-red uppercase text-sm pl-6 pr-3 py-2 rounded-full whitespace-nowrap ${onNext ? 'hover:outline hover:bg-hot-red hover:text-white' : 'opacity-30'}`} disabled={!onNext || loading}>
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

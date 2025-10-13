'use client'
import React from 'react'
import Link from 'next/link'
import { ChevronLeftIcon, ChevronRightIcon, ArrowPathIcon } from '@heroicons/react/20/solid'
import { UploadsList, useUploadsList, Space, UnknownLink } from '@storacha/ui-react'

interface UploadsManagerProps {
  space: Space
  uploads: Array<{
    root: UnknownLink
    updatedAt: string
  }>
  loading?: boolean
  validating?: boolean
  onUploadSelect?: (root: UnknownLink) => void
  onNext?: () => void
  onPrev?: () => void
  onRefresh?: () => void
}

function UploadsTable() {
  const [{ uploads, loading }] = useUploadsList()

  return (
    <div className="shadow rounded-2xl border border-hot-red overflow-hidden">
      <UploadsList.Table className={`border-collapse table-fixed w-full transition-opacity ${loading ? 'opacity-50' : 'opacity-100'}`}>
        <UploadsList.Header className="bg-white text-xs font-bold text-left text-hot-red">
          <tr>
            <th className="p-4 w-full font-epilogue uppercase text-sm">Root CID</th>
            <th className="p-4 pl-2 w-40 font-epilogue uppercase text-sm">Timestamp</th>
          </tr>
        </UploadsList.Header>
        <UploadsList.Body>
          {uploads.map((upload, i) => (
            <UploadsList.Row 
              key={upload.root.toString()} 
              upload={upload}
              className="cursor-pointer border-t border-hot-red hover:bg-hot-yellow-light bg-white"
            >
              <UploadsList.Cell className="w-full">
                <div className="block px-4 py-2 font-mono text-xs overflow-hidden no-wrap text-ellipsis">
                  {upload.root.toString()}
                </div>
              </UploadsList.Cell>
              <UploadsList.Cell title={upload.updatedAt}>
                <div className="block p-2 text-xs text-left tabular-nums overflow-hidden no-wrap text-ellipsis">
                  {new Date(upload.updatedAt).toLocaleString()}
                </div>
              </UploadsList.Cell>
            </UploadsList.Row>
          ))}
        </UploadsList.Body>
      </UploadsList.Table>
    </div>
  )
}

function UploadsNavigation({ space }: { space: Space }) {
  const [{ loading, validating }, { previousPage, nextPage, refresh }] = useUploadsList()

  return (
    <UploadsList.Pagination className="flex flex-row justify-between my-4">
      <button 
        onClick={previousPage}
        className="inline-block bg-white border border-hot-red font-epilogue text-hot-red uppercase text-sm pl-3 pr-6 py-2 rounded-full whitespace-nowrap hover:outline hover:bg-hot-red hover:text-white"
        disabled={loading}
      >
        <ChevronLeftIcon className='h-5 w-5 inline-block mr-1 align-middle'/> Previous
      </button>
      
      <UploadsList.RefreshButton className="inline-block bg-white border border-hot-red hover:outline hover:bg-hot-red hover:text-white font-epilogue text-hot-red uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap">
        <ArrowPathIcon className={`h-5 w-5 ${loading || validating ? 'animate-spin' : ''} inline-block mr-1 align-middle`}/> 
        {loading || validating ? 'Loading' : 'Reload'}
      </UploadsList.RefreshButton>
      
      <button 
        onClick={nextPage}
        className="inline-block bg-white border border-hot-red font-epilogue text-hot-red uppercase text-sm pl-6 pr-3 py-2 rounded-full whitespace-nowrap hover:outline hover:bg-hot-red hover:text-white"
        disabled={loading}
      >
        Next <ChevronRightIcon className='h-5 w-5 inline-block ml-1 align-middle'/>
      </button>
    </UploadsList.Pagination>
  )
}

function EmptyUploads({ space }: { space: Space }) {
  const [{ loading }] = useUploadsList()

  return (
    <div className='max-w-4xl'>
      {!loading && (
        <div className='text-hot-red text-center mb-5'>
          No uploads. <Link href={`/space/${space.did()}/upload`} className='underline'>Upload a file.</Link>
        </div>
      )}
      <nav className='flex flex-row justify-center'>
        <UploadsList.RefreshButton className='inline-block bg-white border border-hot-red hover:outline hover:bg-hot-red hover:text-white font-epilogue text-hot-red uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap'>
          <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''} inline-block mr-1 align-middle`}/> 
          {loading ? 'Loading' : 'Reload'}
        </UploadsList.RefreshButton>
      </nav>
    </div>
  )
}

export function UploadsManager({ 
  space, 
  uploads, 
  loading = false, 
  validating = false, 
  onUploadSelect, 
  onNext, 
  onPrev, 
  onRefresh 
}: UploadsManagerProps) {
  const handleRefresh = async () => {
    if (onRefresh) {
      onRefresh()
    }
  }

  return (
    <UploadsList 
      space={space}
      onUploadSelect={onUploadSelect}
      onRefresh={handleRefresh}
    >
      <div className="mb-5">
        <UploadsManagerContent 
          space={space} 
          uploads={uploads} 
          loading={loading}
          validating={validating}
        />
      </div>
    </UploadsList>
  )
}

interface UploadsManagerContentProps {
  space: Space
  uploads: Array<{
    root: UnknownLink
    updatedAt: string
  }>
  loading: boolean
  validating: boolean
}

function UploadsManagerContent({ space, uploads, loading, validating }: UploadsManagerContentProps) {
  const [, { setUploads, setLoading }] = useUploadsList()

  // Sync external state with internal UploadsList state
  React.useEffect(() => {
    setUploads(uploads.map(upload => ({
      root: upload.root,
      updatedAt: upload.updatedAt
    })))
  }, [uploads, setUploads])

  React.useEffect(() => {
    setLoading(loading)
  }, [loading, setLoading])

  const hasUploads = uploads && uploads.length > 0

  if (!hasUploads) {
    return <EmptyUploads space={space} />
  }

  return (
    <div className='max-w-4xl'>
      <UploadsTable />
      <UploadsNavigation space={space} />
    </div>
  )
}
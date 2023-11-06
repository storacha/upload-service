import React from 'react'
import { ChevronLeftIcon, ChevronRightIcon, ArrowPathIcon } from '@heroicons/react/20/solid'
import type { UploadListResult } from '@w3ui/uploads-list-core'
import { UploadsList as UploadsListCore } from '@w3ui/react-uploads-list'
import { gatewayHost } from '../components/services'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { H2 } from './Text'

interface UploadsProps {
  uploads?: UploadListResult[]
  loading: boolean
}

function Uploads ({ uploads, loading }: UploadsProps): JSX.Element {
  const pathname = usePathname()
  return uploads === undefined || uploads.length === 0
    ? (
      <>
        <div>No uploads</div>
        <nav className='flex flex-row justify-center'>
          <UploadsListCore.ReloadButton className='inline-block bg-zinc-950 hover:outline text-white font-bold text-sm px-6 py-2 rounded-full whitespace-nowrap'>
            <ArrowPathIcon className={`h-5 w-5  ${loading ? 'animate-spin' : ''} inline-block mr-1 align-middle`}/> Reload
          </UploadsListCore.ReloadButton>
        </nav>
      </>
      )
    : (
      <div className='max-w-4xl'>
        <div className='shadow rounded-md border border-gray-900/60 overflow-hidden'>
          <table className='border-collapse table-fixed w-full divide-y divide-zinc-600'>
            <thead className='bg-gray-900/60 text-xs font-bold text-left text-white'>
              <tr>
                <th className='p-2 pl-3 w-full'>Root CID</th>
                <th className='p-2 pl-2 w-40'>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((upload, i) => (
                <tr key={upload.root.toString()} className={` hover:bg-white/40 ${i % 2 == 0 ? 'bg-gray-900/10' : ''}`}>
                  <td className='w-full'>
                    <Link href={`${pathname}/root/${upload.root.toString()}`} className='block p-2 pl-3 font-mono text-xs overflow-hidden no-wrap text-ellipsis'>
                      {upload.root.toString()}
                    </Link>
                  </td>
                  <td title={upload.updatedAt}>
                    <Link href={`${pathname}/root/${upload.root.toString()}`} className='block p-2 text-xs text-left tabular-nums overflow-hidden no-wrap text-ellipsis'>
                      {new Date(upload.updatedAt).toLocaleString()}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <nav className='flex flex-row justify-between my-4'>
          <UploadsListCore.PrevButton className='inline-block bg-zinc-950 hover:outline text-white font-bold text-sm pl-3 pr-6 py-2 rounded-full whitespace-nowrap'>
            <ChevronLeftIcon className='h-5 w-5 inline-block mr-1 align-middle'/> Previous
          </UploadsListCore.PrevButton>
          <UploadsListCore.ReloadButton className='inline-block bg-zinc-950 hover:outline text-white font-bold text-sm px-6 py-2 rounded-full whitespace-nowrap'>
            <ArrowPathIcon className={`h-5 w-5  ${loading ? 'animate-spin' : ''} inline-block mr-1 align-middle`}/> Reload
          </UploadsListCore.ReloadButton>
          <UploadsListCore.NextButton className='inline-block bg-zinc-950 hover:outline text-white font-bold text-sm pl-6 pr-3 py-2 rounded-full whitespace-nowrap'>
            Next <ChevronRightIcon className='h-5 w-5 inline-block ml-1 align-middle'/>
          </UploadsListCore.NextButton>
        </nav>
      </div>
      )
}

export const UploadsList = (): JSX.Element => {
  return (
    <UploadsListCore>
      {(props) => (
        <div className='mb-5'>
          <Uploads uploads={props.uploadsList?.[0].data} loading={props.uploadsList?.[0].loading ?? false}/>
        </div>
      )}
    </UploadsListCore>
  )
}

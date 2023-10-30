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
        <div className='text-zinc-600'>No uploads</div>
        <nav className='flex flex-row justify-center'>
          <UploadsListCore.ReloadButton className='w3ui-button'>
            <ArrowPathIcon className={`h-6 w-6  ${loading ? 'animate-spin' : ''}`}/>
          </UploadsListCore.ReloadButton>
        </nav>
      </>
      )
    : (
      <div className='max-w-4xl'>
        <div className='rounded-md border border-zinc-600'>
          <table className='border-collapse table-fixed w-full divide-y divide-zinc-600'>
            <thead className='text-left'>
              <tr>
                <th className='p-2 pl-3 text-xs font-bold text-gray-400'>
                  Root CID
                </th>
                <th className='p-2 pl-2 text-xs font-bold text-gray-400 text-left w-40'>
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((upload) => (
                <tr key={upload.root.toString()} className='border-b border-zinc-700'>
                  <td className='w-full'>
                    <Link href={`${pathname}/root/${upload.root.toString()}`} className='hover:text-blue-400 block p-2 pl-3 font-mono text-xs overflow-hidden no-wrap text-ellipsis'>
                      {upload.root.toString()}
                    </Link>
                  </td>
                  <td className='text-xs text-gray-500 hover:text-gray-200 text-left pl-2 tabular-nums' title={upload.updatedAt}>
                    {new Date(upload.updatedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <nav className='flex flex-row justify-center space-x-4 my-4'>
          <UploadsListCore.PrevButton className='w3ui-button'>
            <ChevronLeftIcon className='h-6 w-6'/>
          </UploadsListCore.PrevButton>
          <UploadsListCore.ReloadButton className='w3ui-button'>
            <ArrowPathIcon className={`h-6 w-6  ${loading ? 'animate-spin' : ''}`}/>
          </UploadsListCore.ReloadButton>
          <UploadsListCore.NextButton className='w3ui-button'>
            <ChevronRightIcon className='h-6 w-6'/>
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

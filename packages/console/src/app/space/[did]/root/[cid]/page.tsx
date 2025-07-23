'use client'

import { useState } from 'react'
import { Dialog } from '@headlessui/react'
import { TrashIcon, ExclamationTriangleIcon, LockOpenIcon } from '@heroicons/react/24/outline'
import { H2 } from '@/components/Text'
import { useW3, UploadGetSuccess, SpaceDID, CARLink } from '@storacha/ui-react'
import useSWR, { useSWRConfig } from 'swr'
import { UnknownLink, parse as parseLink } from 'multiformats/link'
import DefaultLoader from '@/components/Loader'
import Link from 'next/link'
import CopyIcon from '@/components/CopyIcon'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { useRouter } from 'next/navigation'
import { createUploadsListKey } from '@/cache'
import { logAndCaptureError } from '@/sentry'
import { ipfsGatewayURL } from '@/components/services'
import { useFileDecryption } from '@/hooks/useFileDecryption'

interface PageProps {
  params: {
    did: string
    cid: string
  }
}

export default function ItemPage ({ params }: PageProps): JSX.Element {
  const [{ client, spaces }] = useW3()
  const spaceDID = decodeURIComponent(params.did)
  const space = spaces.find(s => s.did() === spaceDID)
  const root = parseLink(params.cid)

  const uploadKey = `/space/${spaceDID}/upload/${root}`
  const upload = useSWR<UploadGetSuccess|undefined>(uploadKey, {
    fetcher: async () => {
      if (!client || !space) return

      if (client.currentSpace()?.did() !== space.did()) {
        await client.setCurrentSpace(space.did())
      }

      return await client.capability.upload.get(root)
    },
    onError: logAndCaptureError
  })

  const [isRemoveConfirmModalOpen, setRemoveConfirmModalOpen] = useState(false)
  const router = useRouter()
  const { mutate } = useSWRConfig()
  
  // Add decryption functionality
  const { decryptAndDownload, canDecrypt, loading: decryptLoading, error: decryptError } = useFileDecryption(space)

  if (!space) {
    return <h1>Space not found</h1>
  }

  const handleRemove = async () => {
    await client?.remove(root, { shards: true })
    setRemoveConfirmModalOpen(false)
    // ensure list data is fresh
    mutate(createUploadsListKey(space.did()))
    // navigate to list (this page no longer exists)
    router.replace(`/space/${spaceDID}`)
  }

  const handleDecrypt = async () => {
    try {
      await decryptAndDownload(root, `decrypted-${root.toString().slice(0, 10)}.bin`)
    } catch (error) {
      console.error('Decryption failed:', error)
      // Error is already handled in the hook
    }
  }

  const url = ipfsGatewayURL(root)
  const isPrivateSpace = space.access?.type === 'private'
  
  return (
    <div>
      <Breadcrumbs space={space.did()} root={root} />
      <div className='border border-hot-red rounded-2xl bg-white p-5 max-w-4xl'>
        <H2>Root CID</H2>
        <div className="pb-5 font-mono text-sm overflow-hidden no-wrap text-ellipsis">
          {root.toString()}
          <CopyIcon text={root.toString()} />
        </div>
        
        <H2>{isPrivateSpace ? 'URL (Encryption Metadata)' : 'URL'}</H2>
        <div className="pb-5 overflow-hidden no-wrap text-ellipsis">
          <a href={url} className="font-mono text-sm underline m-0 p-0" target="_blank">{url}</a>
          <CopyIcon text={url} />
          {isPrivateSpace && (
            <p className="text-xs text-gray-500 mt-1">
              This shows the encrypted file metadata, not the actual file content.
            </p>
          )}
        </div>
        
        <H2>Shards</H2>
        <div className='pb-5'>
          {upload.isLoading
            ? <DefaultLoader className='w-5 h-5 inline-block' />
            : upload.data?.shards?.map(link => <Shard space={space.did()} root={root} shard={link} key={link.toString()} />)}
        </div>

        <div className="flex items-center gap-2">
                   
          <button onClick={e => { e.preventDefault(); setRemoveConfirmModalOpen(true) }} className={`inline-block bg-hot-red border border-hot-red hover:bg-white hover:text-hot-red font-epilogue text-white uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap`}>
            <TrashIcon className='h-5 w-5 inline-block mr-1 align-middle' style={{marginTop: -4}} /> Remove
          </button>

          {isPrivateSpace && (
            <button
              onClick={handleDecrypt}
              disabled={!canDecrypt || decryptLoading}
              className={`inline-block font-epilogue uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap ${
                canDecrypt && !decryptLoading
                  ? 'bg-blue-600 border border-blue-600 hover:bg-white hover:text-blue-600 text-white'
                  : 'bg-gray-300 border border-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {decryptLoading ? (
                <>
                  <div className="animate-spin inline-block w-4 h-4 border-2 border-solid border-current border-r-transparent rounded-full mr-2" />
                  Downloading & Decrypting...
                </>
              ) : (
                <>
                  <LockOpenIcon className='h-5 w-5 inline-block mr-1 align-middle' style={{marginTop: -4}} />
                  Download & Decrypt
                </>
              )}
            </button>
          )}
        </div>
        
        {isPrivateSpace && decryptError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
            <p className="text-sm text-red-800">
              <ExclamationTriangleIcon className="w-4 h-4 inline mr-1" />
              Decryption failed: {decryptError}
            </p>
          </div>
        )}
        
        {isPrivateSpace && !canDecrypt && (
          <p className="text-sm text-gray-600 mt-2">
            Note: Decryption requires KMS configuration
          </p>
        )}
        <RemoveConfirmModal
          isOpen={isRemoveConfirmModalOpen}
          root={root}
          shards={upload.data?.shards ?? []}
          onConfirm={handleRemove}
          onCancel={() => setRemoveConfirmModalOpen(false)}
        />
      </div>
    </div>
  )
}

function Shard ({ space, root, shard }: { space: SpaceDID, root: UnknownLink, shard: CARLink }) {
  return (
    <div>
      <Link href={`/space/${space}/root/${root}/shard/${shard}`} className='font-mono text-sm overflow-hidden no-wrap text-ellipsis underline'>{shard.toString()}</Link>
      <CopyIcon text={shard.toString()} />
    </div>
  )
}

interface RemoveConfirmModalProps {
  isOpen: boolean
  root: UnknownLink
  shards: UnknownLink[]
  onConfirm: () => void
  onCancel: () => void
}

function RemoveConfirmModal ({ isOpen, root, shards, onConfirm, onCancel }: RemoveConfirmModalProps) {
  const [confirmed, setConfirmed] = useState(false)
  const displayShards = shards.slice(0, 10)
  return (
    <Dialog open={isOpen} onClose={() => { setConfirmed(false); onCancel() }} className='relative z-50'>
      <div className='fixed inset-0 flex w-screen items-center justify-center bg-black/70 text-white' aria-hidden='true'>
        <Dialog.Panel className='bg-hot-red p-10 shadow-lg rounded-2xl font-epilogue'>
          <Dialog.Title className='text-lg uppercase text-center my-3'>
            <ExclamationTriangleIcon className='h-10 w-10 inline-block' /><br/>
            Confirm remove
          </Dialog.Title>
          <Dialog.Description className='py-2'>
            Are you sure you want to remove <span className='font-mono font-bold text-sm'>{root.toString()}</span>?
          </Dialog.Description>

          <p className='py-2'>The following shards will be removed:</p>

          <ul className='py-2 list-disc pl-6'>
            {displayShards.map(s => <li key={s.toString()} className='font-mono text-sm'>{s.toString()}</li>)}
          </ul>

          {displayShards.length < shards.length ? <p className='py-2'>...and {shards.length - displayShards.length} more.</p> : null}

          <p className='pt-2 pb-5'>
            Any uploads using the same shards as those listed above <em>will</em> be corrputed. This cannot be undone.
          </p>

          <div className='py-2 text-center'>
            <button onClick={e => { e.preventDefault(); setConfirmed(true); onConfirm() }} className={`inline-block bg-hot-red-light border border-white hover:bg-white hover:text-hot-red font-epilogue text-hot-red uppercase text-sm px-6 py-2 mr-3 rounded-full whitespace-nowrap ${confirmed ? 'opacity-50' : 'hover:outline'}`} disabled={confirmed}>
              <TrashIcon className='h-5 w-5 inline-block mr-1 align-middle' style={{marginTop: -4}} /> {confirmed ? 'Removing...' : 'Remove'}
            </button>
            <button onClick={e => { e.preventDefault(); setConfirmed(false); onCancel() }} className={`inline-block bg-hot-red border border-white hover:bg-white hover:text-hot-red font-epilogue text-white uppercase text-sm px-6 py-2 mr-3 rounded-full whitespace-nowrap ${confirmed ? 'opacity-50' : 'hover:outline'}`} disabled={confirmed}>
              Cancel
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
}

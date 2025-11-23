import type {
  OnUploadComplete,
} from '@storacha/ui-react'
import { CloudArrowUpIcon } from '@heroicons/react/24/outline'
import {
  UploadStatus,
  Uploader as W3Uploader,
  WrapInDirectoryCheckbox,
  useUploader,
  Uploading as SharedUploading,
  Errored as SharedErrored,
  Done as SharedDone,
  FileDisplay,
  UploaderConsole as SharedUploaderConsole,
  humanFileSize
} from '@storacha/ui-react'
import { ipfsGatewayURLStr } from '../components/services'
import { useEffect, useState, type JSX } from 'react';
import { RadioGroup } from '@headlessui/react'
import { H2 } from './Text'
import { logAndCaptureError } from '@/sentry'

export const Uploading: typeof SharedUploading = (props) => (
  <SharedUploading
    {...props}
    className="text-white"
    renderTitle={(file) => <H2>Uploading {file?.name}</H2>}
    renderShardInfo={(shard) => (
      <p className='text-xs max-w-full overflow-hidden text-ellipsis text-white'>
        shard {shard.cid.toString()} ({humanFileSize(shard.size)}) uploaded
      </p>
    )}
  />
)

export const Errored: typeof SharedErrored = (props) => (
  <SharedErrored
    {...props}
    className="text-white"
    onError={(error) => {
      logAndCaptureError(new Error(`Uploader Error: ${error.message}`, { cause: error }))
    }}
  />
)

export const Done: typeof SharedDone = (props) => {
  const [, { setFile }] = useUploader()
  
  return (
    <SharedDone
      {...props}
      className="text-white"
      renderCIDDisplay={(cid) => (
        <div className="text-center">
          <H2 className="mb-2">Uploaded</H2>
          <a
            className='font-mono text-xs max-w-full overflow-hidden no-wrap text-ellipsis text-white hover:text-hot-red'
            href={ipfsGatewayURLStr(cid)}
          >
            {cid}
          </a>
        </div>
      )}
      onUploadAnother={() => {
        setFile(undefined)
      }}
    />
  )
}

enum UploadType {
  File = 'File',
  Directory = 'Directory',
  CAR = 'CAR'
}

function uploadPrompt (uploadType: UploadType) {
  switch (uploadType) {
    case UploadType.File: {
      return 'Drag File or Click to Browse'
    }
    case UploadType.Directory: {
      return 'Drag Directory or Click to Browse'
    }
    case UploadType.CAR: {
      return 'Drag CAR or Click to Browse'
    }
  }
}

interface UploaderFormProps {
  space?: any
}

const UploaderForm = ({ space }: UploaderFormProps): JSX.Element => {
  const [{ file }, { setUploadAsCAR, setKmsConfig }] = useUploader()
  const [allowDirectory, setAllowDirectory] = useState(false)
  const [uploadType, setUploadType] = useState(UploadType.File)
  const isPrivateSpace = space?.access?.type === 'private'
  useEffect(() => {
    if (isPrivateSpace) {
      setKmsConfig({
        keyManagerServiceURL: process.env.NEXT_PUBLIC_UCAN_KMS_URL as string,
        keyManagerServiceDID: process.env.NEXT_PUBLIC_UCAN_KMS_DID as string,
        location: process.env.NEXT_PUBLIC_UCAN_KMS_LOCATION as string,
        keyring: process.env.NEXT_PUBLIC_UCAN_KMS_KEYRING as string,
        allowInsecureHttp: process.env.NEXT_PUBLIC_UCAN_KMS_ALLOW_INSECURE_HTTP as string === 'true'
      })
    }
  }, [isPrivateSpace, setKmsConfig])

  function changeUploadType (type: UploadType) {
    if (type === UploadType.File) {
      setUploadAsCAR(false)
      setAllowDirectory(false)
    } else if (type === UploadType.Directory) {
      setUploadAsCAR(false)
      setAllowDirectory(true)
    } else if (type === UploadType.CAR) {
      setUploadAsCAR(true)
      setAllowDirectory(false)
    }
    setUploadType(type)
  }
  const hasFile = file !== undefined
  return (
    <div className='max-w-4xl border border-hot-red bg-white p-5 rounded-2xl'>
      <W3Uploader.Form>
        {!isPrivateSpace && (
          <>
            <H2>Type</H2>
            <RadioGroup value={uploadType} onChange={changeUploadType} className='flex flex-row items-center font-epilogue mb-5'>
              <RadioGroup.Option value={UploadType.File}>
                {({ checked }) => (
                  <label className='mr-4'>
                    <input type='radio' checked={checked} /> File
                  </label>
                )}
              </RadioGroup.Option>
              <RadioGroup.Option value={UploadType.Directory}>
                {({ checked }) => (
                  <label className='mr-4'>
                    <input type='radio' checked={checked} /> Directory
                  </label>
                )}
              </RadioGroup.Option>
              <RadioGroup.Option value={UploadType.CAR}>
                {({ checked }) => (
                  <label className='mr-4'>
                    <input type='radio' checked={checked} /> CAR
                  </label>
                )}
              </RadioGroup.Option>
            </RadioGroup>
          </>
        )}
        <div className={`relative h-80 mb-5 p-8 rounded-md bg-white/5 hover:border-hot-red border-2 border-dashed border-black flex flex-col justify-center items-center text-center`}>
          {hasFile ? '' : <span className='mb-5 text-hot-red'><img src='/icon-tray.svg' /></span>}
          <label className={`${hasFile ? 'hidden' : 'block h-px w-px overflow-hidden absolute whitespace-nowrap'}`}>File:</label>
          <W3Uploader.Input className={`${hasFile ? 'hidden' : 'block absolute inset-0 cursor-pointer w-full opacity-0'}`} allowDirectory={allowDirectory} />
          <UploaderContents />
          {hasFile ? '' : <span className='font-epilogue'>{uploadPrompt(uploadType)}</span>}
        </div>
        {!isPrivateSpace && uploadType === UploadType.File && (
          <>
            <H2>Options</H2>
            <label className='flex flex-row items-center mb-5'>
              <WrapInDirectoryCheckbox />
              <span className='text-sm ml-1'>Wrap In Directory</span>
            </label>
          </>
        )}
      </W3Uploader.Form>
      <H2>Explain</H2>
      {isPrivateSpace ? (
        <div className='flex flex-col lg:flex-row space-y-4 lg:space-y-0 lg:space-x-4 mt-4 text-center lg:text-left'>
          <div className='w-1/2'>
            <h4 className='font-epilogue text-sm mb-2'>🔒&nbsp;&nbsp;Private Data</h4>
            <p className='text-xs'>
              Files uploaded to this space are encrypted locally and never published to Filecoin.<br/>
            </p>
          </div>
          <div className='w-1/2'>
            <h4 className='font-epilogue text-sm mb-2'>⚠️&nbsp;&nbsp;Hot Storage Only</h4>
            <p className='text-xs'>
              Once removed from hot storage, they are gone forever and cannot be recovered.
            </p>
          </div>
        </div>
      ) : (
        <div className='flex flex-col lg:flex-row space-y-4 lg:space-y-0 lg:space-x-4 mt-4 text-center lg:text-left'>
          <div className='w-1/2'>
            <h4 className='font-epilogue text-sm mb-2'>🌎&nbsp;&nbsp;Public Data</h4>
            <p className='text-xs'>
              All data uploaded here will be available to anyone who requests it using the correct CID.
              Do not upload any private or sensitive information in an unencrypted form.
            </p>
          </div>
          <div className='w-1/2'>
            <h4 className='font-epilogue text-sm mb-2'>♾️&nbsp;&nbsp;Permanent Data</h4>
            <p className='text-xs'>
              Removing files will remove them from the file listing for your account, but that
              doesn&apos;t prevent nodes on the decentralized storage network from retaining copies of the data
              indefinitely. Do not use this service for data that may need to be permanently deleted in the future.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}


const UploaderContents = (): JSX.Element => {
  const [{ status, file }] = useUploader()
  const hasFile = file !== undefined
  if (status === UploadStatus.Idle) {
    return hasFile
      ? (
        <>
          <FileDisplay 
            file={file} 
            className="text-white"
          />
          <div className='p-4'>
            <button type='submit' className='inline-block bg-hot-red border border-hot-red hover:bg-white hover:text-hot-red font-epilogue text-white uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap' disabled={file === undefined}>
              <CloudArrowUpIcon className='h-5 w-5 inline-block mr-1 align-middle' style={{ marginTop: -4 }} /> Start Upload
            </button>
          </div>
        </>
      )
      : <></>
  } else {
    return (
      <>
        <UploaderConsole />
      </>
    )
  }
}

const UploaderConsole = (): JSX.Element => {
  return (
    <SharedUploaderConsole
      className="text-white"
      onError={(error) => {
        logAndCaptureError(new Error(`Uploader Error: ${error.message}`, { cause: error }))
      }}
      renderUploading={(props) => <Uploading {...props} />}
      renderError={(props) => <Errored {...props} />}
      renderDone={(props) => <Done {...props} />}
    />
  )
}

export interface SimpleUploaderProps {
  onUploadComplete?: OnUploadComplete
  space?: any
}

export const Uploader = ({
  onUploadComplete,
  space
}: SimpleUploaderProps): JSX.Element => {
  return (
    <W3Uploader
      as='div'
      onUploadComplete={onUploadComplete}
      defaultWrapInDirectory={true}
    >
      <UploaderForm space={space} />
    </W3Uploader>
  )
}

import type {
  OnUploadComplete,
  ProgressStatus,
  UploadProgress,
  CARMetadata,
  AnyLink
} from '@storacha/ui-react'
import { ArrowPathIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline'
import {
  UploadStatus,
  Uploader as W3Uploader,
  WrapInDirectoryCheckbox,
  useUploader
} from '@storacha/ui-react'
import { ipfsGatewayURL } from '../components/services'
import { useEffect, useState } from 'react'
import { RadioGroup } from '@headlessui/react'
import { H2 } from './Text'
import { logAndCaptureError } from '@/sentry'

function StatusLoader ({ progressStatus }: { progressStatus: ProgressStatus }) {
  const { total, loaded, lengthComputable } = progressStatus
  if (lengthComputable) {
    const percentComplete = Math.floor((loaded / total) * 100)
    return (
      <div className='relative w-80 h-4 border border-solid border-white'>
        <div className='bg-white h-full' style={{ width: `${percentComplete}%` }}>
        </div>
      </div>
    )
  } else {
    return <ArrowPathIcon className='animate-spin h-5 w-5' />
  }
}

function Loader ({ uploadProgress }: { uploadProgress: UploadProgress }): JSX.Element {
  return (
    <div className='flex flex-col my-2'>
      {Object.values(uploadProgress).map(
        status => <StatusLoader progressStatus={status} key={status.url} />
      )}
    </div>
  )
}

export const Uploading = ({
  file,
  storedDAGShards,
  uploadProgress
}: {
  file?: File
  storedDAGShards?: CARMetadata[]
  uploadProgress: UploadProgress
}): JSX.Element => (
  <div className='flex flex-col items-center w-full'>
    <H2>Uploading {file?.name}</H2>
    <Loader uploadProgress={uploadProgress} />
    {storedDAGShards?.map(({ cid, size }) => (
      <p className='text-xs max-w-full overflow-hidden text-ellipsis' key={cid.toString()}>
        shard {cid.toString()} ({humanFileSize(size)}) uploaded
      </p>
    ))}
  </div>
)

export const Errored = ({ error }: { error: any }): JSX.Element => {
  useEffect(() => {
    if (error != null) {
      // eslint-disable-next-line no-console
      logAndCaptureError(new Error('Uploader Error:', { cause: error }))
    }
  }, [error])

  return (
    (<div className='flex flex-col items-center'>
      <h1>
        ⚠️ Error: failed to upload file: {error.message}
      </h1>
      <p>Check the browser console for details.</p>
    </div>)
  );
}

interface DoneProps {
  file?: File
  dataCID?: AnyLink
  storedDAGShards?: CARMetadata[]
}

export const Done = ({ dataCID }: DoneProps): JSX.Element => {
  const [, { setFile }] = useUploader()
  const cid: string = dataCID?.toString() ?? ''
  return (
    <div className='flex flex-col items-center w-full'>
      <H2>Uploaded</H2>
      <a
        className='font-mono text-xs max-w-full overflow-hidden no-wrap text-ellipsis'
        href={ipfsGatewayURL(cid)}
      >
        {cid}
      </a>
      <div className='my-4'>
        <button
          className='inline-block bg-hot-red border border-hot-red hover:bg-white hover:text-hot-red font-epilogue text-white uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap'
          onClick={() => {
            setFile(undefined)
          }}
        >
          Upload Another
        </button>
      </div>
    </div>
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
  space?: any // should be Space, but type not available
}

const UploaderForm = ({ space }: UploaderFormProps): JSX.Element => {
  const [{ file }, { setUploadAsCAR }] = useUploader()
  const [allowDirectory, setAllowDirectory] = useState(false)
  const [uploadType, setUploadType] = useState(UploadType.File)
  const isPrivateSpace = space?.access?.type === 'private'
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

function pickFileIconLabel (file: File): string | undefined {
  const type = file.type.split('/')
  if (type.length === 0 || type.at(0) === '') {
    const ext = file.name.split('.').at(-1)
    if (ext !== undefined && ext.length < 5) {
      return ext
    }
    return 'Data'
  }
  if (type.at(0) === 'image') {
    return type.at(-1)
  }
  return type.at(0)
}

function humanFileSize (bytes: number): string {
  const size = (bytes / (1024 * 1024)).toFixed(2)
  return `${size} MiB`
}

const UploaderContents = (): JSX.Element => {
  const [{ status, file }] = useUploader()
  const hasFile = file !== undefined
  if (status === UploadStatus.Idle) {
    return hasFile
      ? (
        <>
          <div className='flex flex-row'>
            <div className='w-12 h-12 py-0.5 flex flex-col justify-center items-center bg-hot-red-light text-black text-xs uppercase text-center text-ellipsis rounded-xs mr-4' title={file.type}>
              {pickFileIconLabel(file)}
            </div>
            <div className='flex flex-col justify-around'>
              <span className='text-sm'>{file.name}</span>
              <span className='text-xs opacity-50 font-mono'>
                {humanFileSize(file.size)}
              </span>
            </div>
          </div>
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
  const [{ status, file, error, dataCID, storedDAGShards, uploadProgress }] =
    useUploader()

  switch (status) {
    case UploadStatus.Uploading: {
      return <Uploading file={file} storedDAGShards={storedDAGShards} uploadProgress={uploadProgress} />
    }
    case UploadStatus.Succeeded: {
      return (
        <Done file={file} dataCID={dataCID} storedDAGShards={storedDAGShards} />
      )
    }
    case UploadStatus.Failed: {
      return <Errored error={error} />
    }
    default: {
      return <></>
    }
  }
}

export interface SimpleUploaderProps {
  onUploadComplete?: OnUploadComplete
  space?: any // should be Space, but type not available
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

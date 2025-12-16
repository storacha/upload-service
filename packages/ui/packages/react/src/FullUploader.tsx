import type { JSX } from 'react'
import type { AnyLink, CARMetadata, ProgressStatus } from '@storacha/ui-core'
import type { OnUploadComplete } from './Uploader.js'
import { Uploader as W3Uploader, UploadStatus, WrapInDirectoryCheckbox, useUploader } from './Uploader.js'
import { useEffect, useState } from 'react'
import type { KMSConfig } from './hooks.js'

function StatusLoader({ progressStatus }: { progressStatus: ProgressStatus }): JSX.Element {
  const { total, loaded, lengthComputable } = progressStatus
  if (lengthComputable) {
    const percentComplete = Math.floor((loaded / total) * 100)
    return (
      <div className="relative w-80 h-4 border">
        <div className="bg-white h-full" style={{ width: `${percentComplete}%` }} />
      </div>
    )
  } else {
    return <span>Loading…</span>
  }
}

function Loader({ uploadProgress }: { uploadProgress: Record<string, ProgressStatus> }): JSX.Element {
  return (
    <div className="flex flex-col my-2">
      {Object.values(uploadProgress).map((status) => (
        <StatusLoader progressStatus={status} key={status.url} />
      ))}
    </div>
  )
}

function humanFileSize(bytes: number): string {
  const size = (bytes / (1024 * 1024)).toFixed(2)
  return `${size} MiB`
}

function Uploading({ file, storedDAGShards, uploadProgress }: { file?: File; storedDAGShards?: CARMetadata[]; uploadProgress: Record<string, ProgressStatus> }): JSX.Element {
  return (
    <div className="flex flex-col items-center w-full">
      <h2 className="text-sm font-bold uppercase">Uploading {file?.name}</h2>
      <Loader uploadProgress={uploadProgress} />
      {storedDAGShards?.map(({ cid, size }) => (
        <p className="text-xs max-w-full overflow-hidden text-ellipsis" key={cid.toString()}>
          shard {cid.toString()} ({humanFileSize(size)}) uploaded
        </p>
      ))}
    </div>
  )
}

function Errored({ error }: { error: any }): JSX.Element {
  useEffect(() => {
    if (error != null) {
      // eslint-disable-next-line no-console
      console.error('Uploader Error:', error)
    }
  }, [error])
  return (
    <div className="flex flex-col items-center">
      <h2 className="text-sm font-bold uppercase">Error</h2>
      <p className="text-xs">Failed to upload file: {error?.message}</p>
    </div>
  )
}

function Done({ dataCID, gatewayURL }: { dataCID?: AnyLink; gatewayURL: (cid: string) => string }): JSX.Element {
  const [, { setFile }] = useUploader()
  const cid: string = dataCID?.toString() ?? ''
  return (
    <div className="flex flex-col items-center w-full">
      <h2 className="text-sm font-bold uppercase">Uploaded</h2>
      <a className="font-mono text-xs max-w-full overflow-hidden no-wrap text-ellipsis" href={gatewayURL(cid)}>{cid}</a>
      <div className="my-4">
        <button className="inline-block border text-black uppercase text-sm px-6 py-2 rounded-full" onClick={() => { setFile(undefined) }}>
          Upload Another
        </button>
      </div>
    </div>
  )
}

enum UploadType { File = 'File', Directory = 'Directory', CAR = 'CAR' }

function uploadPrompt(uploadType: UploadType) {
  switch (uploadType) {
    case UploadType.File: return 'Drag File or Click to Browse'
    case UploadType.Directory: return 'Drag Directory or Click to Browse'
    case UploadType.CAR: return 'Drag CAR or Click to Browse'
  }
}

function pickFileIconLabel(file: File): string | undefined {
  const type = file.type.split('/')
  if (type.length === 0 || type.at(0) === '') {
    const ext = file.name.split('.').at(-1)
    if (ext !== undefined && ext.length < 5) return ext
    return 'Data'
  }
  if (type.at(0) === 'image') return type.at(-1)
  return type.at(0)
}

function UploaderConsole({ gatewayURL }: { gatewayURL: (cid: string) => string }): JSX.Element {
  const [{ status, file, error, dataCID, storedDAGShards, uploadProgress }] = useUploader()
  switch (status) {
    case UploadStatus.Uploading: return <Uploading file={file} storedDAGShards={storedDAGShards} uploadProgress={uploadProgress} />
    case UploadStatus.Succeeded: return <Done dataCID={dataCID} gatewayURL={gatewayURL} />
    case UploadStatus.Failed: return <Errored error={error} />
    default: return <></>
  }
}

function UploaderContents(): JSX.Element {
  const [{ status, file }] = useUploader()
  const hasFile = file !== undefined
  if (status === UploadStatus.Idle) {
    return hasFile ? (
      <>
        <div className="flex flex-row">
          <div className="w-12 h-12 py-0.5 flex flex-col justify-center items-center bg-white text-black text-xs uppercase text-center rounded-xs mr-4" title={file.type}>
            {pickFileIconLabel(file)}
          </div>
          <div className="flex flex-col justify-around">
            <span className="text-sm">{file.name}</span>
            <span className="text-xs opacity-50 font-mono">{humanFileSize(file.size)}</span>
          </div>
        </div>
        <div className="p-4">
          <button type="submit" className="inline-block border text-black uppercase text-sm px-6 py-2 rounded-full" disabled={file === undefined}>
            Start Upload
          </button>
        </div>
      </>
    ) : <></>
  } else {
    return <UploaderConsole gatewayURL={(cid) => `https://${cid}.ipfs.w3s.link`} />
  }
}

export interface FullUploaderProps { onUploadComplete?: OnUploadComplete; space?: any; gatewayURL?: (cid: string) => string; kmsConfig?: KMSConfig }

export function FullUploader({ onUploadComplete, space, gatewayURL, kmsConfig }: FullUploaderProps): JSX.Element {
  const [{}, { setUploadAsCAR, setKmsConfig }] = useUploader()
  const [allowDirectory, setAllowDirectory] = useState(false)
  const [uploadType, setUploadType] = useState<UploadType>(UploadType.File)
  const isPrivateSpace = space?.access?.type === 'private'

  useEffect(() => { if (isPrivateSpace && kmsConfig !== undefined) { setKmsConfig(kmsConfig) } }, [isPrivateSpace, setKmsConfig, kmsConfig])

  function changeUploadType(type: UploadType) {
    if (type === UploadType.File) { setUploadAsCAR(false); setAllowDirectory(false) }
    else if (type === UploadType.Directory) { setUploadAsCAR(false); setAllowDirectory(true) }
    else if (type === UploadType.CAR) { setUploadAsCAR(true); setAllowDirectory(false) }
    setUploadType(type)
  }

  const hasFile = useUploader()[0].file !== undefined

  return (
    <W3Uploader as="div" onUploadComplete={onUploadComplete} defaultWrapInDirectory={true}>
      <W3Uploader.Form>
        {!isPrivateSpace && (
          <>
            <h2 className="text-sm font-bold uppercase">Type</h2>
            <div className="flex flex-row items-center mb-5">
              <label className="mr-4"><input type="radio" name="upload-type" checked={uploadType === UploadType.File} onChange={() => changeUploadType(UploadType.File)} /> File</label>
              <label className="mr-4"><input type="radio" name="upload-type" checked={uploadType === UploadType.Directory} onChange={() => changeUploadType(UploadType.Directory)} /> Directory</label>
              <label className="mr-4"><input type="radio" name="upload-type" checked={uploadType === UploadType.CAR} onChange={() => changeUploadType(UploadType.CAR)} /> CAR</label>
            </div>
          </>
        )}
        <div className={`relative h-80 mb-5 p-8 rounded-md border-2 border-dashed flex flex-col justify-center items-center text-center`}>
          <label className={`${hasFile ? 'hidden' : 'block h-px w-px overflow-hidden absolute whitespace-nowrap'}`}>File:</label>
          <W3Uploader.Input className={`${hasFile ? 'hidden' : 'block absolute inset-0 cursor-pointer w-full opacity-0'}`} allowDirectory={allowDirectory} />
          <UploaderContents />
          {hasFile ? '' : <span className="text-sm">{uploadPrompt(uploadType)}</span>}
        </div>
        {!isPrivateSpace && uploadType === UploadType.File && (
          <>
            <h2 className="text-sm font-bold uppercase">Options</h2>
            <label className="flex flex-row items-center mb-5"><WrapInDirectoryCheckbox /><span className="text-sm ml-1">Wrap In Directory</span></label>
          </>
        )}
      </W3Uploader.Form>
      <h2 className="text-sm font-bold uppercase">Explain</h2>
      {isPrivateSpace ? (
        <div className="flex flex-col lg:flex-row space-y-4 lg:space-y-0 lg:space-x-4 mt-4 text-center lg:text-left">
          <div className="w-1/2"><h4 className="text-sm mb-2">Private Data</h4><p className="text-xs">Files uploaded to this space are encrypted locally and never published to Filecoin.</p></div>
          <div className="w-1/2"><h4 className="text-sm mb-2">Hot Storage Only</h4><p className="text-xs">Once removed from hot storage, they are gone forever and cannot be recovered.</p></div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row space-y-4 lg:space-y-0 lg:space-x-4 mt-4 text-center lg:text-left">
          <div className="w-1/2"><h4 className="text-sm mb-2">Public Data</h4><p className="text-xs">All data uploaded here will be available to anyone who requests it using the correct CID.</p></div>
          <div className="w-1/2"><h4 className="text-sm mb-2">Permanent Data</h4><p className="text-xs">Removing files will remove them from the file listing for your account, but nodes may retain copies indefinitely.</p></div>
        </div>
      )}
    </W3Uploader>
  )
}
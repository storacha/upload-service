import type { ProgressStatus, CARMetadata, AnyLink } from '@storacha/ui-core'
import type { UploadProgress } from './Uploader.js'
import { useEffect, type JSX, type ReactNode } from 'react'
import { useUploader } from './Uploader.js'

export interface StatusLoaderProps {
  progressStatus: ProgressStatus
  className?: string
}

export function StatusLoader({ progressStatus, className = '' }: StatusLoaderProps): JSX.Element {
  const { total, loaded, lengthComputable } = progressStatus
  
  if (lengthComputable) {
    const percentComplete = Math.floor((loaded / total) * 100)
    return (
      <div className={`relative w-80 h-4 border border-solid border-current ${className}`}>
        <div 
          className='bg-current h-full transition-all duration-300' 
          style={{ width: `${percentComplete}%` }}
          role="progressbar"
          aria-valuenow={percentComplete}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Upload progress: ${percentComplete}%`}
        />
      </div>
    )
  }
  
  return (
    <div className={`animate-spin h-5 w-5 ${className}`} role="status" aria-label="Loading">
      <svg className="w-full h-full" fill="none" viewBox="0 0 24 24">
        <circle 
          className="opacity-25" 
          cx="12" 
          cy="12" 
          r="10" 
          stroke="currentColor" 
          strokeWidth="4"
        />
        <path 
          className="opacity-75" 
          fill="currentColor" 
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  )
}

export interface LoaderProps {
  uploadProgress: UploadProgress
  className?: string
}


export function Loader({ uploadProgress, className = '' }: LoaderProps): JSX.Element {
  return (
    <div className={`flex flex-col my-2 gap-2 ${className}`}>
      {Object.values(uploadProgress).map(status => (
        <StatusLoader progressStatus={status} key={status.url} />
      ))}
    </div>
  )
}

export interface UploadingProps {
  file?: File
  files?: File[]
  storedDAGShards?: CARMetadata[]
  uploadProgress: UploadProgress
  className?: string
  renderTitle?: (file?: File, files?: File[]) => ReactNode
  renderShardInfo?: (shard: CARMetadata) => ReactNode
}


export function Uploading({
  file,
  files,
  storedDAGShards,
  uploadProgress,
  className = '',
  renderTitle,
  renderShardInfo
}: UploadingProps): JSX.Element {
  const displayName = files && files.length > 1 
    ? `${files.length} files` 
    : file?.name

  return (
    <div className={`flex flex-col items-center w-full ${className}`}>
      {renderTitle ? (
        renderTitle(file, files)
      ) : (
        <h2 className="text-xl font-semibold mb-4">Uploading {displayName}</h2>
      )}
      
      <Loader uploadProgress={uploadProgress} />
      
      {storedDAGShards?.map((shard) => (
        renderShardInfo ? (
          <div key={shard.cid.toString()}>
            {renderShardInfo(shard)}
          </div>
        ) : (
          <p 
            className='text-xs max-w-full overflow-hidden text-ellipsis opacity-75' 
            key={shard.cid.toString()}
          >
            shard {shard.cid.toString()} ({humanFileSize(shard.size)}) uploaded
          </p>
        )
      ))}
    </div>
  )
}

export interface ErroredProps {
  error: Error | unknown
  onRetry?: () => void
  className?: string
  onError?: (error: Error) => void
}


export function Errored({ error, onRetry, className = '', onError }: ErroredProps): JSX.Element {
  useEffect(() => {
    if (error != null && onError) {
      const errorObj = error instanceof Error ? error : new Error(String(error))
      onError(errorObj)
    }
  }, [error, onError])

  const errorMessage = error instanceof Error ? error.message : String(error)

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <div className="text-red-600 text-center">
        <span className="text-2xl mb-2 block" role="img" aria-label="Warning">⚠️</span>
        <h2 className="text-lg font-semibold">Upload Failed</h2>
        <p className="mt-2">{errorMessage}</p>
      </div>
      
      <p className="text-sm opacity-75">Check the browser console for details.</p>
      
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          aria-label="Retry upload"
        >
          Retry Upload
        </button>
      )}
    </div>
  )
}

export interface DoneProps {
  file?: File
  files?: File[]
  dataCID?: AnyLink
  storedDAGShards?: CARMetadata[]
  onUploadAnother?: () => void
  renderCIDDisplay?: (cid: string) => ReactNode
  className?: string
}


export function Done({
  file,
  files,
  dataCID,
  onUploadAnother,
  renderCIDDisplay,
  className = ''
}: DoneProps): JSX.Element {
  const [, { setFile, setFiles }] = useUploader()
  const cid: string = dataCID?.toString() ?? ''
  
  const handleUploadAnother = () => {
    if (onUploadAnother) {
      onUploadAnother()
    } else {
      setFile(undefined)
      setFiles(undefined)
    }
  }

  const displayName = files && files.length > 1 
    ? `${files.length} files` 
    : file?.name || 'File'

  return (
    <div className={`flex flex-col items-center w-full gap-4 ${className}`}>
      <div className="text-green-600 text-center">
        <span className="text-2xl mb-2 block" role="img" aria-label="Success">✅</span>
        <h2 className="text-xl font-semibold">Upload Complete</h2>
        <p className="text-sm mt-2 opacity-75">{displayName} uploaded successfully</p>
      </div>
      
      {renderCIDDisplay ? (
        renderCIDDisplay(cid)
      ) : (
        <div className="text-center">
          <p className="text-sm font-semibold mb-1">Content ID:</p>
          <code className='font-mono text-xs max-w-full overflow-hidden block text-ellipsis'>
            {cid}
          </code>
        </div>
      )}
      
      <button
        onClick={handleUploadAnother}
        className='px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors'
        aria-label="Upload another file"
      >
        Upload Another
      </button>
    </div>
  )
}

export interface FileIconProps {
  file: File
  className?: string
}


export function FileIcon({ file, className = '' }: FileIconProps): JSX.Element {
  const label = pickFileIconLabel(file)
  
  return (
    <div 
      className={`w-12 h-12 py-0.5 flex flex-col justify-center items-center bg-gray-200 text-black text-xs uppercase text-center rounded ${className}`}
      title={file.type || 'Unknown type'}
      aria-label={`File type: ${label}`}
    >
      {label}
    </div>
  )
}

export interface FileDisplayProps {
  file: File
  className?: string
  showSize?: boolean
}


export function FileDisplay({ file, className = '', showSize = true }: FileDisplayProps): JSX.Element {
  return (
    <div className={`flex flex-row gap-4 ${className}`}>
      <FileIcon file={file} />
      <div className='flex flex-col justify-around'>
        <span className='text-sm font-medium'>{file.name}</span>
        {showSize && (
          <span className='text-xs opacity-50 font-mono'>
            {humanFileSize(file.size)}
          </span>
        )}
      </div>
    </div>
  )
}

function pickFileIconLabel(file: File): string {
  const type = file.type.split('/')
  if (type.length === 0 || type.at(0) === '') {
    const ext = file.name.split('.').at(-1)
    if (ext !== undefined && ext.length < 5) {
      return ext.toUpperCase()
    }
    return 'DATA'
  }
  if (type.at(0) === 'image') {
    const format = type.at(-1)?.toUpperCase()
    return format && format.length < 5 ? format : 'IMG'
  }
  const category = type.at(0)?.toUpperCase()
  return category && category.length < 5 ? category : 'FILE'
}

export function humanFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`
}

export interface UploaderConsoleProps {
  onError?: (error: Error) => void
  className?: string
  renderUploading?: (props: UploadingProps) => ReactNode
  renderError?: (props: ErroredProps) => ReactNode
  renderDone?: (props: DoneProps) => ReactNode
}


export function UploaderConsole({
  onError,
  className = '',
  renderUploading,
  renderError,
  renderDone
}: UploaderConsoleProps): JSX.Element | null {
  const [{ status, file, files, error, dataCID, storedDAGShards, uploadProgress }] = useUploader()
  
  const uploadingProps: UploadingProps = {
    file,
    files,
    storedDAGShards,
    uploadProgress
  }
  
  const errorProps: ErroredProps = {
    error: error as Error,
    onError
  }
  
  const doneProps: DoneProps = {
    file,
    files,
    dataCID,
    storedDAGShards
  }

  switch (status) {
    case 'uploading':
      return renderUploading ? (
        <>{renderUploading(uploadingProps)}</>
      ) : (
        <Uploading {...uploadingProps} className={className} />
      )
    
    case 'failed':
      return renderError ? (
        <>{renderError(errorProps)}</>
      ) : (
        <Errored {...errorProps} className={className} />
      )
    
    case 'succeeded':
      return renderDone ? (
        <>{renderDone(doneProps)}</>
      ) : (
        <Done {...doneProps} className={className} />
      )
    
    default:
      return null
  }
}

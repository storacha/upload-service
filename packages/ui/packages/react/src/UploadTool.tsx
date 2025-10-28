import type {
  ProgressStatus,
  CARMetadata,
  AnyLink
} from '@storacha/ui-core'
import { useEffect, useState, CSSProperties } from 'react'
import {
  UploadStatus,
  Uploader as W3Uploader,
  WrapInDirectoryCheckbox,
  useUploader,
  OnUploadComplete,
  UploadProgress
} from './Uploader.js'

// Default styling that mimics the console design
const defaultStyles = {
  container: {
    maxWidth: '56rem',
    border: '2px solid #E91315',
    backgroundColor: 'white',
    padding: '1.25rem',
    borderRadius: '1rem',
  } as CSSProperties,
  heading: {
    fontSize: '0.875rem',
    fontWeight: '700',
    textTransform: 'uppercase' as const,
    marginBottom: '0.75rem',
    color: '#000',
  } as CSSProperties,
  radioGroup: {
    display: 'flex',
    flexDirection: 'row' as const,
    alignItems: 'center',
    marginBottom: '1.25rem',
  } as CSSProperties,
  radioLabel: {
    marginRight: '1rem',
    cursor: 'pointer',
  } as CSSProperties,
  dropZone: {
    position: 'relative' as const,
    height: '20rem',
    marginBottom: '1.25rem',
    padding: '2rem',
    borderRadius: '0.375rem',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '2px dashed #000',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center' as const,
    transition: 'border-color 0.2s',
  } as CSSProperties,
  dropZoneHover: {
    borderColor: '#E91315',
  } as CSSProperties,
  fileIcon: {
    width: '3rem',
    height: '3rem',
    padding: '0.125rem',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EFE3F3',
    color: '#000',
    fontSize: '0.75rem',
    textTransform: 'uppercase' as const,
    textAlign: 'center' as const,
    borderRadius: '0.25rem',
    marginRight: '1rem',
  } as CSSProperties,
  button: {
    display: 'inline-block',
    backgroundColor: '#E91315',
    border: '1px solid #E91315',
    color: 'white',
    textTransform: 'uppercase' as const,
    fontSize: '0.875rem',
    padding: '0.5rem 1.5rem',
    borderRadius: '9999px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  } as CSSProperties,
  buttonHover: {
    backgroundColor: 'white',
    color: '#E91315',
  } as CSSProperties,
  progressBar: {
    position: 'relative' as const,
    width: '20rem',
    height: '1rem',
    border: '1px solid white',
  } as CSSProperties,
  progressFill: {
    backgroundColor: 'white',
    height: '100%',
  } as CSSProperties,
  explainSection: {
    display: 'flex',
    flexDirection: 'row' as const,
    gap: '1rem',
    marginTop: '1rem',
  } as CSSProperties,
  explainItem: {
    flex: 1,
  } as CSSProperties,
  explainTitle: {
    fontSize: '0.875rem',
    fontWeight: '600',
    marginBottom: '0.5rem',
  } as CSSProperties,
  explainText: {
    fontSize: '0.75rem',
    lineHeight: '1.5',
  } as CSSProperties,
}

function StatusLoader({ progressStatus }: { progressStatus: ProgressStatus }) {
  const { total, loaded, lengthComputable } = progressStatus
  if (lengthComputable) {
    const percentComplete = Math.floor((loaded / total) * 100)
    return (
      <div style={defaultStyles.progressBar}>
        <div style={{ ...defaultStyles.progressFill, width: `${percentComplete}%` }} />
      </div>
    )
  } else {
    return <span>Loading...</span>
  }
}

function Loader({ uploadProgress }: { uploadProgress: UploadProgress }): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', margin: '0.5rem 0' }}>
      {Object.values(uploadProgress).map(
        (status: ProgressStatus) => <StatusLoader progressStatus={status} key={status.url} />
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
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
    <h2 style={defaultStyles.heading}>Uploading {file?.name}</h2>
    <Loader uploadProgress={uploadProgress} />
    {storedDAGShards?.map(({ cid, size }) => (
      <p style={{ fontSize: '0.75rem', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }} key={cid.toString()}>
        shard {cid.toString()} ({humanFileSize(size)}) uploaded
      </p>
    ))}
  </div>
)

export const Errored = ({ error }: { error: any }): JSX.Element => {
  useEffect(() => {
    if (error != null) {
      // eslint-disable-next-line no-console
      console.error(new Error(`Uploader Error: ${error.message}`, { cause: error }))
    }
  }, [error])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h1>Error: failed to upload file: {error.message}</h1>
      <p>Check the browser console for details.</p>
    </div>
  )
}

interface DoneProps {
  file?: File
  dataCID?: AnyLink
  storedDAGShards?: CARMetadata[]
  gatewayUrl?: string
}

export const Done = ({ dataCID, gatewayUrl = 'https://w3s.link/ipfs' }: DoneProps): JSX.Element => {
  const [, { setFile }] = useUploader()
  const cid: string = dataCID?.toString() ?? ''
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <h2 style={defaultStyles.heading}>Uploaded</h2>
      <a
        style={{ 
          fontFamily: 'monospace', 
          fontSize: '0.75rem', 
          maxWidth: '100%', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: '#0176CE',
          textDecoration: 'none',
        }}
        href={`${gatewayUrl}/${cid}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {cid}
      </a>
      <div style={{ margin: '1rem 0' }}>
        <button
          style={{
            ...defaultStyles.button,
            ...(isHovered ? defaultStyles.buttonHover : {})
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
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

function uploadPrompt(uploadType: UploadType) {
  switch (uploadType) {
    case UploadType.File:
      return 'Drag File or Click to Browse'
    case UploadType.Directory:
      return 'Drag Directory or Click to Browse'
    case UploadType.CAR:
      return 'Drag CAR or Click to Browse'
  }
}

function pickFileIconLabel(file: File): string | undefined {
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

function humanFileSize(bytes: number): string {
  const size = (bytes / (1024 * 1024)).toFixed(2)
  return `${size} MiB`
}

const UploaderContents = (): JSX.Element => {
  const [{ status, file }] = useUploader()
  const [isHovered, setIsHovered] = useState(false)
  const hasFile = file !== undefined
  
  if (status === UploadStatus.Idle) {
    return hasFile ? (
      <>
        <div style={{ display: 'flex', flexDirection: 'row' }}>
          <div style={defaultStyles.fileIcon} title={file.type}>
            {pickFileIconLabel(file)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around' }}>
            <span style={{ fontSize: '0.875rem' }}>{file.name}</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.5, fontFamily: 'monospace' }}>
              {humanFileSize(file.size)}
            </span>
          </div>
        </div>
        <div style={{ padding: '1rem' }}>
          <button
            type="submit"
            style={{
              ...defaultStyles.button,
              ...(isHovered ? defaultStyles.buttonHover : {})
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            disabled={file === undefined}
          >
            ▲ Start Upload
          </button>
        </div>
      </>
    ) : <></>
  } else {
    return <UploaderConsole />
  }
}

const UploaderConsole = (): JSX.Element => {
  const [{ status, file, error, dataCID, storedDAGShards, uploadProgress }] = useUploader()

  switch (status) {
    case UploadStatus.Uploading:
      return <Uploading file={file} storedDAGShards={storedDAGShards} uploadProgress={uploadProgress} />
    case UploadStatus.Succeeded:
      return <Done file={file} dataCID={dataCID} storedDAGShards={storedDAGShards} />
    case UploadStatus.Failed:
      return <Errored error={error} />
    default:
      return <></>
  }
}

interface UploadToolFormProps {
  space?: any
  showTypeSelector?: boolean
  showOptions?: boolean
  showExplain?: boolean
  gatewayUrl?: string
  styles?: {
    container?: CSSProperties
    heading?: CSSProperties
    dropZone?: CSSProperties
    button?: CSSProperties
  }
}

const UploadToolForm = ({ 
  space,
  showTypeSelector = true,
  showOptions = true,
  showExplain = true,
  gatewayUrl,
  styles = {}
}: UploadToolFormProps): JSX.Element => {
  const [{ file }, { setUploadAsCAR, setKmsConfig }] = useUploader()
  const [allowDirectory, setAllowDirectory] = useState(false)
  const [uploadType, setUploadType] = useState(UploadType.File)
  const [isDropZoneHovered, setIsDropZoneHovered] = useState(false)
  const isPrivateSpace = space?.access?.type === 'private'

  useEffect(() => {
    if (isPrivateSpace) {
      setKmsConfig({
        keyManagerServiceURL: process.env.REACT_APP_UCAN_KMS_URL as string,
        keyManagerServiceDID: process.env.REACT_APP_UCAN_KMS_DID as string,
        location: process.env.REACT_APP_UCAN_KMS_LOCATION as string,
        keyring: process.env.REACT_APP_UCAN_KMS_KEYRING as string,
        allowInsecureHttp: process.env.REACT_APP_UCAN_KMS_ALLOW_INSECURE_HTTP === 'true'
      })
    }
  }, [isPrivateSpace, setKmsConfig])

  function changeUploadType(type: UploadType) {
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
    <div style={{ ...defaultStyles.container, ...styles.container }}>
      <W3Uploader.Form>
        {!isPrivateSpace && showTypeSelector && (
          <>
            <h2 style={{ ...defaultStyles.heading, ...styles.heading }}>Type</h2>
            <div style={defaultStyles.radioGroup}>
              {[UploadType.File, UploadType.Directory, UploadType.CAR].map((type) => (
                <label key={type} style={defaultStyles.radioLabel}>
                  <input
                    type="radio"
                    checked={uploadType === type}
                    onChange={() => changeUploadType(type)}
                  />
                  {' '}{type}
                </label>
              ))}
            </div>
          </>
        )}
        <div
          style={{
            ...defaultStyles.dropZone,
            ...(isDropZoneHovered ? defaultStyles.dropZoneHover : {}),
            ...styles.dropZone
          }}
          onDragEnter={() => setIsDropZoneHovered(true)}
          onDragLeave={() => setIsDropZoneHovered(false)}
          onDrop={() => setIsDropZoneHovered(false)}
        >
          {hasFile ? '' : (
            <span style={{ marginBottom: '1.25rem', color: '#E91315' }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M7 10l5-5 5 5" />
                <path d="M12 5v10" />
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              </svg>
            </span>
          )}
          <label style={hasFile ? { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', whiteSpace: 'nowrap' } : {}}>
            File:
          </label>
          <W3Uploader.Input
            style={hasFile ? { display: 'none' } : { position: 'absolute', inset: 0, cursor: 'pointer', width: '100%', opacity: 0 }}
            allowDirectory={allowDirectory}
          />
          <UploaderContents />
          {hasFile ? '' : <span>{uploadPrompt(uploadType)}</span>}
        </div>
        {!isPrivateSpace && showOptions && uploadType === UploadType.File && (
          <>
            <h2 style={{ ...defaultStyles.heading, ...styles.heading }}>Options</h2>
            <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: '1.25rem' }}>
              <WrapInDirectoryCheckbox />
              <span style={{ fontSize: '0.875rem', marginLeft: '0.25rem' }}>Wrap In Directory</span>
            </label>
          </>
        )}
      </W3Uploader.Form>
      {showExplain && (
        <>
          <h2 style={{ ...defaultStyles.heading, ...styles.heading }}>Explain</h2>
          {isPrivateSpace ? (
            <div style={defaultStyles.explainSection}>
              <div style={defaultStyles.explainItem}>
                <h4 style={defaultStyles.explainTitle}>🔒  Private Data</h4>
                <p style={defaultStyles.explainText}>
                  Files uploaded to this space are encrypted locally and never published to Filecoin.
                </p>
              </div>
              <div style={defaultStyles.explainItem}>
                <h4 style={defaultStyles.explainTitle}>⚠️  Hot Storage Only</h4>
                <p style={defaultStyles.explainText}>
                  Once removed from hot storage, they are gone forever and cannot be recovered.
                </p>
              </div>
            </div>
          ) : (
            <div style={defaultStyles.explainSection}>
              <div style={defaultStyles.explainItem}>
                <h4 style={defaultStyles.explainTitle}>🌎  Public Data</h4>
                <p style={defaultStyles.explainText}>
                  All data uploaded here will be available to anyone who requests it using the correct CID.
                  Do not upload any private or sensitive information in an unencrypted form.
                </p>
              </div>
              <div style={defaultStyles.explainItem}>
                <h4 style={defaultStyles.explainTitle}>♾️  Permanent Data</h4>
                <p style={defaultStyles.explainText}>
                  Removing files will remove them from the file listing for your account, but that
                  doesn't prevent nodes on the decentralized storage network from retaining copies of the data
                  indefinitely. Do not use this service for data that may need to be permanently deleted in the future.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export interface UploadToolProps {
  onUploadComplete?: OnUploadComplete
  space?: any
  showTypeSelector?: boolean
  showOptions?: boolean
  showExplain?: boolean
  gatewayUrl?: string
  styles?: {
    container?: CSSProperties
    heading?: CSSProperties
    dropZone?: CSSProperties
    button?: CSSProperties
  }
}

/**
 * UploadTool - A complete, styled upload component for Storacha
 * 
 * This component provides a full-featured upload interface with:
 * - Type selection (File, Directory, CAR)
 * - Drag and drop support
 * - Upload progress display
 * - Success state with "Upload Another" option
 * - Configurable options and styling
 * 
 * @example
 * ```tsx
 * <Provider>
 *   <Authenticator>
 *     <UploadTool
 *       onUploadComplete={({ dataCID }) => console.log('Uploaded:', dataCID)}
 *       showTypeSelector={true}
 *       showOptions={true}
 *       showExplain={true}
 *     />
 *   </Authenticator>
 * </Provider>
 * ```
 */
export const UploadTool = ({
  onUploadComplete,
  space,
  showTypeSelector = true,
  showOptions = true,
  showExplain = true,
  gatewayUrl,
  styles
}: UploadToolProps): JSX.Element => {
  return (
    <W3Uploader
      as='div'
      onUploadComplete={onUploadComplete}
      defaultWrapInDirectory={true}
    >
      <UploadToolForm
        space={space}
        showTypeSelector={showTypeSelector}
        showOptions={showOptions}
        showExplain={showExplain}
        gatewayUrl={gatewayUrl}
        styles={styles}
      />
    </W3Uploader>
  )
}


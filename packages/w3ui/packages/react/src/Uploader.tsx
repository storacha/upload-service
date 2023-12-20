import type { As, Component, Props, Options, HTMLProps } from 'ariakit-react-utils'
import type { ChangeEvent } from 'react'
import type { AnyLink, CARMetadata, ProgressStatus } from '@w3ui/core'

import React, {
  useContext,
  useMemo,
  useCallback,
  createContext,
  useState,
  Fragment
} from 'react'
import { createComponent, createElement } from 'ariakit-react-utils'
import { useW3 } from './providers/Provider.jsx'

export type UploadProgress = Record<string, ProgressStatus>

export enum UploadStatus {
  Idle = 'idle',
  Uploading = 'uploading',
  Failed = 'failed',
  Succeeded = 'succeeded',
}

export interface UploaderContextState {
  /**
   * A string indicating the status of this component - can be 'uploading', 'done' or ''.
   */
  status: UploadStatus
  /**
   * Error thrown by upload process.
   */
  error?: Error
  /**
   * a File to be uploaded
   */
  file?: File
  /**
   * Files to be uploaded
   */
  files?: File[]
  /**
   * A callback that can be passed to an `onSubmit` handler to
   * upload `file` to web3.storage via the w3up API
   */
  handleUploadSubmit?: (e: Event) => Promise<void>
  /**
   * The CID of a successful upload
   */
  dataCID?: AnyLink
  /**
   * Shards of a DAG uploaded to web3.storage
   */
  storedDAGShards: CARMetadata[]
  /**
   * Shard upload progress information.
   */
  uploadProgress: UploadProgress
  /**
   * Should single files be wrapped in a directory?
   */
  wrapInDirectory: boolean
}

export interface UploaderContextActions {
  /**
   * Set a file to be uploaded to web3.storage. The file will be uploaded
   * when `handleUploadSubmit` is called.
   */
  setFile: (file?: File) => void
  /**
   * Set files to be uploaded to web3.storage. The file will be uploaded
   * when `handleUploadSubmit` is called.
   */
  setFiles: (file?: File[]) => void
  /**
   * Set whether single files should be wrapped in a directory before upload.
   */
  setWrapInDirectory: (wrap: boolean) => void
}

export type UploaderContextValue = [
  state: UploaderContextState,
  actions: UploaderContextActions
]

export const UploaderContextDefaultValue: UploaderContextValue = [
  {
    status: UploadStatus.Idle,
    storedDAGShards: [],
    uploadProgress: {},
    wrapInDirectory: false
  },
  {
    setFile: () => {
      throw new Error('missing set file function')
    },
    setFiles: () => {
      throw new Error('missing set files function')
    },
    setWrapInDirectory: () => {
      throw new Error('missing set wrap in directory function')
    }
  }
]

export const UploaderContext = createContext<UploaderContextValue>(UploaderContextDefaultValue)

interface OnUploadCompleteProps {
  file?: File
  files?: File[]
  dataCID?: AnyLink
}

export type OnUploadComplete = (props: OnUploadCompleteProps) => void

export type UploaderRootOptions<T extends As = typeof Fragment> = Options<T> & {
  onUploadComplete?: OnUploadComplete
  defaultWrapInDirectory?: boolean
}
export type UploaderRootProps<T extends As = typeof Fragment> = Props<UploaderRootOptions<T>>

/**
 * Top level component of the headless Uploader.
 *
 * Designed to be used with Uploader.Form and Uploader.Input
 * to easily create a custom component for uploading files to
 * web3.storage.
 */
export const UploaderRoot: Component<UploaderRootProps> = createComponent(
  ({ onUploadComplete, defaultWrapInDirectory = false, ...props }) => {
    const [{ client }] = useW3()
    const [files, setFiles] = useState<File[]>()
    const file = files?.[0]
    const setFile = (file: File | undefined): void => { (file != null) && setFiles([file]) }
    const [wrapInDirectory, setWrapInDirectory] = useState(defaultWrapInDirectory)
    const [dataCID, setDataCID] = useState<AnyLink>()
    const [status, setStatus] = useState(UploadStatus.Idle)
    const [error, setError] = useState()
    const [storedDAGShards, setStoredDAGShards] = useState<UploaderContextState['storedDAGShards']>([])
    const [uploadProgress, setUploadProgress] = useState<UploadProgress>({})

    const setFilesAndReset = (files?: File[]): void => {
      setFiles(files)
      setStatus(UploadStatus.Idle)
    }

    const handleUploadSubmit = async (e: Event): Promise<void> => {
      e.preventDefault()
      // file !== undefined should be unecessary but is here to make tsc happy
      if ((client !== undefined) && (files !== undefined) && (file !== undefined)) {
        try {
          setError(undefined)
          setStatus(UploadStatus.Uploading)
          const storedShards: CARMetadata[] = []
          setStoredDAGShards(storedShards)
          const uploadOptions = {
            onShardStored (meta: CARMetadata) {
              storedShards.push(meta)
              setStoredDAGShards([...storedShards])
            },
            onUploadProgress (status: ProgressStatus) {
              setUploadProgress(statuses => ({ ...statuses, [status.url ?? '']: status }))
            }
          }
          const cid = files.length > 1
            ? await client.uploadDirectory(files, uploadOptions)
            : (wrapInDirectory
                ? await client.uploadDirectory(files, uploadOptions)
                : await client.uploadFile(file, uploadOptions))

          setDataCID(cid)
          setStatus(UploadStatus.Succeeded)
          if (onUploadComplete !== undefined) {
            onUploadComplete({ file, files, dataCID: cid })
          }
        } catch (error_: any) {
          setError(error_)
          setStatus(UploadStatus.Failed)
        }
      }
    }

    const uploaderContextValue =
      useMemo<UploaderContextValue>(
        () => [
          {
            file,
            files,
            dataCID,
            status,
            error,
            handleUploadSubmit,
            storedDAGShards,
            uploadProgress,
            wrapInDirectory
          },
          {
            setFile: (file?: File) => { setFilesAndReset((file === undefined) ? file : [file]) },
            setFiles: setFilesAndReset,
            setWrapInDirectory
          }
        ],
        [
          file,
          dataCID,
          status,
          error,
          handleUploadSubmit,
          setFile
        ]
      )

    return (
      <UploaderContext.Provider value={uploaderContextValue}>
        {createElement(Fragment, props)}
      </UploaderContext.Provider>
    )
  }
)

export type UploaderInputOptions<T extends As = 'input'> = Options<T>
export type UploaderInputProps<T extends As = 'input'> = Props<UploaderInputOptions<T>> & {
  allowDirectory?: boolean
}

/**
 * Input component for the headless Uploader.
 *
 * A file `input` designed to work with `Uploader`. Any passed props will
 * be passed along to the `input` component.
 */
export const UploaderInput: Component<UploaderInputProps> = createComponent(({ allowDirectory, ...props }) => {
  const [, { setFiles }] = useContext(UploaderContext)
  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files != null) {
        setFiles([...e.target.files])
      }
    },
    [setFiles]
  )
  const inputProps: HTMLProps<Options> = { ...props, type: 'file', onChange }
  if (allowDirectory === true) {
    // this attribute behaves weirdly - having it either be the string true or not
    // set at all seems to be the only way to get it working the way you'd expect
    inputProps.webkitdirectory = 'true'
  }
  return createElement('input', inputProps)
})

export type WrapInDirectoryCheckboxOptions<T extends As = 'input'> = Options<T>
export type WrapInDirectoryCheckboxProps<T extends As = 'input'> = Props<WrapInDirectoryCheckboxOptions<T>>

/**
 * A checkbox that controls whether the uploader will wrap single files in a directory.
 */
export const WrapInDirectoryCheckbox: Component<WrapInDirectoryCheckboxProps> = createComponent((props) => {
  const [{ wrapInDirectory }, { setWrapInDirectory }] = useContext(UploaderContext)
  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setWrapInDirectory(e.target.checked)
    },
    []
  )
  return createElement('input', { ...props, type: 'checkbox', value: wrapInDirectory, onChange })
})

export type UploaderFormOptions<T extends As = 'form'> = Options<T>
export type UploaderFormProps<T extends As = 'form'> = Props<UploaderFormOptions<T>>

/**
 * Form component for the headless Uploader.
 *
 * A `form` designed to work with `Uploader`. Any passed props will
 * be passed along to the `form` component.
 */
export const UploaderForm: Component<UploaderFormProps> = createComponent((props) => {
  const [{ handleUploadSubmit }] = useContext(UploaderContext)
  return createElement('form', { ...props, onSubmit: handleUploadSubmit })
})

/**
 * Use the scoped uploader context state from a parent `Uploader`.
 */
export function useUploader (): UploaderContextValue {
  return useContext(UploaderContext)
}

export const Uploader = Object.assign(UploaderRoot, { Input: UploaderInput, Form: UploaderForm })

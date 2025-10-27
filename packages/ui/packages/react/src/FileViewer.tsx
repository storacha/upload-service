import type { As, Component, Props, Options } from 'ariakit-react-utils'
import type { Space, CARLink } from '@storacha/ui-core'
import type { Link } from 'multiformats/link'

import React, {
  Fragment,
  useState,
  createContext,
  useContext,
  useCallback,
  useMemo,
  useEffect,
} from 'react'
import { createComponent, createElement } from 'ariakit-react-utils'
import { useW3, ContextState, ContextActions } from './providers/Provider.js'

export interface FileDetails {
  link: Link
  size?: number
  pieceCid?: string
  aggregateCid?: string
  deals?: Array<{
    provider: string
    dealID: string
  }>
}

export type FileViewerContextState = ContextState & {
  /**
   * The space the file belongs to
   */
  space?: Space
  /**
   * The file/shard link being viewed
   */
  file?: Link
  /**
   * Details about the file
   */
  fileDetails?: FileDetails
  /**
   * Is the file details loading?
   */
  loading: boolean
  /**
   * Error message if loading failed
   */
  error?: string
}

export type FileViewerContextActions = ContextActions & {
  /**
   * Load file details
   */
  loadFileDetails: (file: Link) => Promise<void>
  /**
   * Refresh file details
   */
  refresh: () => Promise<void>
}

export type FileViewerContextValue = [
  state: FileViewerContextState,
  actions: FileViewerContextActions
]

export const FileViewerContextDefaultValue: FileViewerContextValue = [
  {
    accounts: [],
    spaces: [],
    loading: false,
  },
  {
    loadFileDetails: async () => {
      throw new Error('missing loadFileDetails function')
    },
    refresh: async () => {
      throw new Error('missing refresh function')
    },
    logout: () => {
      throw new Error('missing logout function')
    },
  },
]

export const FileViewerContext = createContext<FileViewerContextValue>(
  FileViewerContextDefaultValue
)

export type FileViewerRootOptions<T extends As = typeof Fragment> = Options<T> & {
  /**
   * The space the file belongs to
   */
  space: Space
  /**
   * The file/shard link to view
   */
  file: Link
}

export type FileViewerRootProps<T extends As = typeof Fragment> = Props<
  FileViewerRootOptions<T>
>

/**
 * Top level component of the headless FileViewer.
 *
 * Must be used inside a w3ui Provider.
 *
 * Designed to display details about a file or shard.
 */
export const FileViewerRoot: Component<FileViewerRootProps> =
  createComponent((props) => {
    const [state, actions] = useW3()
    const { client } = state
    const { space, file } = props

    const [fileDetails, setFileDetails] = useState<FileDetails | undefined>()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | undefined>()

    const loadFileDetails = useCallback(
      async (fileLink: Link) => {
        if (!client || !space) return

        try {
          setLoading(true)
          setError(undefined)

          // Ensure the space is the current space
          if (client.currentSpace()?.did() !== space.did()) {
            await client.setCurrentSpace(space.did())
          }

          const details: FileDetails = {
            link: fileLink,
          }

          // Try to get file size from store/blob
          try {
            const isCARLink = (link: Link): link is CARLink => {
              // CAR codec is 0x0202
              return link.code === 0x0202
            }

            if (isCARLink(fileLink)) {
              try {
                const blobResult = await client.capability.blob.get(fileLink.multihash)
                if (blobResult.ok) {
                  details.size = blobResult.ok.blob.size
                }
              } catch (blobErr) {
                // Could not fetch blob size
                console.warn('Could not fetch file size:', blobErr)
              }
            }
          } catch (err) {
            console.warn('Error fetching file details:', err)
          }

          setFileDetails(details)
        } catch (err: any) {
          const errorMsg = err instanceof Error ? err.message : 'Failed to load file details'
          setError(errorMsg)
          console.error('Failed to load file details:', err)
        } finally {
          setLoading(false)
        }
      },
      [client, space]
    )

    const refresh = useCallback(async () => {
      if (file) {
        await loadFileDetails(file)
      }
    }, [file, loadFileDetails])

    // Load file details on mount and when file changes
    useEffect(() => {
      if (file) {
        loadFileDetails(file)
      }
    }, [file, space.did()])

    const value = useMemo<FileViewerContextValue>(
      () => [
        {
          ...state,
          space,
          file,
          fileDetails,
          loading,
          error,
        },
        {
          ...actions,
          loadFileDetails,
          refresh,
        },
      ],
      [state, actions, space, file, fileDetails, loading, error, loadFileDetails, refresh]
    )

    return (
      <FileViewerContext.Provider value={value}>
        {createElement(Fragment, props)}
      </FileViewerContext.Provider>
    )
  })

export type FileViewerDetailsOptions<T extends As = 'div'> = Options<T>
export type FileViewerDetailsProps<T extends As = 'div'> = Props<
  FileViewerDetailsOptions<T>
> & {
  /**
   * Custom render function for file details
   */
  renderDetails?: (details: FileDetails) => React.ReactNode
}

/**
 * Details component for the headless FileViewer.
 *
 * A `div` that displays file details. Any passed props will
 * be passed along to the `div` component.
 */
export const FileViewerDetails: Component<FileViewerDetailsProps> =
  createComponent((props) => {
    const [{ fileDetails, loading }] = useFileViewer()
    const { renderDetails, ...restProps } = props

    if (loading) {
      return createElement('div', {
        ...restProps,
        children: 'Loading...',
      })
    }

    if (!fileDetails) {
      return createElement('div', { ...restProps, style: { display: 'none' } })
    }

    const defaultRender = (details: FileDetails) => (
      <div>
        <div>
          <strong>CID:</strong> {details.link.toString()}
        </div>
        {details.size && (
          <div>
            <strong>Size:</strong> {details.size} bytes
          </div>
        )}
        {details.pieceCid && (
          <div>
            <strong>Piece CID:</strong> {details.pieceCid}
          </div>
        )}
        {details.aggregateCid && (
          <div>
            <strong>Aggregate CID:</strong> {details.aggregateCid}
          </div>
        )}
        {details.deals && details.deals.length > 0 && (
          <div>
            <strong>Storage Providers:</strong>
            <ul>
              {details.deals.map((deal, i) => (
                <li key={i}>
                  {deal.provider} - Deal {deal.dealID}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )

    const renderFn = renderDetails || defaultRender

    return createElement('div', {
      ...restProps,
      children: renderFn(fileDetails),
    })
  })

export type FileViewerCIDOptions<T extends As = 'div'> = Options<T>
export type FileViewerCIDProps<T extends As = 'div'> = Props<
  FileViewerCIDOptions<T>
>

/**
 * CID display component for the headless FileViewer.
 *
 * A `div` that displays the file's CID.
 */
export const FileViewerCID: Component<FileViewerCIDProps> =
  createComponent((props) => {
    const [{ fileDetails, loading }] = useFileViewer()

    if (loading) return createElement('div', { ...props, style: { display: 'none' } })

    return createElement('div', {
      ...props,
      children: fileDetails?.link.toString() || '',
    })
  })

export type FileViewerSizeOptions<T extends As = 'div'> = Options<T>
export type FileViewerSizeProps<T extends As = 'div'> = Props<
  FileViewerSizeOptions<T>
>

/**
 * Size display component for the headless FileViewer.
 *
 * A `div` that displays the file's size.
 */
export const FileViewerSize: Component<FileViewerSizeProps> =
  createComponent((props) => {
    const [{ fileDetails, loading }] = useFileViewer()

    if (loading || !fileDetails?.size) return createElement('div', { ...props, style: { display: 'none' } })

    return createElement('div', {
      ...props,
      children: `${fileDetails.size} bytes`,
    })
  })

export type FileViewerErrorOptions<T extends As = 'div'> = Options<T>
export type FileViewerErrorProps<T extends As = 'div'> = Props<
  FileViewerErrorOptions<T>
>

/**
 * Error display component for the headless FileViewer.
 *
 * A `div` that displays error messages.
 */
export const FileViewerError: Component<FileViewerErrorProps> =
  createComponent((props) => {
    const [{ error }] = useFileViewer()

    if (!error) return createElement('div', { ...props, style: { display: 'none' } })

    return createElement('div', {
      ...props,
      role: 'alert',
      children: error,
    })
  })

export type FileViewerLoadingOptions<T extends As = 'div'> = Options<T>
export type FileViewerLoadingProps<T extends As = 'div'> = Props<
  FileViewerLoadingOptions<T>
>

/**
 * Loading state component for the headless FileViewer.
 *
 * A `div` that is displayed while file details are loading.
 */
export const FileViewerLoading: Component<FileViewerLoadingProps> =
  createComponent((props) => {
    const [{ loading }] = useFileViewer()

    if (!loading) return createElement('div', { ...props, style: { display: 'none' } })

    return createElement('div', props)
  })

/**
 * Use the scoped file viewer context state from a parent `FileViewer`.
 */
export function useFileViewer(): FileViewerContextValue {
  return useContext(FileViewerContext)
}

/**
 * Custom hook for viewing file details without UI
 */
export function useFileDetails(space: Space, file: Link) {
  const [{ client }] = useW3()
  const [fileDetails, setFileDetails] = useState<FileDetails | undefined>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>()

  const loadDetails = useCallback(async () => {
    if (!client || !space || !file) return

    try {
      setLoading(true)
      setError(undefined)

      if (client.currentSpace()?.did() !== space.did()) {
        await client.setCurrentSpace(space.did())
      }

      const details: FileDetails = {
        link: file,
      }

      try {
        const isCARLink = (link: Link): link is CARLink => {
          return link.code === 0x0202
        }

        if (isCARLink(file)) {
          try {
            const blobResult = await client.capability.blob.get(file.multihash)
            if (blobResult.ok) {
              details.size = blobResult.ok.blob.size
            }
          } catch (err) {
            console.warn('Error fetching blob details:', err)
          }
        }
      } catch (err) {
        console.warn('Error fetching file details:', err)
      }

      setFileDetails(details)
    } catch (err: any) {
      const error = err instanceof Error ? err : new Error('Failed to load file details')
      setError(error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [client, space, file])

  useEffect(() => {
    loadDetails()
  }, [file])

  return {
    fileDetails,
    loading,
    error,
    loadDetails,
  }
}

export const FileViewer = Object.assign(FileViewerRoot, {
  Details: FileViewerDetails,
  CID: FileViewerCID,
  Size: FileViewerSize,
  Error: FileViewerError,
  Loading: FileViewerLoading,
})


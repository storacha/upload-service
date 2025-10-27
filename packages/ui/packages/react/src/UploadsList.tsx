import type { As, Component, Props, Options } from 'ariakit-react-utils'
import type { Space, UnknownLink, UploadListSuccess } from '@storacha/ui-core'

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

export type Upload = UploadListSuccess['results'][number]

export type UploadsListContextState = ContextState & {
  /**
   * The space whose uploads are being listed
   */
  space?: Space
  /**
   * List of uploads in the current page
   */
  uploads: Upload[]
  /**
   * Is the list currently loading?
   */
  loading: boolean
  /**
   * Is the list being revalidated?
   */
  validating: boolean
  /**
   * Error message if fetching failed
   */
  error?: string
  /**
   * Can navigate to next page?
   */
  hasNext: boolean
  /**
   * Can navigate to previous page?
   */
  hasPrev: boolean
  /**
   * Current page cursor
   */
  cursor?: string
}

export type UploadsListContextActions = ContextActions & {
  /**
   * Load next page of uploads
   */
  loadNext: () => void
  /**
   * Load previous page of uploads
   */
  loadPrev: () => void
  /**
   * Refresh the current page
   */
  refresh: () => void
  /**
   * Select an upload by its root CID
   */
  selectUpload: (root: UnknownLink) => void
}

export type UploadsListContextValue = [
  state: UploadsListContextState,
  actions: UploadsListContextActions
]

export const UploadsListContextDefaultValue: UploadsListContextValue = [
  {
    accounts: [],
    spaces: [],
    uploads: [],
    loading: false,
    validating: false,
    hasNext: false,
    hasPrev: false,
  },
  {
    loadNext: () => {
      throw new Error('missing loadNext function')
    },
    loadPrev: () => {
      throw new Error('missing loadPrev function')
    },
    refresh: () => {
      throw new Error('missing refresh function')
    },
    selectUpload: () => {
      throw new Error('missing selectUpload function')
    },
    logout: () => {
      throw new Error('missing logout function')
    },
  },
]

export const UploadsListContext = createContext<UploadsListContextValue>(
  UploadsListContextDefaultValue
)

export type UploadsListRootOptions<T extends As = typeof Fragment> = Options<T> & {
  /**
   * The space to list uploads from
   */
  space: Space
  /**
   * Number of uploads per page
   */
  size?: number
  /**
   * Callback when an upload is selected
   */
  onUploadSelected?: (root: UnknownLink) => void
}

export type UploadsListRootProps<T extends As = typeof Fragment> = Props<
  UploadsListRootOptions<T>
>

/**
 * Top level component of the headless UploadsList.
 *
 * Must be used inside a w3ui Provider.
 *
 * Designed to be used to list and paginate through uploads in a space.
 */
export const UploadsListRoot: Component<UploadsListRootProps> =
  createComponent((props) => {
    const [state, actions] = useW3()
    const { client } = state
    const { space, size = 25, onUploadSelected } = props

    const [uploads, setUploads] = useState<Upload[]>([])
    const [loading, setLoading] = useState(false)
    const [validating, setValidating] = useState(false)
    const [error, setError] = useState<string | undefined>()
    const [cursor, setCursor] = useState<string | undefined>()
    const [cursors, setCursors] = useState<string[]>([])
    const [nextCursor, setNextCursor] = useState<string | undefined>()

    const hasNext = !!nextCursor
    const hasPrev = cursors.length > 0

    const loadUploads = useCallback(
      async (newCursor?: string, isRefresh = false) => {
        if (!client || !space) return

        try {
          if (isRefresh) {
            setValidating(true)
          } else {
            setLoading(true)
          }
          setError(undefined)

          // Ensure the space is the current space
          if (client.currentSpace()?.did() !== space.did()) {
            await client.setCurrentSpace(space.did())
          }

          const result = await client.capability.upload.list({
            size,
            cursor: newCursor,
          })

          setUploads(result.results)
          setNextCursor(result.cursor)
          setCursor(newCursor)
        } catch (err: any) {
          const errorMsg = err instanceof Error ? err.message : 'Failed to load uploads'
          setError(errorMsg)
          console.error('Failed to load uploads:', err)
        } finally {
          setLoading(false)
          setValidating(false)
        }
      },
      [client, space, size]
    )

    const loadNext = useCallback(() => {
      if (nextCursor) {
        setCursors([...cursors, cursor].filter(Boolean) as string[])
        loadUploads(nextCursor)
      }
    }, [nextCursor, cursor, cursors, loadUploads])

    const loadPrev = useCallback(() => {
      if (cursors.length > 0) {
        const newCursors = [...cursors]
        const prevCursor = newCursors.pop()
        setCursors(newCursors)
        loadUploads(prevCursor)
      }
    }, [cursors, loadUploads])

    const refresh = useCallback(() => {
      loadUploads(cursor, true)
    }, [cursor, loadUploads])

    const selectUpload = useCallback(
      (root: UnknownLink) => {
        onUploadSelected?.(root)
      },
      [onUploadSelected]
    )

    // Load uploads on mount and when space changes
    useEffect(() => {
      loadUploads()
    }, [space.did()])

    const value = useMemo<UploadsListContextValue>(
      () => [
        {
          ...state,
          space,
          uploads,
          loading,
          validating,
          error,
          hasNext,
          hasPrev,
          cursor,
        },
        {
          ...actions,
          loadNext,
          loadPrev,
          refresh,
          selectUpload,
        },
      ],
      [
        state,
        actions,
        space,
        uploads,
        loading,
        validating,
        error,
        hasNext,
        hasPrev,
        cursor,
        loadNext,
        loadPrev,
        refresh,
        selectUpload,
      ]
    )

    return (
      <UploadsListContext.Provider value={value}>
        {createElement(Fragment, props)}
      </UploadsListContext.Provider>
    )
  })

export type UploadsListTableOptions<T extends As = 'table'> = Options<T>
export type UploadsListTableProps<T extends As = 'table'> = Props<
  UploadsListTableOptions<T>
> & {
  /**
   * Custom render function for table rows
   */
  renderRow?: (upload: Upload) => React.ReactNode
}

/**
 * Table component for the headless UploadsList.
 *
 * A `table` designed to display uploads. Any passed props will
 * be passed along to the `table` component.
 */
export const UploadsListTable: Component<UploadsListTableProps> =
  createComponent((props) => {
    const [{ uploads, loading }] = useUploadsList()
    const { renderRow, ...restProps } = props

    const defaultRenderRow = (upload: Upload) => (
      <tr key={upload.root.toString()}>
        <td>{upload.root.toString()}</td>
        <td>{new Date(upload.updatedAt).toLocaleString()}</td>
      </tr>
    )

    const renderFn = renderRow || defaultRenderRow

    return createElement('table', {
      ...restProps,
      style: {
        ...restProps.style,
        opacity: loading ? 0.5 : 1,
        transition: 'opacity 0.2s',
      },
      children: (
        <>
          <thead>
            <tr>
              <th>Root CID</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>{uploads.map(renderFn)}</tbody>
        </>
      ),
    })
  })

export type UploadsListItemOptions<T extends As = 'tr'> = Options<T> & {
  /**
   * The upload to render
   */
  upload: Upload
}

export type UploadsListItemProps<T extends As = 'tr'> = Props<
  UploadsListItemOptions<T>
>

/**
 * Item component for the headless UploadsList.
 *
 * A `tr` that represents a single upload row.
 */
export const UploadsListItem: Component<UploadsListItemProps> =
  createComponent((props) => {
    const { upload, ...restProps } = props
    const [, { selectUpload }] = useUploadsList()

    return createElement('tr', {
      ...restProps,
      onClick: () => selectUpload(upload.root),
      style: {
        ...restProps.style,
        cursor: 'pointer',
      },
    })
  })

export type UploadsListPaginationOptions<T extends As = 'div'> = Options<T>
export type UploadsListPaginationProps<T extends As = 'div'> = Props<
  UploadsListPaginationOptions<T>
>

/**
 * Pagination component for the headless UploadsList.
 *
 * A `div` that contains pagination controls.
 */
export const UploadsListPagination: Component<UploadsListPaginationProps> =
  createComponent((props) => {
    const [{ hasNext, hasPrev, loading }, { loadNext, loadPrev, refresh }] =
      useUploadsList()

    return createElement('div', {
      ...props,
      children: (
        <>
          <button onClick={loadPrev} disabled={!hasPrev || loading}>
            Previous
          </button>
          <button onClick={refresh} disabled={loading}>
            Refresh
          </button>
          <button onClick={loadNext} disabled={!hasNext || loading}>
            Next
          </button>
        </>
      ),
    })
  })

export type UploadsListEmptyOptions<T extends As = 'div'> = Options<T>
export type UploadsListEmptyProps<T extends As = 'div'> = Props<
  UploadsListEmptyOptions<T>
>

/**
 * Empty state component for the headless UploadsList.
 *
 * A `div` that is displayed when there are no uploads.
 */
export const UploadsListEmpty: Component<UploadsListEmptyProps> =
  createComponent((props) => {
    const [{ uploads, loading }] = useUploadsList()

    if (loading || uploads.length > 0) {
      return createElement('div', { ...props, style: { display: 'none' } })
    }

    return createElement('div', props)
  })

/**
 * Use the scoped uploads list context state from a parent `UploadsList`.
 */
export function useUploadsList(): UploadsListContextValue {
  return useContext(UploadsListContext)
}

/**
 * Custom hook for managing uploads list without UI
 */
export function useUploads(space: Space, size = 25) {
  const [{ client }] = useW3()
  const [uploads, setUploads] = useState<Upload[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>()

  const loadUploads = useCallback(
    async (cursor?: string) => {
      if (!client || !space) return

      try {
        setLoading(true)
        setError(undefined)

        if (client.currentSpace()?.did() !== space.did()) {
          await client.setCurrentSpace(space.did())
        }

        const result = await client.capability.upload.list({ size, cursor })

        setUploads(result.results)
        return result
      } catch (err: any) {
        const error = err instanceof Error ? err : new Error('Failed to load uploads')
        setError(error)
        throw error
      } finally {
        setLoading(false)
      }
    },
    [client, space, size]
  )

  return {
    uploads,
    loading,
    error,
    loadUploads,
  }
}

export const UploadsList = Object.assign(UploadsListRoot, {
  Table: UploadsListTable,
  Item: UploadsListItem,
  Pagination: UploadsListPagination,
  Empty: UploadsListEmpty,
})


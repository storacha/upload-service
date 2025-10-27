import type { As, Component, Props, Options } from 'ariakit-react-utils'
import type { Space, SpaceBlobListSuccess } from '@storacha/ui-core'

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

export type Blob = SpaceBlobListSuccess['results'][number]

export type BlobsListContextState = ContextState & {
  /**
   * The space whose blobs are being listed
   */
  space?: Space
  /**
   * List of blobs in the current page
   */
  blobs: Blob[]
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

export type BlobsListContextActions = ContextActions & {
  /**
   * Load next page of blobs
   */
  loadNext: () => void
  /**
   * Load previous page of blobs
   */
  loadPrev: () => void
  /**
   * Refresh the current page
   */
  refresh: () => void
  /**
   * Select a blob
   */
  selectBlob: (blob: Blob) => void
}

export type BlobsListContextValue = [
  state: BlobsListContextState,
  actions: BlobsListContextActions
]

export const BlobsListContextDefaultValue: BlobsListContextValue = [
  {
    accounts: [],
    spaces: [],
    blobs: [],
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
    selectBlob: () => {
      throw new Error('missing selectBlob function')
    },
    logout: () => {
      throw new Error('missing logout function')
    },
  },
]

export const BlobsListContext = createContext<BlobsListContextValue>(
  BlobsListContextDefaultValue
)

export type BlobsListRootOptions<T extends As = typeof Fragment> = Options<T> & {
  /**
   * The space to list blobs from
   */
  space: Space
  /**
   * Number of blobs per page
   */
  size?: number
  /**
   * Callback when a blob is selected
   */
  onBlobSelected?: (blob: Blob) => void
}

export type BlobsListRootProps<T extends As = typeof Fragment> = Props<
  BlobsListRootOptions<T>
>

/**
 * Top level component of the headless BlobsList.
 *
 * Must be used inside a w3ui Provider.
 *
 * Designed to be used to list and paginate through blobs in a space.
 */
export const BlobsListRoot: Component<BlobsListRootProps> =
  createComponent((props) => {
    const [state, actions] = useW3()
    const { client } = state
    const { space, size = 25, onBlobSelected } = props

    const [blobs, setBlobs] = useState<Blob[]>([])
    const [loading, setLoading] = useState(false)
    const [validating, setValidating] = useState(false)
    const [error, setError] = useState<string | undefined>()
    const [cursor, setCursor] = useState<string | undefined>()
    const [cursors, setCursors] = useState<string[]>([])
    const [nextCursor, setNextCursor] = useState<string | undefined>()

    const hasNext = !!nextCursor
    const hasPrev = cursors.length > 0

    const loadBlobs = useCallback(
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

          const result = await client.capability.blob.list({
            size,
            cursor: newCursor,
          })

          setBlobs(result.results)
          setNextCursor(result.cursor)
          setCursor(newCursor)
        } catch (err: any) {
          const errorMsg = err instanceof Error ? err.message : 'Failed to load blobs'
          setError(errorMsg)
          console.error('Failed to load blobs:', err)
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
        loadBlobs(nextCursor)
      }
    }, [nextCursor, cursor, cursors, loadBlobs])

    const loadPrev = useCallback(() => {
      if (cursors.length > 0) {
        const newCursors = [...cursors]
        const prevCursor = newCursors.pop()
        setCursors(newCursors)
        loadBlobs(prevCursor)
      }
    }, [cursors, loadBlobs])

    const refresh = useCallback(() => {
      loadBlobs(cursor, true)
    }, [cursor, loadBlobs])

    const selectBlob = useCallback(
      (blob: Blob) => {
        onBlobSelected?.(blob)
      },
      [onBlobSelected]
    )

    // Load blobs on mount and when space changes
    useEffect(() => {
      loadBlobs()
    }, [space.did()])

    const value = useMemo<BlobsListContextValue>(
      () => [
        {
          ...state,
          space,
          blobs,
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
          selectBlob,
        },
      ],
      [
        state,
        actions,
        space,
        blobs,
        loading,
        validating,
        error,
        hasNext,
        hasPrev,
        cursor,
        loadNext,
        loadPrev,
        refresh,
        selectBlob,
      ]
    )

    return (
      <BlobsListContext.Provider value={value}>
        {createElement(Fragment, props)}
      </BlobsListContext.Provider>
    )
  })

export type BlobsListTableOptions<T extends As = 'table'> = Options<T>
export type BlobsListTableProps<T extends As = 'table'> = Props<
  BlobsListTableOptions<T>
> & {
  /**
   * Custom render function for table rows
   */
  renderRow?: (blob: Blob) => React.ReactNode
}

/**
 * Table component for the headless BlobsList.
 *
 * A `table` designed to display blobs. Any passed props will
 * be passed along to the `table` component.
 */
export const BlobsListTable: Component<BlobsListTableProps> =
  createComponent((props) => {
    const [{ blobs, loading }] = useBlobsList()
    const { renderRow, ...restProps } = props

    const defaultRenderRow = (blob: Blob) => (
      <tr key={blob.blob.digest.toString()}>
        <td>{blob.blob.digest.toString()}</td>
        <td>{new Date(blob.insertedAt).toLocaleString()}</td>
        <td>{blob.blob.size}</td>
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
              <th>CID</th>
              <th>Timestamp</th>
              <th>Size</th>
            </tr>
          </thead>
          <tbody>{blobs.map(renderFn)}</tbody>
        </>
      ),
    })
  })

export type BlobsListItemOptions<T extends As = 'tr'> = Options<T> & {
  /**
   * The blob to render
   */
  blob: Blob
}

export type BlobsListItemProps<T extends As = 'tr'> = Props<
  BlobsListItemOptions<T>
>

/**
 * Item component for the headless BlobsList.
 *
 * A `tr` that represents a single blob row.
 */
export const BlobsListItem: Component<BlobsListItemProps> =
  createComponent((props) => {
    const { blob, ...restProps } = props
    const [, { selectBlob }] = useBlobsList()

    return createElement('tr', {
      ...restProps,
      onClick: () => selectBlob(blob),
      style: {
        ...restProps.style,
        cursor: 'pointer',
      },
    })
  })

export type BlobsListPaginationOptions<T extends As = 'div'> = Options<T>
export type BlobsListPaginationProps<T extends As = 'div'> = Props<
  BlobsListPaginationOptions<T>
>

/**
 * Pagination component for the headless BlobsList.
 *
 * A `div` that contains pagination controls.
 */
export const BlobsListPagination: Component<BlobsListPaginationProps> =
  createComponent((props) => {
    const [{ hasNext, hasPrev, loading }, { loadNext, loadPrev, refresh }] =
      useBlobsList()

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

export type BlobsListEmptyOptions<T extends As = 'div'> = Options<T>
export type BlobsListEmptyProps<T extends As = 'div'> = Props<
  BlobsListEmptyOptions<T>
>

/**
 * Empty state component for the headless BlobsList.
 *
 * A `div` that is displayed when there are no blobs.
 */
export const BlobsListEmpty: Component<BlobsListEmptyProps> =
  createComponent((props) => {
    const [{ blobs, loading }] = useBlobsList()

    if (loading || blobs.length > 0) {
      return createElement('div', { ...props, style: { display: 'none' } })
    }

    return createElement('div', props)
  })

/**
 * Use the scoped blobs list context state from a parent `BlobsList`.
 */
export function useBlobsList(): BlobsListContextValue {
  return useContext(BlobsListContext)
}

/**
 * Custom hook for managing blobs list without UI
 */
export function useBlobs(space: Space, size = 25) {
  const [{ client }] = useW3()
  const [blobs, setBlobs] = useState<Blob[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>()

  const loadBlobs = useCallback(
    async (cursor?: string) => {
      if (!client || !space) return

      try {
        setLoading(true)
        setError(undefined)

        if (client.currentSpace()?.did() !== space.did()) {
          await client.setCurrentSpace(space.did())
        }

        const result = await client.capability.blob.list({ size, cursor })

        setBlobs(result.results)
        return result
      } catch (err: any) {
        const error = err instanceof Error ? err : new Error('Failed to load blobs')
        setError(error)
        throw error
      } finally {
        setLoading(false)
      }
    },
    [client, space, size]
  )

  return {
    blobs,
    loading,
    error,
    loadBlobs,
  }
}

export const BlobsList = Object.assign(BlobsListRoot, {
  Table: BlobsListTable,
  Item: BlobsListItem,
  Pagination: BlobsListPagination,
  Empty: BlobsListEmpty,
})


import type { As, Component, Props, Options } from 'ariakit-react-utils'
import type { Space, UnknownLink } from '@storacha/ui-core'
import type { MouseEventHandler } from 'react'

import {
  Fragment,
  useState,
  createContext,
  useContext,
  useCallback,
  useMemo,
} from 'react'
import { createComponent, createElement } from 'ariakit-react-utils'

export interface UploadItem {
  root: UnknownLink
  updatedAt: string
  shards?: Array<{ cid: string; size: number }>
}

export interface UploadsListContextState {
  /**
   * List of uploads
   */
  uploads: UploadItem[]
  /**
   * Currently selected upload
   */
  selectedUpload?: UploadItem
  /**
   * Is the list loading?
   */
  loading: boolean
  /**
   * Is the list being validated/refreshed?
   */
  validating: boolean
  /**
   * Current page (0-indexed)
   */
  currentPage: number
  /**
   * Items per page
   */
  pageSize: number
  /**
   * Total number of items
   */
  totalItems?: number
  /**
   * Error state
   */
  error?: Error
}

export interface UploadsListContextActions {
  /**
   * Select an upload
   */
  selectUpload: (upload: UploadItem) => void
  /**
   * Go to next page
   */
  nextPage: () => void
  /**
   * Go to previous page
   */
  previousPage: () => void
  /**
   * Go to specific page
   */
  goToPage: (page: number) => void
  /**
   * Refresh the list
   */
  refresh: () => void
  /**
   * Set loading state
   */
  setLoading: (loading: boolean) => void
  /**
   * Set uploads data
   */
  setUploads: (uploads: UploadItem[]) => void
  /**
   * Set error state
   */
  setError: (error?: Error) => void
}

export type UploadsListContextValue = [
  state: UploadsListContextState,
  actions: UploadsListContextActions
]

export const UploadsListContextDefaultValue: UploadsListContextValue = [
  {
    uploads: [],
    loading: false,
    validating: false,
    currentPage: 0,
    pageSize: 25,
  },
  {
    selectUpload: () => {
      throw new Error('missing select upload function')
    },
    nextPage: () => {
      throw new Error('missing next page function')
    },
    previousPage: () => {
      throw new Error('missing previous page function')
    },
    goToPage: () => {
      throw new Error('missing go to page function')
    },
    refresh: () => {
      throw new Error('missing refresh function')
    },
    setLoading: () => {
      throw new Error('missing set loading function')
    },
    setUploads: () => {
      throw new Error('missing set uploads function')
    },
    setError: () => {
      throw new Error('missing set error function')
    },
  },
]

export const UploadsListContext = createContext<UploadsListContextValue>(
  UploadsListContextDefaultValue
)

export type UploadsListRootOptions<T extends As = typeof Fragment> = Options<T> & {
  /**
   * Space to fetch uploads from
   */
  space?: Space
  /**
   * Callback when an upload is selected
   */
  onUploadSelect?: (upload: UploadItem) => void
  /**
   * Custom refresh function
   */
  onRefresh?: () => Promise<void> | void
  /**
   * Items per page
   */
  pageSize?: number
}

export type UploadsListRootProps<T extends As = typeof Fragment> = Props<
  UploadsListRootOptions<T>
>

/**
 * Top level component of the headless UploadsList.
 *
 * Must be used inside a w3ui Provider.
 */
export const UploadsListRoot: Component<UploadsListRootProps> =
  createComponent(({ space, onUploadSelect, onRefresh, pageSize = 25, ...props }) => {
    const [uploads, setUploads] = useState<UploadItem[]>([])
    const [selectedUpload, setSelectedUpload] = useState<UploadItem>()
    const [loading, setLoading] = useState(false)
    const [validating, setValidating] = useState(false)
    const [currentPage, setCurrentPage] = useState(0)
    const [totalItems] = useState<number>()
    const [error, setError] = useState<Error>()

    const selectUpload = useCallback((upload: UploadItem) => {
      setSelectedUpload(upload)
      onUploadSelect?.(upload)
    }, [onUploadSelect])

    const nextPage = useCallback(() => {
      const maxPage = totalItems ? Math.ceil(totalItems / pageSize) - 1 : 0
      setCurrentPage(prev => Math.min(prev + 1, maxPage))
    }, [totalItems, pageSize])

    const previousPage = useCallback(() => {
      setCurrentPage(prev => Math.max(prev - 1, 0))
    }, [])

    const goToPage = useCallback((page: number) => {
      const maxPage = totalItems ? Math.ceil(totalItems / pageSize) - 1 : 0
      setCurrentPage(Math.max(0, Math.min(page, maxPage)))
    }, [totalItems, pageSize])

    const refresh = useCallback(async () => {
      if (onRefresh) {
        setValidating(true)
        try {
          await onRefresh()
        } finally {
          setValidating(false)
        }
      }
    }, [onRefresh])


    const value = useMemo<UploadsListContextValue>(
      () => [
        {
          uploads,
          selectedUpload,
          loading,
          validating,
          currentPage,
          pageSize,
          totalItems,
          error,
        },
        {
          selectUpload,
          nextPage,
          previousPage,
          goToPage,
          refresh,
          setLoading,
          setUploads,
          setError,
        },
      ],
      [
        uploads,
        selectedUpload,
        loading,
        validating,
        currentPage,
        pageSize,
        totalItems,
        error,
        selectUpload,
        nextPage,
        previousPage,
        goToPage,
        refresh,
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
>

/**
 * Table component for displaying uploads
 */
export const UploadsListTable: Component<UploadsListTableProps> =
  createComponent((props) => {
    return createElement('table', props)
  })

export type UploadsListHeaderOptions<T extends As = 'thead'> = Options<T>
export type UploadsListHeaderProps<T extends As = 'thead'> = Props<
  UploadsListHeaderOptions<T>
>

/**
 * Table header component
 */
export const UploadsListHeader: Component<UploadsListHeaderProps> =
  createComponent((props) => {
    return createElement('thead', props)
  })

export type UploadsListBodyOptions<T extends As = 'tbody'> = Options<T>
export type UploadsListBodyProps<T extends As = 'tbody'> = Props<
  UploadsListBodyOptions<T>
>

/**
 * Table body component
 */
export const UploadsListBody: Component<UploadsListBodyProps> =
  createComponent((props) => {
    return createElement('tbody', props)
  })

export type UploadsListRowOptions<T extends As = 'tr'> = Options<T> & {
  upload: UploadItem
}
export type UploadsListRowProps<T extends As = 'tr'> = Props<
  UploadsListRowOptions<T>
>

/**
 * Table row component for an individual upload
 */
export const UploadsListRow: Component<UploadsListRowProps> =
  createComponent(({ upload, ...props }) => {
    const [{ selectedUpload }, { selectUpload }] = useUploadsList()
    
    const handleClick: MouseEventHandler<HTMLTableRowElement> = useCallback((e) => {
      e.preventDefault()
      selectUpload(upload)
    }, [upload, selectUpload])

    const isSelected = selectedUpload?.root.toString() === upload.root.toString()

    return createElement('tr', {
      ...props,
      onClick: handleClick,
      'aria-selected': isSelected,
      role: 'button',
      tabIndex: 0,
    })
  })

export type UploadsListCellOptions<T extends As = 'td'> = Options<T>
export type UploadsListCellProps<T extends As = 'td'> = Props<
  UploadsListCellOptions<T>
>

/**
 * Table cell component
 */
export const UploadsListCell: Component<UploadsListCellProps> =
  createComponent((props) => {
    return createElement('td', props)
  })

export type UploadsListPaginationOptions<T extends As = 'nav'> = Options<T>
export type UploadsListPaginationProps<T extends As = 'nav'> = Props<
  UploadsListPaginationOptions<T>
>

/**
 * Pagination navigation component
 */
export const UploadsListPagination: Component<UploadsListPaginationProps> =
  createComponent((props) => {
    return createElement('nav', { ...props, role: 'navigation', 'aria-label': 'Uploads pagination' })
  })

export type UploadsListPreviousButtonOptions<T extends As = 'button'> = Options<T>
export type UploadsListPreviousButtonProps<T extends As = 'button'> = Props<
  UploadsListPreviousButtonOptions<T>
>

/**
 * Previous page button
 */
export const UploadsListPreviousButton: Component<UploadsListPreviousButtonProps> =
  createComponent((props) => {
    const [{ loading }, { previousPage }] = useUploadsList()
    
    const handleClick = useCallback(() => {
      previousPage()
    }, [previousPage])

    return createElement('button', {
      ...props,
      onClick: handleClick,
      disabled: loading,
    })
  })

export type UploadsListNextButtonOptions<T extends As = 'button'> = Options<T>
export type UploadsListNextButtonProps<T extends As = 'button'> = Props<
  UploadsListNextButtonOptions<T>
>

/**
 * Next page button
 */
export const UploadsListNextButton: Component<UploadsListNextButtonProps> =
  createComponent((props) => {
    const [{ loading }, { nextPage }] = useUploadsList()
    
    const handleClick = useCallback(() => {
      nextPage()
    }, [nextPage])

    return createElement('button', {
      ...props,
      onClick: handleClick,
      disabled: loading,
    })
  })

export type UploadsListRefreshButtonOptions<T extends As = 'button'> = Options<T>
export type UploadsListRefreshButtonProps<T extends As = 'button'> = Props<
  UploadsListRefreshButtonOptions<T>
>

/**
 * Refresh button
 */
export const UploadsListRefreshButton: Component<UploadsListRefreshButtonProps> =
  createComponent((props) => {
    const [{ loading, validating }, { refresh }] = useUploadsList()
    
    const handleClick = useCallback(() => {
      refresh()
    }, [refresh])

    const isLoading = loading || validating

    return createElement('button', {
      ...props,
      onClick: handleClick,
      disabled: isLoading,
      'aria-label': isLoading ? 'Refreshing uploads...' : 'Refresh uploads',
    })
  })

/**
 * Use the scoped uploads list context state from a parent `UploadsList`.
 */
export function useUploadsList(): UploadsListContextValue {
  return useContext(UploadsListContext)
}

export const UploadsList = Object.assign(UploadsListRoot, {
  Table: UploadsListTable,
  Header: UploadsListHeader,
  Body: UploadsListBody,
  Row: UploadsListRow,
  Cell: UploadsListCell,
  Pagination: UploadsListPagination,
  PreviousButton: UploadsListPreviousButton,
  NextButton: UploadsListNextButton,
  RefreshButton: UploadsListRefreshButton,
})
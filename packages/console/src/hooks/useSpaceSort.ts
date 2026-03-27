import { useState, useEffect } from 'react'
import type { Space } from '@storacha/ui-react'

/**
 * Sort options for spaces list (name-based only)
 */
export type SortOption = 'name-asc' | 'name-desc'

const SORT_STORAGE_KEY = 'storacha_space_sort_option'

const VALID_SORT_OPTIONS: SortOption[] = ['name-asc', 'name-desc']

/**
 * Hook to manage space sorting with localStorage persistence.
 *
 * - Persists the selected option in localStorage until logout.
 * - Also updates URL query param when on home page for shareability.
 */
export function useSpaceSort() {
  const [sortOption, setSortOption] = useState<SortOption>(() => {
    if (typeof window === 'undefined') return 'name-asc'

    try {
      const stored = window.localStorage.getItem(SORT_STORAGE_KEY)
      if (stored && VALID_SORT_OPTIONS.includes(stored as SortOption)) {
        return stored as SortOption
      }
    } catch {
      // ignore storage errors
    }

    try {
      const url = new URL(window.location.href)
      const sortParam = url.searchParams.get('sort')
      if (sortParam && VALID_SORT_OPTIONS.includes(sortParam as SortOption)) {
        try {
          window.localStorage.setItem(SORT_STORAGE_KEY, sortParam)
        } catch {
          // ignore
        }
        return sortParam as SortOption
      }
    } catch {
      // ignore URL errors
    }

    return 'name-asc'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const stored = window.localStorage.getItem(SORT_STORAGE_KEY)
      if (stored && VALID_SORT_OPTIONS.includes(stored as SortOption)) {
        setSortOption((current) =>
          current !== stored ? (stored as SortOption) : current
        )
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!VALID_SORT_OPTIONS.includes(sortOption)) return

    try {
      window.localStorage.setItem(SORT_STORAGE_KEY, sortOption)
    } catch (e) {
      console.warn('Failed to save sort option to localStorage:', e)
    }

    try {
      const currentPath = window.location.pathname
      if (currentPath === '/' || currentPath === '') {
        const url = new URL(window.location.href)
        if (sortOption === 'name-asc') {
          url.searchParams.delete('sort')
        } else {
          url.searchParams.set('sort', sortOption)
        }
        window.history.replaceState(null, '', url.toString())
      }
    } catch (e) {
      // ignore URL errors
    }
  }, [sortOption])

  return {
    sortOption,
    setSortOption,
  }
}

/**
 * Sort spaces array by name (A-Z or Z-A).
 *
 * @param spaces - Array of spaces to sort
 * @param sortOption - The sort option to apply
 * @returns Sorted array of spaces
 */
export function sortSpaces(spaces: Space[], sortOption: SortOption): Space[] {
  const sorted = [...spaces]

  return sorted.sort((a, b) => {
    const nameA = (a.name || a.did()).toLowerCase()
    const nameB = (b.name || b.did()).toLowerCase()
    return sortOption === 'name-desc'
      ? nameB.localeCompare(nameA)
      : nameA.localeCompare(nameB)
  })
}


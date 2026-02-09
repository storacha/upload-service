import { useState, useEffect } from 'react'
import type { Space } from '@storacha/ui-react'

/**
 * Sort options for spaces list
 */
export type SortOption = 
  | 'newest'      // Sort by creation order (newest first) - default
  | 'oldest'      // Sort by creation order (oldest first)
  | 'name-asc'    // Sort by name A-Z
  | 'name-desc'   // Sort by name Z-A

const SORT_STORAGE_KEY = 'storacha_space_sort_option'

/**
 * Hook to manage space sorting with localStorage persistence.
 *
 * - Persists the selected option in localStorage until logout.
 * - Also updates URL query param when on home page for shareability.
 */
export function useSpaceSort() {
  const [sortOption, setSortOption] = useState<SortOption>(() => {
    // Default value during SSR
    if (typeof window === 'undefined') return 'newest'

    const validOptions: SortOption[] = ['newest', 'oldest', 'name-asc', 'name-desc']

    // Always prioritize localStorage first (persists across navigation)
    try {
      const stored = window.localStorage.getItem(SORT_STORAGE_KEY)
      if (stored && validOptions.includes(stored as SortOption)) {
        return stored as SortOption
      }
    } catch {
      // ignore storage errors
    }

    // Fallback to URL query param if no localStorage value
    try {
      const url = new URL(window.location.href)
      const sortParam = url.searchParams.get('sort')
      if (sortParam && validOptions.includes(sortParam as SortOption)) {
        // Also save to localStorage for future visits
        try {
          window.localStorage.setItem(SORT_STORAGE_KEY, sortParam)
        } catch {
          // ignore storage errors
        }
        return sortParam as SortOption
      }
    } catch {
      // ignore URL errors
    }

    return 'newest'
  })

  // Sync with localStorage on mount (in case it changed elsewhere or after navigation)
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const stored = window.localStorage.getItem(SORT_STORAGE_KEY)
      const validOptions: SortOption[] = ['newest', 'oldest', 'name-asc', 'name-desc']
      if (stored && validOptions.includes(stored as SortOption)) {
        // Only update if different from current state to avoid unnecessary re-renders
        setSortOption((current) => {
          if (current !== stored) {
            return stored as SortOption
          }
          return current
        })
      }
    } catch {
      // ignore storage errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount

  // Persist changes to localStorage immediately and update URL if on home page
  useEffect(() => {
    if (typeof window === 'undefined') return

    const validOptions: SortOption[] = ['newest', 'oldest', 'name-asc', 'name-desc']
    if (!validOptions.includes(sortOption)) return

    // Always persist to localStorage first (this is the source of truth)
    try {
      window.localStorage.setItem(SORT_STORAGE_KEY, sortOption)
    } catch (e) {
      console.warn('Failed to save sort option to localStorage:', e)
    }

    // Update URL query param only if we're on the home page
    // This allows sharing URLs with sort preference
    try {
      const currentPath = window.location.pathname
      // Only update URL if we're on the home page (root path)
      if (currentPath === '/' || currentPath === '') {
        const url = new URL(window.location.href)
        if (sortOption === 'newest') {
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
 * Sort spaces array based on the selected sort option
 * 
 * Note: For 'newest' and 'oldest', we assume the array order from useW3() reflects creation order.
 * 
 * @param spaces - Array of spaces to sort
 * @param sortOption - The sort option to apply
 * @returns Sorted array of spaces
 */
export function sortSpaces(spaces: Space[], sortOption: SortOption): Space[] {
  const sorted = [...spaces] // Create a copy to avoid mutating original

  switch (sortOption) {
    case 'newest':
      // Spaces from useW3() are ordered oldest-first, so reverse for newest-first
      return sorted.reverse()

    case 'oldest':
      // Keep original order for oldest-first
      return sorted

    case 'name-asc':
      // Sort alphabetically by name (A-Z)
      return sorted.sort((a, b) => {
        const nameA = (a.name || a.did()).toLowerCase()
        const nameB = (b.name || b.did()).toLowerCase()
        return nameA.localeCompare(nameB)
      })

    case 'name-desc':
      // Sort alphabetically by name (Z-A)
      return sorted.sort((a, b) => {
        const nameA = (a.name || a.did()).toLowerCase()
        const nameB = (b.name || b.did()).toLowerCase()
        return nameB.localeCompare(nameA)
      })

    default:
      return sorted
  }
}


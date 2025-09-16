'use client'

import { useState, useRef, useEffect } from 'react'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import Fuse from 'fuse.js'

// Mock search data - in a real app this would come from your documentation content
const searchData = [
  { title: 'Introduction', content: 'Getting started with Console Toolkit', href: '/' },
  { title: 'Quick Start', content: 'Quick start guide for Console Toolkit', href: '/getting-started/quick-start' },
  { title: 'Installation', content: 'How to install Console Toolkit', href: '/getting-started/installation' },
  { title: 'Configuration', content: 'Configure your Console Toolkit setup', href: '/getting-started/configuration' },
  { title: 'Components Overview', content: 'Overview of available components', href: '/components' },
  { title: 'Layout Components', content: 'Layout and structure components', href: '/components/layout' },
  { title: 'Navigation Components', content: 'Navigation and menu components', href: '/components/navigation' },
  { title: 'Form Components', content: 'Form inputs and controls', href: '/components/forms' },
  { title: 'Data Display', content: 'Components for displaying data', href: '/components/data-display' },
  { title: 'Theming', content: 'Customize the look and feel', href: '/styling/theming' },
  { title: 'Colors', content: 'Color system and palette', href: '/styling/colors' },
  { title: 'Typography', content: 'Text styles and fonts', href: '/styling/typography' },
  { title: 'Responsive Design', content: 'Mobile-first responsive design', href: '/styling/responsive' },
]

const fuse = new Fuse(searchData, {
  keys: ['title', 'content'],
  threshold: 0.3,
})

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<typeof searchData>([])
  const [isOpen, setIsOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.trim()) {
      const searchResults = fuse.search(query).map(result => result.item)
      setResults(searchResults)
      setIsOpen(true)
    } else {
      setResults([])
      setIsOpen(false)
    }
  }, [query])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={searchRef}>
      <div className="relative">
        <MagnifyingGlassIcon className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-gray-400 pl-3" />
        <input
          type="text"
          placeholder="Search documentation..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim() && setIsOpen(true)}
          className="block w-full rounded-md border-0 py-2 pl-10 pr-3 text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-hot-blue dark:focus:ring-hot-blue-light text-sm leading-6"
        />
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-10 mt-2 w-full rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5">
          <div className="py-1">
            {results.slice(0, 5).map((result, index) => (
              <a
                key={index}
                href={result.href}
                className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => {
                  setIsOpen(false)
                  setQuery('')
                }}
              >
                <div className="font-medium">{result.title}</div>
                <div className="text-gray-500 dark:text-gray-400 text-xs">{result.content}</div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

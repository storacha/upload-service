import type { Space } from '@storacha/ui-react'

import React, { Fragment, useState, useRef } from 'react'
import { Combobox, Transition } from '@headlessui/react'
import { ChevronUpDownIcon, MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import { LockClosedIcon, GlobeAltIcon } from '@heroicons/react/24/outline'
import { shortenDID } from '@/lib'
import { usePrivateSpacesAccess } from '@/hooks/usePrivateSpacesAccess'

interface SpaceFinderProps {
  spaces: Space[]
  selected?: Space
  setSelected?: (space: Space) => void
  className?: string
}

export function SpaceFinder ({
  spaces,
  selected,
  setSelected,
  className = ''
}: SpaceFinderProps): JSX.Element {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const { shouldShowPrivateSpacesTab } = usePrivateSpacesAccess()

  // First filter by query, then categorize and sort
  const filteredSpaces = query === ''
    ? spaces
    : spaces.filter((space: Space) =>
        (space.name || space.did())
          .toLowerCase()
          .replace(/\s+/g, '')
          .includes(query.toLowerCase().replace(/\s+/g, ''))
      )

  // Categorize spaces
  const publicSpaces = filteredSpaces
    .filter(space => space.access?.type !== 'private')
    .sort((a, b) => {
      const nameA = (a.name || shortenDID(a.did())).toLowerCase()
      const nameB = (b.name || shortenDID(b.did())).toLowerCase()
      return nameA.localeCompare(nameB)
    })

  // Only show private spaces if feature is enabled and user has access
  const privateSpaces = shouldShowPrivateSpacesTab 
    ? filteredSpaces
        .filter(space => space.access?.type === 'private')
        .sort((a, b) => {
          const nameA = (a.name || shortenDID(a.did())).toLowerCase()
          const nameB = (b.name || shortenDID(b.did())).toLowerCase()
          return nameA.localeCompare(nameB)
        })
    : []

  const hasResults = publicSpaces.length > 0 || privateSpaces.length > 0

  const handleSelect = (space: Space) => {
    setSelected?.(space)
    setIsOpen(false)
  }

  return (
    <div className={`${className}`}>
      <Combobox
        value={selected}
        onChange={handleSelect}
        by={(a, b) => a?.did() === b?.did()}
      >
        <div className='relative mt-1' ref={containerRef}>
          {/* Search input with magnifying glass icon */}
          <div className='relative w-full overflow-hidden rounded-md bg-white text-left shadow-md'>
            <MagnifyingGlassIcon className='pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400' />
            <Combobox.Input
              className='w-full border-none py-2 pl-8 pr-8 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none'
              displayValue={(space: Space) => space.name || shortenDID(space.did())}
              onChange={(event) => { setQuery(event.target.value); setIsOpen(true) }}
              onFocus={() => setIsOpen(true)}
              onBlur={(e) => { const next = e.relatedTarget as Node | null; if (!next || !containerRef.current?.contains(next)) setIsOpen(false) }}
              onKeyDown={(e) => { if (e.key === 'Escape') setIsOpen(false) }}
              placeholder='Search'
            />
            <Combobox.Button className='absolute inset-y-0 right-0 flex items-center pl-1 pr-2' onClick={() => setIsOpen(v => !v)}>
              <ChevronUpDownIcon
                className='h-5 w-5 text-gray-400'
                aria-hidden='true'
              />
            </Combobox.Button>
          </div>
          <Transition
            as={Fragment}
            show={isOpen}
            enter='transition ease-out duration-200'
            enterFrom='opacity-0 -translate-y-1 scale-y-75'
            enterTo='opacity-100 translate-y-0 scale-y-100'
            leave='transition ease-in duration-150'
            leaveFrom='opacity-100 translate-y-0 scale-y-100'
            leaveTo='opacity-0 -translate-y-1 scale-y-75'
            afterLeave={() => { setQuery('') }}
          >
            {/* Sliding options list */}
            <Combobox.Options
              className='mt-2 w-full rounded-md pt-1 overflow-y-auto max-h-60'
            >
              {!hasResults && query !== ''
                ? (
                <div className='relative select-none py-2 px-4 font-mono text-sm text-hot-red'>
                  No results found
                </div>
                  )
                : (
                    <>
                      {/* Public Spaces Section */}
                      {publicSpaces.length > 0 && (
                        <>
                          <div className='px-2 py-2 text-[10px] font-semibold text-gray-800 uppercase tracking-wide'>
                            <div className='flex items-center gap-2'>
                              <GlobeAltIcon className='w-3 h-3' />
                              Public Spaces
                            </div>
                          </div>
                          {publicSpaces.map((space) => (
                            <Combobox.Option
                              key={space.did()}
                              className={({ active }) =>
                                `relative select-none py-1 px-2 ${
                                  active ? 'cursor-pointer' : ''
                                }`
                              }
                              value={space}
                            >
                              {({ selected, active }) => (
                                <div className={`flex items-center gap-2 px-2 py-2 rounded-md ${
                                  selected || active ? 'bg-hot-yellow-light' : ''
                                }`}>
                                  <GlobeAltIcon className='w-4 h-4 flex-shrink-0 text-gray-700' />
                                  <span
                                    className={`block overflow-hidden text-ellipsis whitespace-nowrap ${
                                      selected ? 'font-medium' : ''
                                    }`}
                                  >
                                    {space.name || shortenDID(space.did())}
                                  </span>
                                </div>
                              )}
                            </Combobox.Option>
                          ))}
                        </>
                      )}

                      {/* Private Spaces Section */}
                      {shouldShowPrivateSpacesTab && privateSpaces.length > 0 && (
                        <>
                          <div className='px-2 py-2 text-[10px] font-semibold text-gray-800 uppercase tracking-wide'>
                            <div className='flex items-center gap-2'>
                              <LockClosedIcon className='w-3 h-3' />
                              Private Spaces
                            </div>
                          </div>
                          {privateSpaces.map((space) => (
                            <Combobox.Option
                              key={space.did()}
                              className={({ active }) =>
                                `relative select-none py-1 px-2 ${
                                  active ? 'cursor-pointer' : ''
                                }`
                              }
                              value={space}
                            >
                              {({ selected, active }) => (
                                <div className={`flex items-center gap-2 px-2 py-2 rounded-md ${
                                  selected || active ? 'bg-hot-yellow-light' : ''
                                }`}>
                                  <LockClosedIcon className='w-4 h-4 flex-shrink-0 text-gray-800' />
                                  <span
                                    className={`block overflow-hidden text-ellipsis whitespace-nowrap ${
                                      selected ? 'font-medium' : ''
                                    }`}
                                  >
                                    {space.name || shortenDID(space.did())}
                                  </span>
                                </div>
                              )}
                            </Combobox.Option>
                          ))}
                        </>
                      )}
                    </>
                  )}
            </Combobox.Options>
          </Transition>
        </div>
      </Combobox>
    </div>
  )
}

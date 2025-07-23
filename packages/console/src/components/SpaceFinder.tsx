import type { Space } from '@storacha/ui-react'

import React, { Fragment, useState } from 'react'
import { Combobox, Transition } from '@headlessui/react'
import { ChevronUpDownIcon } from '@heroicons/react/20/solid'
import { LockClosedIcon, GlobeAltIcon } from '@heroicons/react/24/outline'
import { shortenDID } from '@/lib'
import { useFeatureFlags } from '@/lib/featureFlags'

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
  const { canSeePrivateSpacesFeature } = useFeatureFlags()

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
  const privateSpaces = canSeePrivateSpacesFeature 
    ? filteredSpaces
        .filter(space => space.access?.type === 'private')
        .sort((a, b) => {
          const nameA = (a.name || shortenDID(a.did())).toLowerCase()
          const nameB = (b.name || shortenDID(b.did())).toLowerCase()
          return nameA.localeCompare(nameB)
        })
    : []

  const hasResults = publicSpaces.length > 0 || privateSpaces.length > 0

  return (
    <div className={`${className}`}>
      <Combobox
        value={selected}
        onChange={setSelected}
        by={(a, b) => a?.did() === b?.did()}
      >
        <div className='relative mt-1'>
          <div className='relative w-full overflow-hidden rounded-md bg-white text-left shadow-md'>
            <Combobox.Input
              className='w-full border-none py-2 pl-3 pr-10 text-sm text-gray-900'
              displayValue={(space: Space) => space.name || shortenDID(space.did())}
              onChange={(event) => { setQuery(event.target.value) }}
            />
            <Combobox.Button className='absolute inset-y-0 right-0 flex items-center pl-1 pr-2'>
              <ChevronUpDownIcon
                className='h-5 w-5 text-gray-400'
                aria-hidden='true'
              />
            </Combobox.Button>
          </div>
          <Transition
            as={Fragment}
            leave='transition ease-in duration-100'
            leaveFrom='opacity-100'
            leaveTo='opacity-0'
            afterLeave={() => { setQuery('') }}
          >
            <Combobox.Options
              className='absolute mt-1 max-h-96 w-full bg-white rounded-md pt-1 shadow-lg overflow-scroll z-10'
              static
            >
              {!hasResults && query !== ''
                ? (
                <div className='relative select-non py-2 px-4 font-mono text-sm text-red-500'>
                  No results found
                </div>
                  )
                : (
                    <>
                      {/* Public Spaces Section */}
                      {publicSpaces.length > 0 && (
                        <>
                          <div className='px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-100'>
                            <div className='flex items-center gap-2'>
                              <GlobeAltIcon className='w-3 h-3' />
                              Public Spaces
                            </div>
                          </div>
                          {publicSpaces.map((space) => (
                            <Combobox.Option
                              key={space.did()}
                              className={({ active }) =>
                                `relative select-none py-2 pl-9 pr-4 ${
                                  active ? 'bg-hot-yellow-light cursor-pointer text-hot-red' : 'text-black'
                                }`
                              }
                              value={space}
                            >
                              {({ selected, active }) => (
                                <>
                                  <div className="flex items-center gap-2">
                                    <GlobeAltIcon className='w-3 h-3 flex-shrink-0 text-gray-400' />
                                    <span
                                      className={`block overflow-hidden text-ellipsis whitespace-nowrap ${
                                        selected ? 'font-medium' : ''
                                      }`}
                                    >
                                      {space.name || shortenDID(space.did())}
                                    </span>
                                  </div>
                                  {selected
                                    ? (
                                    <span
                                      className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                                        active ? '' : ''
                                      }`}
                                    >
                                      ⁂
                                    </span>
                                      )
                                    : null}
                                </>
                              )}
                            </Combobox.Option>
                          ))}
                        </>
                      )}

                      {/* Private Spaces Section */}
                      {canSeePrivateSpacesFeature && privateSpaces.length > 0 && (
                        <>
                          <div className='px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-red-50 border-b border-gray-100'>
                            <div className='flex items-center gap-2'>
                              <LockClosedIcon className='w-3 h-3' />
                              Private Spaces
                            </div>
                          </div>
                          {privateSpaces.map((space) => (
                            <Combobox.Option
                              key={space.did()}
                              className={({ active }) =>
                                `relative select-none py-2 pl-9 pr-4 bg-red-50/30 ${
                                  active ? 'bg-hot-yellow-light cursor-pointer text-hot-red' : 'text-black'
                                }`
                              }
                              value={space}
                            >
                              {({ selected, active }) => (
                                <>
                                  <div className="flex items-center gap-2">
                                    <LockClosedIcon className='w-3 h-3 flex-shrink-0 text-red-500' />
                                    <span
                                      className={`block overflow-hidden text-ellipsis whitespace-nowrap ${
                                        selected ? 'font-medium' : ''
                                      }`}
                                    >
                                      {space.name || shortenDID(space.did())}
                                    </span>
                                    
                                  </div>
                                  {selected
                                    ? (
                                    <span
                                      className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                                        active ? '' : ''
                                      }`}
                                    >
                                      ⁂
                                    </span>
                                      )
                                    : null}
                                </>
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

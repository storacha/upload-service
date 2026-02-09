import { Fragment, type JSX } from 'react'
// @ts-expect-error - relying on headlessui types from dependency tree
import { Listbox, Transition } from '@headlessui/react'
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/20/solid'
import type { SortOption } from '@/hooks/useSpaceSort'

interface SpaceSortDropdownProps {
  sortOption: SortOption
  onSortChange: (option: SortOption) => void
}

/**
 * Sort options configuration
 */
const sortOptions: Array<{ value: SortOption; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
]

/**
 * Dropdown component for sorting spaces list
 * Follows Storacha Console UI patterns using Headless UI
 */
export function SpaceSortDropdown({ sortOption, onSortChange }: SpaceSortDropdownProps): JSX.Element {
  const selectedOption = sortOptions.find(opt => opt.value === sortOption) || sortOptions[0]

  return (
    <div className="relative w-auto">
      <Listbox value={sortOption} onChange={onSortChange}>
        <div className="relative">
          <Listbox.Button className="relative w-auto min-w-[150px] cursor-pointer rounded-md border border-hot-red bg-white py-2 pl-3 pr-10 text-left text-sm focus:outline-none focus:ring-1 focus:ring-hot-red focus:border-hot-red">
            <span className="block truncate font-epilogue text-hot-red text-xs sm:text-sm">
              {selectedOption.label}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon
                className="h-5 w-5 text-hot-red"
                aria-hidden="true"
              />
            </span>
          </Listbox.Button>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute left-0 z-10 mt-1 max-h-60 w-auto min-w-[150px] overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm border border-hot-red">
              {sortOptions.map((option) => (
                <Listbox.Option
                  key={option.value}
                  className={({ active }: { active: boolean }) =>
                    `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                      active ? 'bg-hot-yellow-light text-hot-red' : 'text-gray-900'
                    }`
                  }
                  value={option.value}
                >
                  {({ selected }: { selected: boolean }) => (
                    <>
                      <span
                        className={`block truncate ${
                          selected ? 'font-medium font-epilogue' : 'font-normal'
                        }`}
                      >
                        {option.label}
                      </span>
                      {selected ? (
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-hot-red">
                          <CheckIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                      ) : null}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
    </div>
  )
}


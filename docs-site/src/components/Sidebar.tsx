'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRightIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { Logo } from './Logo'
import { SearchBar } from './SearchBar'

interface NavigationItem {
  name: string
  href?: string
  children?: NavigationItem[]
}

const navigation: NavigationItem[] = [
  {
    name: 'Getting Started',
    children: [
      { name: 'Introduction', href: '/' },
      { name: 'Quick Start', href: '/getting-started/quick-start' },
      { name: 'Installation', href: '/getting-started/installation' },
      { name: 'Configuration', href: '/getting-started/configuration' },
    ],
  },
  {
    name: 'Components',
    children: [
      { name: 'Overview', href: '/components' },
      { name: 'Layout', href: '/components/layout' },
      { name: 'Navigation', href: '/components/navigation' },
      { name: 'Forms', href: '/components/forms' },
      { name: 'Data Display', href: '/components/data-display' },
    ],
  },
  {
    name: 'Styling',
    children: [
      { name: 'Theming', href: '/styling/theming' },
      { name: 'Colors', href: '/styling/colors' },
      { name: 'Typography', href: '/styling/typography' },
      { name: 'Responsive Design', href: '/styling/responsive' },
    ],
  },
  {
    name: 'Advanced',
    children: [
      { name: 'Customization', href: '/advanced/customization' },
      { name: 'Performance', href: '/advanced/performance' },
      { name: 'Testing', href: '/advanced/testing' },
      { name: 'Deployment', href: '/advanced/deployment' },
    ],
  },
  {
    name: 'API Reference',
    children: [
      { name: 'Core API', href: '/api/core' },
      { name: 'Utilities', href: '/api/utilities' },
      { name: 'Hooks', href: '/api/hooks' },
      { name: 'Types', href: '/api/types' },
    ],
  },
  {
    name: 'Suites',
    children: [
      { name: 'Authentication', href: '/suites/auth' },
      { name: 'Spaces', href: '/suites/spaces' },
      { name: 'Uploader', href: '/suites/uploader' },
      { name: 'Uploads List', href: '/suites/uploads-list' },
      { name: 'Sharing Tools', href: '/suites/sharing' },
    ],
  },
  {
    name: 'Guides',
    children: [
      { name: 'Integration Context', href: '/guides/integration-context' },
      { name: 'Examples', href: '/examples' },
    ],
  },
]

function NavItem({ item, level = 0 }: { item: NavigationItem; level?: number }) {
  const [isOpen, setIsOpen] = useState(true)
  const pathname = usePathname()
  const isActive = item.href === pathname
  const hasChildren = item.children && item.children.length > 0

  if (hasChildren) {
    return (
      <li>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center gap-x-3 rounded-md p-2 text-left text-sm leading-6 font-semibold text-gray-700 dark:text-gray-300 hover:text-hot-blue dark:hover:text-hot-blue-light hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          {isOpen ? (
            <ChevronDownIcon className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRightIcon className="h-4 w-4 shrink-0" />
          )}
          {item.name}
        </button>
        {isOpen && (
          <ul className="mt-1 px-2">
            {item.children?.map((child) => (
              <NavItem key={child.name} item={child} level={level + 1} />
            ))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <li>
      <Link
        href={item.href!}
        className={`block rounded-md py-2 px-3 text-sm leading-6 hover:text-hot-blue dark:hover:text-hot-blue-light hover:bg-gray-50 dark:hover:bg-gray-800 ${
          isActive
            ? 'bg-hot-red-light dark:bg-hot-red/20 text-hot-red dark:text-hot-yellow font-semibold'
            : 'text-gray-700 dark:text-gray-300'
        } ${level > 0 ? 'ml-4' : ''}`}
      >
        {item.name}
      </Link>
    </li>
  )
}

export function Sidebar() {
  return (
    <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 px-6 pb-4">
      <div className="flex h-16 shrink-0 items-center">
        <Logo />
      </div>
      
      <SearchBar />

      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <ul role="list" className="-mx-2 space-y-1">
              {navigation.map((item) => (
                <NavItem key={item.name} item={item} />
              ))}
            </ul>
          </li>
        </ul>
      </nav>
    </div>
  )
}

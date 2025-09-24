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
    name: 'UI Toolkit',
    children: [
      { name: 'Overview', href: '/ui-toolkit/overview' },
      { name: 'Installation', href: '/ui-toolkit/installation' },
      { name: 'Provider Setup', href: '/ui-toolkit/provider-setup' },
      { name: 'Authentication Suite', href: '/ui-toolkit/authentication' },
      { name: 'Space Management', href: '/ui-toolkit/space-management' },
      { name: 'Content Management', href: '/ui-toolkit/content-management' },
      { name: 'Uploader Components', href: '/ui-toolkit/uploader' },
      { name: 'Theming & Styling', href: '/ui-toolkit/theming' },
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
    name: 'Integration',
    children: [
      { name: 'Integration Context', href: '/integration/context' },
      { name: 'Iframe vs Native', href: '/integration/iframe-vs-native' },
    ],
  },
  {
    name: 'Examples',
    children: [
      { name: 'Overview', href: '/examples' },
      { name: 'Sign Up / Sign In', href: '/examples/sign-up-in' },
      { name: 'Single File Upload', href: '/examples/file-upload' },
      { name: 'Multiple File Upload', href: '/examples/multi-file-upload' },
      { name: 'Uploads List', href: '/examples/uploads-list' },
      { name: 'Encrypted Uploads', href: '/examples/encrypted-uploads' },
      { name: 'Space Management', href: '/examples/space-management' },
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
        scroll={false}
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

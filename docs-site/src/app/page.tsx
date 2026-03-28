import { Layout } from '@/components/Layout'
import Link from 'next/link'
import { ArrowRightIcon, CodeBracketIcon, PaintBrushIcon, CogIcon } from '@heroicons/react/24/outline'

const features = [
  {
    name: 'Modern Components',
    description: 'Pre-built, accessible React components following modern design patterns and best practices.',
    icon: CodeBracketIcon,
    href: '/components',
  },
  {
    name: 'Flexible Theming',
    description: 'Comprehensive theming system with dark/light mode support and customizable design tokens.',
    icon: PaintBrushIcon,
    href: '/styling/theming',
  },
  {
    name: 'Developer Experience',
    description: 'Built with TypeScript, excellent documentation, and tools for rapid development.',
    icon: CogIcon,
    href: '/getting-started/quick-start',
  },
]

const quickLinks = [
  { name: 'Quick Start Guide', href: '/getting-started/quick-start' },
  { name: 'Component Library', href: '/components' },
  { name: 'Styling Guide', href: '/styling/theming' },
  { name: 'API Reference', href: '/api/core' },
]

export default function HomePage() {
  return (
    <Layout>
      <div className="mx-auto max-w-4xl">
        {/* Hero Section */}
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
            Console Toolkit
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
            A comprehensive toolkit for building modern web console applications. 
            Designed with the same principles and aesthetics as Storacha's console interface.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              href="/getting-started/quick-start"
              className="rounded-md bg-hot-blue px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-hot-blue/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hot-blue"
            >
              Get Started
              <ArrowRightIcon className="ml-2 h-4 w-4 inline-block" />
            </Link>
            <Link
              href="/components"
              className="text-sm font-semibold leading-6 text-gray-900 dark:text-white hover:text-hot-blue dark:hover:text-hot-blue-light"
            >
              View Components <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <div className="mx-auto mt-32 max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              Everything you need to build console apps
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
              Console Toolkit provides a complete set of components, utilities, and patterns for building 
              professional console interfaces that match Storacha's design language.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              {features.map((feature) => (
                <div key={feature.name} className="flex flex-col">
                  <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900 dark:text-white">
                    <feature.icon className="h-5 w-5 flex-none text-hot-blue dark:text-hot-blue-light" aria-hidden="true" />
                    {feature.name}
                  </dt>
                  <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600 dark:text-gray-300">
                    <p className="flex-auto">{feature.description}</p>
                    <p className="mt-6">
                      <Link
                        href={feature.href}
                        className="text-sm font-semibold leading-6 text-hot-blue dark:text-hot-blue-light hover:underline"
                      >
                        Learn more <span aria-hidden="true">→</span>
                      </Link>
                    </p>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Quick Links Section */}
        <div className="mx-auto mt-32 max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              Quick Links
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
              Jump right into the documentation sections you need most.
            </p>
          </div>
          <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-6 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-4">
            {quickLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="group relative rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:border-hot-blue dark:hover:border-hot-blue-light hover:shadow-md transition-all duration-200"
              >
                <div>
                  <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-white group-hover:text-hot-blue dark:group-hover:text-hot-blue-light">
                    {link.name}
                  </h3>
                  <div className="mt-4 flex items-center">
                    <span className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-hot-blue dark:group-hover:text-hot-blue-light">
                      Read more
                    </span>
                    <ArrowRightIcon className="ml-2 h-4 w-4 text-gray-400 group-hover:text-hot-blue dark:group-hover:text-hot-blue-light" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Code Example Section */}
        <div className="mx-auto mt-32 max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              Get started in minutes
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
              Install Console Toolkit and start building immediately with our intuitive API.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl">
            <div className="rounded-lg bg-gray-900 p-6">
              <pre className="text-sm text-gray-300">
                <code>{`npm install @storacha/console-toolkit

import { Layout, Button } from '@storacha/console-toolkit'

export default function App() {
  return (
    <Layout>
      <Button variant="primary">
        Hello Console Toolkit!
      </Button>
    </Layout>
  )
}`}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

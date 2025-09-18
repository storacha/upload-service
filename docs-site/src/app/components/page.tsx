import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'
import Link from 'next/link'

const componentCategories = [
  {
    name: 'Layout',
    description: 'Components for structuring your application layout',
    href: '/components/layout',
    components: ['Layout', 'Container', 'Grid', 'Stack', 'Divider']
  },
  {
    name: 'Navigation',
    description: 'Navigation components for user interface flow',
    href: '/components/navigation',
    components: ['Navbar', 'Sidebar', 'Breadcrumbs', 'Tabs', 'Pagination']
  },
  {
    name: 'Forms',
    description: 'Form controls and input components',
    href: '/components/forms',
    components: ['Input', 'Select', 'Checkbox', 'Radio', 'Switch', 'Textarea']
  },
  {
    name: 'Data Display',
    description: 'Components for displaying data and content',
    href: '/components/data-display',
    components: ['Table', 'Card', 'Badge', 'Avatar', 'Tooltip', 'Modal']
  }
]

export default function ComponentsPage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Components Overview</h1>
        
        <p>
          Console Toolkit provides a comprehensive set of React components designed to help you build 
          modern console applications quickly and efficiently. All components follow Storacha's design 
          principles and are fully accessible.
        </p>

        <h2>Component Categories</h2>

        <div className="grid gap-6 md:grid-cols-2 not-prose">
          {componentCategories.map((category) => (
            <Link
              key={category.name}
              href={category.href}
              className="group block rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:border-hot-blue dark:hover:border-hot-blue-light hover:shadow-md transition-all duration-200"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-hot-blue dark:group-hover:text-hot-blue-light mb-2">
                {category.name}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {category.description}
              </p>
              <div className="flex flex-wrap gap-2">
                {category.components.map((component) => (
                  <span
                    key={component}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                  >
                    {component}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>

        <h2>Design Principles</h2>

        <p>All Console Toolkit components are built with the following principles in mind:</p>

        <ul>
          <li><strong>Accessibility First:</strong> All components meet WCAG 2.1 AA standards</li>
          <li><strong>Consistent Design:</strong> Unified visual language across all components</li>
          <li><strong>Responsive:</strong> Mobile-first approach with responsive design patterns</li>
          <li><strong>Customizable:</strong> Flexible theming system for easy customization</li>
          <li><strong>Performance:</strong> Optimized for fast loading and smooth interactions</li>
          <li><strong>Developer Experience:</strong> TypeScript support with excellent IntelliSense</li>
        </ul>

        <h2>Getting Started with Components</h2>

        <p>
          Each component can be imported individually to keep your bundle size minimal:
        </p>

        <pre><code>{`import { Button, Card, Input } from '@storacha/console-toolkit'

// Or import specific components
import Button from '@storacha/console-toolkit/Button'
import Card from '@storacha/console-toolkit/Card'`}</code></pre>

        <h2>Component Props and TypeScript</h2>

        <p>
          All components come with full TypeScript support. You can import types for better 
          development experience:
        </p>

        <pre><code>{`import { Button, ButtonProps } from '@storacha/console-toolkit'

interface MyComponentProps {
  onSubmit: () => void
}

function MyComponent({ onSubmit }: MyComponentProps) {
  const buttonProps: ButtonProps = {
    variant: 'primary',
    size: 'large',
    onClick: onSubmit
  }
  
  return <Button {...buttonProps}>Submit</Button>
}`}</code></pre>

        <blockquote>
          <p>
            <strong>Pro Tip:</strong> Use your IDE's IntelliSense to explore available props and 
            their types. Most components also accept standard HTML attributes through prop spreading.
          </p>
        </blockquote>
      </MDXContent>
    </Layout>
  )
}

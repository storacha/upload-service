import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'
import Link from 'next/link'
import { ArrowRightIcon, CodeBracketIcon, ShieldCheckIcon, CloudArrowUpIcon, PaintBrushIcon } from '@heroicons/react/24/outline'

const toolkitFeatures = [
  {
    name: 'Authentication Suite',
    description: 'Complete authentication flow with email-based login, account management, and session handling.',
    icon: ShieldCheckIcon,
    href: '/ui-toolkit/authentication',
    components: ['Authenticator', 'Provider', 'useW3', 'useAuthenticator']
  },
  {
    name: 'Space Management',
    description: 'Manage Web3.Storage spaces with creation, switching, and access control capabilities.',
    icon: CodeBracketIcon,
    href: '/ui-toolkit/space-management',
    components: ['SpaceEnsurer', 'SpaceSwitcher', 'SpaceCreator']
  },
  {
    name: 'Content Management',
    description: 'Upload, manage, and organize files with progress tracking and error handling.',
    icon: CloudArrowUpIcon,
    href: '/ui-toolkit/content-management',
    components: ['Uploader', 'UploadsList', 'FileManager']
  },
  {
    name: 'Theming & Styling',
    description: 'Flexible theming system with dark/light mode support and customizable design tokens.',
    icon: PaintBrushIcon,
    href: '/ui-toolkit/theming',
    components: ['ThemeProvider', 'ThemeToggle', 'DesignTokens']
  }
]

const integrationGoals = [
  {
    title: 'Zero Navigation Context Switches',
    description: 'Seamless integration without iframe navigation or context switching',
    status: '✅ Implemented'
  },
  {
    title: '<5 Minute Integration Time',
    description: 'Quick setup with minimal configuration required',
    status: '✅ Achieved'
  },
  {
    title: 'Consistent Styling',
    description: 'Unified design language across all integrations',
    status: '✅ Implemented'
  },
  {
    title: '100% Component Test Coverage',
    description: 'Comprehensive testing for reliability and stability',
    status: '🔄 In Progress'
  },
  {
    title: 'Comprehensive Documentation',
    description: 'Complete docs with live examples and integration guides',
    status: '🔄 In Progress'
  }
]

export default function UIToolkitOverviewPage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Storacha Console Integration Toolkit</h1>
        
        <p>
          The Storacha Console Integration Toolkit is a comprehensive React component library designed 
          to seamlessly integrate Storacha's Web3.Storage features into partner applications. Built 
          with modern React patterns and TypeScript, it provides plug-and-play components for 
          authentication, file management, and space operations.
        </p>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 my-8">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
            🎯 Mission Statement
          </h3>
          <p className="text-blue-800 dark:text-blue-200">
            Transform the current low-level UI package into a comprehensive UI toolkit for seamless 
            integration of Storacha features into partner applications, eliminating "double navigation" 
            UX friction and enabling native integration into host apps.
          </p>
        </div>

        <h2>Key Features</h2>

        <div className="grid gap-6 md:grid-cols-2 not-prose my-8">
          {toolkitFeatures.map((feature) => (
            <Link
              key={feature.name}
              href={feature.href}
              className="group block rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:border-hot-blue dark:hover:border-hot-blue-light hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center gap-3 mb-3">
                <feature.icon className="h-6 w-6 text-hot-blue dark:text-hot-blue-light" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-hot-blue dark:group-hover:text-hot-blue-light">
                  {feature.name}
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {feature.description}
              </p>
              <div className="flex flex-wrap gap-2">
                {feature.components.map((component) => (
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

        <h2>Package Structure</h2>

        <p>
          The UI Toolkit is organized into modular packages that can be imported individually 
          or as a complete suite:
        </p>

        <pre><code>{`@storacha/ui-react
├── @storacha/ui-core          # Core functionality and types
├── @storacha/ui-react         # React components and hooks
└── @storacha/encrypt-upload-client  # Encrypted upload support`}</code></pre>

        <h3>Installation</h3>

        <pre><code>{`# Install the main React package
npm install @storacha/ui-react

# Or install specific packages
npm install @storacha/ui-core
npm install @storacha/encrypt-upload-client`}</code></pre>

        <h2>Integration Goals & Status</h2>

        <div className="space-y-4 my-8">
          {integrationGoals.map((goal, index) => (
            <div key={index} className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex-shrink-0">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {goal.status}
                </span>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                  {goal.title}
                </h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {goal.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <h2>Component Migration Coverage</h2>

        <p>
          The toolkit covers all major Storacha console features through dedicated component suites:
        </p>

        <ul>
          <li><strong>Space Picker</strong> → <Link href="/ui-toolkit/space-management">Space Management Suite</Link></li>
          <li><strong>Listing Content, FileUploader, SharingTools</strong> → <Link href="/ui-toolkit/content-management">Content Management Suite</Link></li>
          <li><strong>Sign in/Sign up</strong> → <Link href="/ui-toolkit/authentication">Authentication Suite</Link></li>
          <li><strong>UI Packaging & Theming</strong> → <Link href="/ui-toolkit/theming">Theming System</Link></li>
          <li><strong>Docs & Adoption</strong> → <Link href="/examples">Examples & Integration Guides</Link></li>
        </ul>

        <h2>Easy Integration Goals</h2>

        <div className="grid gap-4 md:grid-cols-2 my-8">
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
            <h4 className="font-semibold mb-2">Package Structure</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>✅ Supports <code>npm install @storacha/ui</code></li>
              <li>✅ Component-level imports supported</li>
              <li>✅ Tree-shaking friendly</li>
            </ul>
          </div>
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
            <h4 className="font-semibold mb-2">Documentation</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>✅ Quick start guide</li>
              <li>✅ Comprehensive API reference</li>
              <li>✅ Live examples and demos</li>
            </ul>
          </div>
        </div>

        <h2>Dependencies</h2>

        <p>
          The UI Toolkit has minimal dependencies and is designed to work with modern React applications:
        </p>

        <ul>
          <li><strong>@storacha/ui-react</strong> - Main React component library</li>
          <li><strong>@storacha/ui-core</strong> - Core functionality and types</li>
          <li><strong>@storacha/encrypt-upload-client</strong> - Encrypted upload support</li>
          <li><strong>TailwindCSS</strong> - Styling framework (optional)</li>
          <li><strong>React 16.8+</strong> - Modern React with hooks support</li>
        </ul>

        <h2>Next Steps</h2>

        <p>
          Ready to get started? Here's what you should do next:
        </p>

        <div className="grid gap-4 md:grid-cols-3 my-8">
          <Link
            href="/ui-toolkit/installation"
            className="group block p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-hot-blue dark:hover:border-hot-blue-light hover:shadow-md transition-all duration-200"
          >
            <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-hot-blue dark:group-hover:text-hot-blue-light mb-2">
              Installation Guide
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Learn how to install and configure the UI Toolkit in your project
            </p>
            <ArrowRightIcon className="h-4 w-4 text-gray-400 group-hover:text-hot-blue dark:group-hover:text-hot-blue-light" />
          </Link>

          <Link
            href="/ui-toolkit/provider-setup"
            className="group block p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-hot-blue dark:hover:border-hot-blue-light hover:shadow-md transition-all duration-200"
          >
            <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-hot-blue dark:group-hover:text-hot-blue-light mb-2">
              Provider Setup
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Configure the Provider component for your application
            </p>
            <ArrowRightIcon className="h-4 w-4 text-gray-400 group-hover:text-hot-blue dark:group-hover:text-hot-blue-light" />
          </Link>

          <Link
            href="/examples"
            className="group block p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-hot-blue dark:hover:border-hot-blue-light hover:shadow-md transition-all duration-200"
          >
            <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-hot-blue dark:group-hover:text-hot-blue-light mb-2">
              Live Examples
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Explore working examples and integration patterns
            </p>
            <ArrowRightIcon className="h-4 w-4 text-gray-400 group-hover:text-hot-blue dark:group-hover:text-hot-blue-light" />
          </Link>
        </div>

        <blockquote>
          <p>
            <strong>Pro Tip:</strong> The UI Toolkit is designed to work seamlessly with existing React applications. 
            You can gradually adopt components as needed without requiring a complete rewrite of your application.
          </p>
        </blockquote>
      </MDXContent>
    </Layout>
  )
}

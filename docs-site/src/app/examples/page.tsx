import { Layout } from '@/components/Layout'
import Link from 'next/link'

const examples = [
  { 
    name: 'Sign Up / Sign In', 
    href: '/examples/sign-up-in',
    description: 'Complete authentication flow with email-based login',
    category: 'Authentication'
  },
  { 
    name: 'Single File Upload', 
    href: '/examples/file-upload',
    description: 'Simple file upload with progress tracking',
    category: 'Upload'
  },
  { 
    name: 'Multiple File Upload', 
    href: '/examples/multi-file-upload',
    description: 'Upload multiple files or entire directories',
    category: 'Upload'
  },
  { 
    name: 'Uploads List', 
    href: '/examples/uploads-list',
    description: 'Display and manage uploaded files',
    category: 'Management'
  },
  { 
    name: 'Encrypted Uploads', 
    href: '/examples/encrypted-uploads',
    description: 'Secure file uploads with KMS encryption',
    category: 'Security'
  },
  { 
    name: 'Space Management', 
    href: '/examples/space-management',
    description: 'Create, switch, and manage Web3.Storage spaces',
    category: 'Management'
  },
]

const categories = Array.from(new Set(examples.map((ex) => ex.category)))

export default function ExamplesIndexPage() {
  return (
    <Layout>
      <div className="prose max-w-none">
        <h1>Examples</h1>
        <p>
          Explore live examples and integration recipes for the Storacha UI Toolkit. Each example 
          includes complete code, live demos, and integration patterns you can use in your own applications.
        </p>
      </div>
      
      {categories.map((category) => (
        <div key={category} className="mt-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{category}</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {examples
              .filter(ex => ex.category === category)
              .map((ex) => (
                <Link 
                  key={ex.href} 
                  href={ex.href} 
                  className="group block rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:border-hot-blue dark:hover:border-hot-blue-light hover:shadow-md transition-all duration-200"
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-hot-blue dark:group-hover:text-hot-blue-light mb-2">
                    {ex.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {ex.description}
                  </p>
                  <div className="flex items-center text-sm text-hot-blue dark:text-hot-blue-light group-hover:underline">
                    <span>View example</span>
                    <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
          </div>
        </div>
      ))}
      
      <div className="mt-12 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
          🚀 Getting Started
        </h3>
        <p className="text-blue-800 dark:text-blue-200 mb-4">
          New to the Storacha UI Toolkit? Start with these examples to understand the core concepts:
        </p>
        <div className="space-y-2">
          <Link href="/examples/sign-up-in" className="block text-blue-700 dark:text-blue-300 hover:underline">
            1. Sign Up / Sign In - Learn authentication basics
          </Link>
          <Link href="/examples/file-upload" className="block text-blue-700 dark:text-blue-300 hover:underline">
            2. Single File Upload - Understand upload components
          </Link>
          <Link href="/examples/space-management" className="block text-blue-700 dark:text-blue-300 hover:underline">
            3. Space Management - Learn about space organization
          </Link>
        </div>
      </div>
    </Layout>
  )
}

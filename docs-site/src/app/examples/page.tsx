import { Layout } from '@/components/Layout'
import Link from 'next/link'

const examples = [
  { name: 'Authentication Flow', href: '/examples/auth' },
  { name: 'Space Management', href: '/examples/spaces' },
  { name: 'Uploader', href: '/examples/uploader' },
  { name: 'Uploads List', href: '/examples/uploads-list' },
  { name: 'Sharing Tools', href: '/examples/sharing' },
  { name: 'Dmail / Web3Mail', href: '/examples/dmail' },
]

export default function ExamplesIndexPage() {
  return (
    <Layout>
      <div className="prose max-w-none">
        <h1>Examples</h1>
        <p>Explore live examples and integration recipes. Each example links to code and a sandbox.</p>
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {examples.map((ex) => (
          <Link key={ex.href} href={ex.href} className="rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:border-hot-blue dark:hover:border-hot-blue-light">
            <h3 className="text-lg font-semibold">{ex.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Open example →</p>
          </Link>
        ))}
      </div>
    </Layout>
  )
}

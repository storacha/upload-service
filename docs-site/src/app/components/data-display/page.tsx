import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'

export default function DataDisplayComponentsPage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Data Display Components</h1>
        <p>
          Present information clearly with cards, tables, badges, and modals. Prefer concise summaries and
          progressive disclosure.
        </p>

        <h2>Card</h2>
        <pre><code>{`<div className="rounded border border-gray-700 bg-gray-900 p-4">
  <h3 className="text-lg font-semibold mb-2">Title</h3>
  <p className="text-gray-400">Description content…</p>
</div>`}</code></pre>

        <h2>Table</h2>
        <pre><code>{`<table className="w-full text-left">
  <thead className="text-xs uppercase text-gray-400">
    <tr><th className="py-2">Name</th><th className="py-2">Status</th></tr>
  </thead>
  <tbody>
    <tr><td className="py-2">Job #1</td><td className="py-2">Queued</td></tr>
    <tr><td className="py-2">Job #2</td><td className="py-2">Running</td></tr>
  </tbody>
</table>`}</code></pre>

        <h2>Badges</h2>
        <pre><code>{`<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-800">Queued</span>`}</code></pre>
      </MDXContent>
    </Layout>
  )
}

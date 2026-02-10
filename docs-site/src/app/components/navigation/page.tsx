import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'

export default function NavigationComponentsPage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Navigation Components</h1>
        <p>
          Use clear and consistent navigation patterns. The docs site demonstrates a responsive sidebar,
          top header, and breadcrumb patterns.
        </p>

        <h2>Sidebar</h2>
        <pre><code>{`<aside className="hidden lg:flex w-72 border-r">
  {/* Collapsible sections with chevrons */}
</aside>`}</code></pre>

        <h2>Tabs</h2>
        <pre><code>{`<div className="inline-flex rounded-full bg-hot-red-light border-2 border-hot-red p-1">
  <button className="px-4 py-2 rounded-full bg-white text-hot-red">Overview</button>
  <button className="px-4 py-2 rounded-full hover:bg-hot-red hover:text-white">Settings</button>
</div>`}</code></pre>

        <h2>Breadcrumbs</h2>
        <pre><code>{`Home / Components / Navigation`}</code></pre>

        <h2>Accessibility</h2>
        <ul>
          <li>Use <code>nav</code> landmarks</li>
          <li>Ensure focus states are visible</li>
          <li>Preserve keyboard navigation</li>
        </ul>
      </MDXContent>
    </Layout>
  )
}

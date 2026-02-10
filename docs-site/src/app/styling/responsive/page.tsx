import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'

export default function ResponsivePage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Responsive Design</h1>
        <p>
          Console Toolkit uses a mobile-first, responsive approach with Tailwind breakpoints. Sidebars collapse,
          content stacks, and grids adapt automatically.
        </p>

        <h2>Breakpoints</h2>
        <ul>
          <li><code>sm</code>: 640px</li>
          <li><code>md</code>: 768px</li>
          <li><code>lg</code>: 1024px</li>
          <li><code>xl</code>: 1280px</li>
        </ul>

        <h2>Patterns</h2>
        <ul>
          <li>Sidebar becomes a drawer on small screens</li>
          <li>Top bar keeps primary actions reachable</li>
          <li>Grids change columns with <code>md:</code>, <code>lg:</code> utilities</li>
        </ul>

        <h2>Example</h2>
        <pre><code>{`<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <div className="rounded bg-gray-800 p-4">Card</div>
  <div className="rounded bg-gray-800 p-4">Card</div>
  <div className="rounded bg-gray-800 p-4">Card</div>
</div>`}</code></pre>
      </MDXContent>
    </Layout>
  )
}

import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'

export default function CoreAPIPage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Core API</h1>
        <p>
          The Core API provides primitives for layout, navigation, theming, and data display in Console Toolkit.
        </p>

        <h2>Imports</h2>
        <pre><code>{`import { Layout, Header, Sidebar } from '@storacha/console-toolkit'`}</code></pre>

        <h2>Usage</h2>
        <pre><code>{`export default function App() {
  return (
    <Layout>
      <Header />
      <main className="p-6">Content</main>
    </Layout>
  )
}`}</code></pre>

        <h2>Props</h2>
        <ul>
          <li><code>Layout</code>: <code>children: ReactNode</code></li>
          <li><code>Header</code>: <code>actions?: ReactNode</code></li>
          <li><code>Sidebar</code>: <code>items?: NavItem[]</code></li>
        </ul>
      </MDXContent>
    </Layout>
  )
}

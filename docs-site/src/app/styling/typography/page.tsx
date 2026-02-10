import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'

export default function TypographyPage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Typography</h1>
        <p>
          Typography follows a clear hierarchy using the Epilogue font. Use the provided heading classes
          and prose defaults for consistent rhythm.
        </p>

        <h2>Scale</h2>
        <ul>
          <li><strong>H1</strong>: text-3xl / font-bold</li>
          <li><strong>H2</strong>: text-2xl / font-semibold</li>
          <li><strong>H3</strong>: text-xl / font-semibold</li>
          <li><strong>Body</strong>: base / leading-relaxed</li>
          <li><strong>Small</strong>: text-sm</li>
        </ul>

        <h2>Examples</h2>
        <pre><code>{`<h1 className="text-3xl font-bold">Page Title</h1>
<p className="text-gray-300 leading-relaxed">Body copy with comfortable line-height.</p>`}</code></pre>

        <h2>Code</h2>
        <pre><code>{`<code className="bg-gray-800 text-hot-yellow px-2 py-1 rounded">npm run build</code>`}</code></pre>
      </MDXContent>
    </Layout>
  )
}

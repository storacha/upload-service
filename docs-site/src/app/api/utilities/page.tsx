import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'

export default function UtilitiesAPIPage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Utilities</h1>
        <p>
          Helper utilities used across Console Toolkit for formatting, class merging, and async handling.
        </p>

        <h2>Class Merge</h2>
        <pre><code>{`import { cn } from '@storacha/console-toolkit/utils'

cn('px-2', condition && 'text-hot-blue')`}</code></pre>

        <h2>Formatting</h2>
        <pre><code>{`formatBytes(123456) // => "120.6 KB"`}</code></pre>
      </MDXContent>
    </Layout>
  )
}

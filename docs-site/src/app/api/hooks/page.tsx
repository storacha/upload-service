import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'

export default function HooksAPIPage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Hooks</h1>
        <p>
          React hooks for common patterns in Console Toolkit.
        </p>

        <h2>useLocalStorage</h2>
        <pre><code>{`const [theme, setTheme] = useLocalStorage('theme', 'dark')`}</code></pre>

        <h2>useMediaQuery</h2>
        <pre><code>{`const isLarge = useMediaQuery('(min-width: 1024px)')`}</code></pre>
      </MDXContent>
    </Layout>
  )
}

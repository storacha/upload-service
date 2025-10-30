import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'

export default function TypesAPIPage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Types</h1>
        <p>
          TypeScript interfaces used across Console Toolkit components and utilities.
        </p>

        <h2>Common Types</h2>
        <pre><code>{`export interface NavItem {
  name: string
  href?: string
  children?: NavItem[]
}

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
}`}</code></pre>
      </MDXContent>
    </Layout>
  )
}

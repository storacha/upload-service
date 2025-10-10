import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'
import { PropsTable } from '@/components/PropsTable'
import { Playground } from '@/components/Playground'

export default function AuthSuitePage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Authentication Suite</h1>
        <p>Components and hooks for sign-in, session state, and auth flows.</p>

        <h2>AuthProvider</h2>
        <PropsTable rows={[
          { name: 'children', type: 'ReactNode', description: 'Wrapped app content' },
          { name: 'onSignIn', type: '() => Promise<void>', description: 'Custom sign-in handler' },
          { name: 'onSignOut', type: '() => Promise<void>', description: 'Custom sign-out handler' },
        ]} />

        <h2>Example</h2>
        <Playground initialCode={`<AuthProvider>\n  <SignInButton />\n</AuthProvider>`} />
      </MDXContent>
    </Layout>
  )
}

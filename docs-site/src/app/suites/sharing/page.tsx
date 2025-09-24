import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'
import { PropsTable } from '@/components/PropsTable'
import { Playground } from '@/components/Playground'

export default function SharingSuitePage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Sharing Tools Suite</h1>
        <p>Integrations like Dmail/Web3Mail and share links.</p>

        <h2>ShareLink</h2>
        <PropsTable rows={[
          { name: 'cid', type: 'string', description: 'Content CID to share' },
          { name: 'expiresIn', type: 'number', description: 'Expiry in seconds' },
        ]} />

        <h2>Example</h2>
        <Playground initialCode={`<ShareLink cid={cid} expiresIn={3600} />`} />
      </MDXContent>
    </Layout>
  )
}

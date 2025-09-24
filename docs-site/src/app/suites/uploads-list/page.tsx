import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'
import { PropsTable } from '@/components/PropsTable'
import { Playground } from '@/components/Playground'

export default function UploadsListSuitePage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Uploads List Suite</h1>
        <p>Display uploads with filters, status, and actions.</p>

        <h2>UploadsList</h2>
        <PropsTable rows={[
          { name: 'space', type: 'Space', description: 'Space to list uploads for' },
          { name: 'onSelect', type: '(cid: string) => void', description: 'Row select callback' },
        ]} />

        <h2>Example</h2>
        <Playground initialCode={`<UploadsList space={space} onSelect={setSelectedCid} />`} />
      </MDXContent>
    </Layout>
  )
}

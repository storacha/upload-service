import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'
import { PropsTable } from '@/components/PropsTable'
import { Playground } from '@/components/Playground'

export default function UploaderSuitePage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Uploader Suite</h1>
        <p>High-level upload primitives with progress, errors, and retry.</p>

        <h2>Uploader</h2>
        <PropsTable rows={[
          { name: 'onFiles', type: '(files: File[]) => Promise<void>', description: 'Handle dropped or selected files' },
          { name: 'accept', type: 'string | string[]', description: 'Accepted mime types' },
          { name: 'maxSize', type: 'number', description: 'Max file size (bytes)' },
        ]} />

        <h2>Example</h2>
        <Playground initialCode={`<Uploader accept="image/*" onFiles={handleUpload} />`} />
      </MDXContent>
    </Layout>
  )
}

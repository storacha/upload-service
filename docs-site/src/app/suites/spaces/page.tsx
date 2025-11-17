import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'
import { PropsTable } from '@/components/PropsTable'
import { Playground } from '@/components/Playground'

export default function SpacesSuitePage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Space Management Suite</h1>
        <p>Components to discover, switch, and manage Spaces.</p>

        <h2>SpaceSwitcher</h2>
        <PropsTable rows={[
          { name: 'spaces', type: 'Space[]', description: 'List of available spaces' },
          { name: 'value', type: 'Space | undefined', description: 'Current space' },
          { name: 'onChange', type: '(s: Space) => void', description: 'Switch handler' },
        ]} />

        <h2>Example</h2>
        <Playground initialCode={`<SpaceSwitcher spaces={spaces} value={current} onChange={setCurrent} />`} />
      </MDXContent>
    </Layout>
  )
}

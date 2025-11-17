import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'

export default function IntegrationContextGuidePage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Integration Context: Iframe vs Native</h1>
        <p>
          Console UI components can run in an iframe (embedded) or native (first-party) context. This guide
          explains differences and how to avoid navigation context switches.
        </p>

        <h2>Iframe</h2>
        <ul>
          <li>Pros: isolation, simple embed, easy theming boundary</li>
          <li>Cons: cross-window messaging, auth bridging</li>
        </ul>

        <h2>Native</h2>
        <ul>
          <li>Pros: seamless routing, shared state, faster interactions</li>
          <li>Cons: tighter coupling, needs app routing integration</li>
        </ul>

        <h2>Recommendations</h2>
        <ul>
          <li>Use iframe for partner embeds and third-party integrations</li>
          <li>Use native in first-party apps that can own routing and auth</li>
          <li>Keep auth session bridging consistent across contexts</li>
        </ul>
      </MDXContent>
    </Layout>
  )
}

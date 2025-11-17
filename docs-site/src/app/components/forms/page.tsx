import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'

export default function FormsComponentsPage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Form Components</h1>
        <p>
          Compose accessible forms with inputs, selects, checkboxes, and form layout helpers. Integrate with
          your preferred form library.
        </p>

        <h2>Inputs</h2>
        <pre><code>{`<label className="block text-sm mb-2">Name</label>
<input className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2" placeholder="Jane Doe" />`}</code></pre>

        <h2>Select</h2>
        <pre><code>{`<label className="block text-sm mb-2">Plan</label>
<select className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2">
  <option>Free</option>
  <option>Pro</option>
</select>`}</code></pre>

        <h2>Validation</h2>
        <ul>
          <li>Use aria-invalid and aria-describedby for errors</li>
          <li>Announce errors near the field</li>
          <li>Validate on submit and on blur for best UX</li>
        </ul>
      </MDXContent>
    </Layout>
  )
}

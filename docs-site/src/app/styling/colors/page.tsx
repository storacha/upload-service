import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'
import { Playground } from '@/components/Playground'
import ColorsDemo from '@/components/demos/ColorsDemo'

export default function ColorsPage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Colors</h1>
        <p>
          Console Toolkit uses Storacha’s vibrant color system. Use semantic classes and keep contrast high
          for readability in both dark and light contexts.
        </p>

        <h2>Palette</h2>
        <Playground initialCode={`// Click a token to preview & copy hex`}>
          <ColorsDemo />
        </Playground>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 not-prose my-6">
          {[
            { name: 'Hot Red', class: 'bg-hot-red', hex: '#E91315' },
            { name: 'Hot Yellow', class: 'bg-hot-yellow', hex: '#FFC83F' },
            { name: 'Hot Blue', class: 'bg-hot-blue', hex: '#0176CE' },
            { name: 'Gray Dark', class: 'bg-gray-dark', hex: '#1d2027' },
          ].map(({ name, class: cls, hex }) => (
            <div className="text-center" key={name}>
              <div className={`w-full h-16 ${cls} rounded-lg mb-2`}></div>
              <div className="text-sm font-medium">{name}</div>
              <div className="text-xs text-gray-400">{hex}</div>
            </div>
          ))}
        </div>

        <h2>Usage</h2>
        <pre><code>{`<button className="bg-hot-blue hover:bg-hot-blue/90 text-white px-4 py-2 rounded">Action</button>
<p className="text-hot-red">Error: Something went wrong</p>`}</code></pre>

        <h2>Guidelines</h2>
        <ul>
          <li>Use <code>hot-blue</code> for links and interactive elements</li>
          <li>Use <code>hot-red</code> for critical actions and error states</li>
          <li>Use <code>hot-yellow</code> for warnings and highlights</li>
          <li>Ensure WCAG AA contrast for text elements</li>
        </ul>
      </MDXContent>
    </Layout>
  )
}

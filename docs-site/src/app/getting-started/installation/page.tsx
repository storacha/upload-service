import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'

export default function InstallationPage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Installation</h1>
        
        <p>
          Console Toolkit can be installed in any React project using your preferred package manager. 
          This guide covers different installation methods and setup options.
        </p>

        <h2>Package Manager Installation</h2>

        <h3>npm</h3>
        <pre><code>npm install @storacha/console-toolkit</code></pre>

        <h3>Yarn</h3>
        <pre><code>yarn add @storacha/console-toolkit</code></pre>

        <h3>pnpm</h3>
        <pre><code>pnpm add @storacha/console-toolkit</code></pre>

        <h2>Peer Dependencies</h2>

        <p>
          Console Toolkit requires React 18+ and React DOM. If you don't have them installed:
        </p>

        <pre><code>npm install react@^18.0.0 react-dom@^18.0.0</code></pre>

        <h2>TypeScript Support</h2>

        <p>
          Console Toolkit is written in TypeScript and includes type definitions. No additional 
          @types packages are needed.
        </p>

        <h2>CSS Framework</h2>

        <p>
          Console Toolkit uses TailwindCSS for styling. You'll need to install and configure 
          Tailwind in your project:
        </p>

        <pre><code>npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p</code></pre>

        <p>Update your <code>tailwind.config.js</code>:</p>

        <pre><code>{`/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@storacha/console-toolkit/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        'hot-red': '#E91315',
        'hot-yellow': '#FFC83F',
        'hot-blue': '#0176CE',
        'gray-dark': '#1d2027',
      },
    },
  },
  plugins: [],
}`}</code></pre>

        <h2>Import Styles</h2>

        <p>Add the Console Toolkit styles to your main CSS file:</p>

        <pre><code>{`@import '@storacha/console-toolkit/dist/styles.css';
@tailwind base;
@tailwind components;
@tailwind utilities;`}</code></pre>

        <h2>Verification</h2>

        <p>
          To verify the installation, create a simple test component:
        </p>

        <pre><code>{`import { Button } from '@storacha/console-toolkit'

function TestComponent() {
  return (
    <Button onClick={() => alert('Console Toolkit is working!')}>
      Test Button
    </Button>
  )
}

export default TestComponent`}</code></pre>

        <blockquote>
          <p>
            <strong>Next.js Users:</strong> If you're using Next.js 13+ with the app directory, 
            make sure to add <code>'use client'</code> directive to components that use interactive features.
          </p>
        </blockquote>
      </MDXContent>
    </Layout>
  )
}

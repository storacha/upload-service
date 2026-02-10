import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'

export default function ConfigurationPage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Configuration</h1>
        <p>
          Configure Console Toolkit to match your project needs. This guide covers environment variables,
          TailwindCSS integration, recommended project structure, and optional analytics/error reporting.
        </p>

        <h2>Environment Variables</h2>
        <p>Add a <code>.env.local</code> file to configure runtime options:</p>
        <pre><code>{`# Example
NEXT_PUBLIC_APP_NAME="Console Toolkit Docs"
NEXT_PUBLIC_DEFAULT_THEME=dark
# Analytics (optional)
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=docs.example.com
`}</code></pre>

        <h2>TailwindCSS Configuration</h2>
        <p>Extend your Tailwind theme with Storacha colors and tokens:</p>
        <pre><code>{`// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'gray-dark': '#1d2027',
        'hot-red': '#E91315',
        'hot-red-light': '#EFE3F3',
        'hot-yellow': '#FFC83F',
        'hot-yellow-light': '#FFE4AE',
        'hot-blue': '#0176CE',
        'hot-blue-light': '#BDE0FF',
      },
      fontFamily: {
        epilogue: ['Epilogue', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
`}</code></pre>

        <h2>Recommended Project Structure</h2>
        <pre><code>{`src/
├─ app/
│  ├─ layout.tsx          # Root layout
│  ├─ page.tsx            # Home
│  ├─ getting-started/    # Guides
│  ├─ components/         # Docs by component area
│  └─ styling/            # Theming and design
└─ components/            # Reusable site UI (Layout, Sidebar, etc.)
`}</code></pre>

        <h2>Global Styles</h2>
        <p>Import Tailwind layers and define prose styles used across docs:</p>
        <pre><code>{`/* src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --hot-red: #E91315;
  --hot-blue: #0176CE;
}

.prose h1 { @apply text-3xl font-bold mb-6; }
.prose h2 { @apply text-2xl font-semibold mt-8 mb-4; }
.prose p  { @apply leading-relaxed text-gray-300; }
`}</code></pre>

        <h2>Analytics & Error Reporting (Optional)</h2>
        <ul>
          <li>Plausible: set <code>NEXT_PUBLIC_PLAUSIBLE_DOMAIN</code> and add provider</li>
          <li>Sentry: wrap the app and set DSN via env</li>
        </ul>

        <h2>Static Export</h2>
        <p>The site is compatible with static hosting (Vercel/Netlify/GitHub Pages):</p>
        <pre><code>{`npm run build
# Output is in .next/ (Vercel) or use Next export if preferred
`}</code></pre>
      </MDXContent>
    </Layout>
  )
}

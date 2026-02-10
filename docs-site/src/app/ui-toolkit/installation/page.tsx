import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'

export default function UIToolkitInstallationPage() {
  return (
    <Layout>
      <MDXContent>
        <h1>UI Toolkit Installation</h1>
        
        <p>
          This guide will walk you through installing and setting up the Storacha Console Integration 
          Toolkit in your React application. The toolkit is designed to be lightweight and easy to integrate.
        </p>

        <h2>Prerequisites</h2>

        <p>
          Before installing the UI Toolkit, make sure you have the following:
        </p>

        <ul>
          <li><strong>Node.js</strong> 16.0 or higher</li>
          <li><strong>React</strong> 16.8 or higher (hooks support required)</li>
          <li><strong>npm</strong>, <strong>yarn</strong>, or <strong>pnpm</strong></li>
        </ul>

        <h2>Package Installation</h2>

        <h3>Main Package</h3>

        <p>
          Install the main React package which includes all core components:
        </p>

        <pre><code>{`# Using npm
npm install @storacha/ui-react

# Using yarn
yarn add @storacha/ui-react

# Using pnpm
pnpm add @storacha/ui-react`}</code></pre>

        <h3>Individual Packages</h3>

        <p>
          For more granular control, you can install individual packages:
        </p>

        <pre><code>{`# Core functionality and types
npm install @storacha/ui-core

# Encrypted upload support (optional)
npm install @storacha/encrypt-upload-client`}</code></pre>

        <h2>Peer Dependencies</h2>

        <p>
          The UI Toolkit requires React and React DOM as peer dependencies. If you don't have them installed:
        </p>

        <pre><code>{`npm install react@^18.0.0 react-dom@^18.0.0`}</code></pre>

        <h2>TypeScript Support</h2>

        <p>
          The UI Toolkit is written in TypeScript and includes comprehensive type definitions. 
          No additional @types packages are needed.
        </p>

        <h2>Basic Setup</h2>

        <p>
          Once installed, you can start using the UI Toolkit components. Here's a minimal setup:
        </p>

        <pre><code>{`import React from 'react'
import { Provider, Authenticator, Uploader } from '@storacha/ui-react'

function App() {
  return (
    <Provider>
      <Authenticator>
        <div className="p-6">
          <h1>My Storacha App</h1>
          <Uploader>
            <Uploader.Form>
              <Uploader.Input />
              <button type="submit">Upload File</button>
            </Uploader.Form>
          </Uploader>
        </div>
      </Authenticator>
    </Provider>
  )
}

export default App`}</code></pre>

        <h2>Environment Configuration</h2>

        <p>
          For encrypted uploads and advanced features, you may need to configure environment variables:
        </p>

        <pre><code>{`# .env.local
NEXT_PUBLIC_UCAN_KMS_URL=https://kms.storacha.network
NEXT_PUBLIC_UCAN_KMS_DID=did:web:kms.storacha.network
NEXT_PUBLIC_UCAN_KMS_LOCATION=us-west1
NEXT_PUBLIC_UCAN_KMS_KEYRING=my-keyring
NEXT_PUBLIC_UCAN_KMS_ALLOW_INSECURE_HTTP=false`}</code></pre>

        <h2>Styling Setup (Optional)</h2>

        <p>
          The UI Toolkit components are unstyled by default, giving you complete control over appearance. 
          However, you can use TailwindCSS for consistent styling:
        </p>

        <h3>Install TailwindCSS</h3>

        <pre><code>{`npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p`}</code></pre>

        <h3>Configure TailwindCSS</h3>

        <p>
          Update your <code>tailwind.config.js</code> to include Storacha's design tokens:
        </p>

        <pre><code>{`/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@storacha/ui-react/**/*.{js,ts,jsx,tsx}"
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

        <h2>Verification</h2>

        <p>
          To verify the installation is working correctly, create a simple test component:
        </p>

        <pre><code>{`import React from 'react'
import { Provider, Authenticator } from '@storacha/ui-react'

function TestComponent() {
  return (
    <Provider>
      <Authenticator>
        <div className="p-4">
          <h2>UI Toolkit is working!</h2>
          <p>If you can see this, the installation was successful.</p>
        </div>
      </Authenticator>
    </Provider>
  )
}

export default TestComponent`}</code></pre>

        <h2>Next Steps</h2>

        <p>
          Now that you have the UI Toolkit installed, you can:
        </p>

        <ul>
          <li><a href="/ui-toolkit/provider-setup">Configure the Provider component</a></li>
          <li><a href="/ui-toolkit/authentication">Set up authentication</a></li>
          <li><a href="/ui-toolkit/space-management">Configure space management</a></li>
          <li><a href="/examples">Explore working examples</a></li>
        </ul>

        <h2>Troubleshooting</h2>

        <h3>Common Issues</h3>

        <div className="space-y-4 my-6">
          <div className="p-4 rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
            <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
              React Version Compatibility
            </h4>
            <p className="text-yellow-700 dark:text-yellow-300 text-sm">
              Make sure you're using React 16.8 or higher. The toolkit relies on React hooks 
              and modern React patterns.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
              TypeScript Errors
            </h4>
            <p className="text-blue-700 dark:text-blue-300 text-sm">
              If you encounter TypeScript errors, make sure you have the latest version of 
              @types/react and @types/react-dom installed.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">
              Build Errors
            </h4>
            <p className="text-red-700 dark:text-red-300 text-sm">
              If you encounter build errors, try clearing your node_modules and reinstalling 
              dependencies. Some bundlers may need additional configuration for ES modules.
            </p>
          </div>
        </div>

        <h3>Getting Help</h3>

        <p>
          If you're still having issues:
        </p>

        <ul>
          <li>Check the <a href="/examples">examples</a> for working implementations</li>
          <li>Review the <a href="/api/core">API documentation</a></li>
          <li>Open an issue on <a href="https://github.com/storacha/upload-service/issues" target="_blank">GitHub</a></li>
        </ul>

        <blockquote>
          <p>
            <strong>Note:</strong> The UI Toolkit is actively developed. Make sure to check for updates 
            regularly and review the changelog for breaking changes.
          </p>
        </blockquote>
      </MDXContent>
    </Layout>
  )
}

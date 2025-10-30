import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'
import { PropsTable } from '@/components/PropsTable'

export default function ProviderSetupPage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Provider Setup</h1>
        
        <p>
          The <code>Provider</code> component is the foundation of the Storacha UI Toolkit. It sets up 
          the Web3.Storage client, manages authentication state, and provides context to all child components.
        </p>

        <h2>Basic Setup</h2>

        <p>
          Wrap your application with the <code>Provider</code> component at the root level:
        </p>

        <pre><code>{`import React from 'react'
import { Provider } from '@storacha/ui-react'

function App() {
  return (
    <Provider>
      {/* Your app content */}
    </Provider>
  )
}

export default App`}</code></pre>

        <h2>Configuration Options</h2>

        <p>
          The Provider accepts several configuration options to customize its behavior:
        </p>

        <PropsTable rows={[
          { 
            name: 'servicePrincipal', 
            type: 'string', 
            description: 'Web3.Storage service principal URL (optional, defaults to production)' 
          },
          { 
            name: 'connection', 
            type: 'string', 
            description: 'Connection endpoint URL (optional, defaults to production)' 
          },
          { 
            name: 'receiptsEndpoint', 
            type: 'URL', 
            description: 'Receipts endpoint for upload confirmations (optional)' 
          },
          { 
            name: 'skipInitialClaim', 
            type: 'boolean', 
            description: 'Skip initial capability claim on startup (default: false)' 
          }
        ]} />

        <h2>Advanced Configuration</h2>

        <p>
          For custom deployments or development environments, you can configure custom endpoints:
        </p>

        <pre><code>{`import React from 'react'
import { Provider } from '@storacha/ui-react'

function App() {
  return (
    <Provider
      servicePrincipal="https://api.web3.storage"
      connection="https://w3s.link"
      receiptsEndpoint={new URL('https://api.web3.storage/receipts')}
    >
      {/* Your app content */}
    </Provider>
  )
}

export default App`}</code></pre>

        <h2>Environment-Based Configuration</h2>

        <p>
          You can use environment variables to configure different endpoints for different environments:
        </p>

        <pre><code>{`// .env.local
NEXT_PUBLIC_WEB3_STORAGE_API_URL=https://api.web3.storage
NEXT_PUBLIC_WEB3_STORAGE_CONNECTION_URL=https://w3s.link
NEXT_PUBLIC_WEB3_STORAGE_RECEIPTS_URL=https://api.web3.storage/receipts`}</code></pre>

        <pre><code>{`import React from 'react'
import { Provider } from '@storacha/ui-react'

function App() {
  const config = {
    servicePrincipal: process.env.NEXT_PUBLIC_WEB3_STORAGE_API_URL,
    connection: process.env.NEXT_PUBLIC_WEB3_STORAGE_CONNECTION_URL,
    receiptsEndpoint: process.env.NEXT_PUBLIC_WEB3_STORAGE_RECEIPTS_URL 
      ? new URL(process.env.NEXT_PUBLIC_WEB3_STORAGE_RECEIPTS_URL)
      : undefined
  }

  return (
    <Provider {...config}>
      {/* Your app content */}
    </Provider>
  )
}

export default App`}</code></pre>

        <h2>Using the Provider Context</h2>

        <p>
          The Provider makes several hooks available to access the Web3.Storage client and state:
        </p>

        <h3>useW3 Hook</h3>

        <p>
          The <code>useW3</code> hook provides access to the client, accounts, and spaces:
        </p>

        <pre><code>{`import React from 'react'
import { useW3 } from '@storacha/ui-react'

function MyComponent() {
  const [{ client, accounts, spaces }, { logout }] = useW3()

  if (!client) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <h2>Accounts: {accounts.length}</h2>
      <h2>Spaces: {spaces.length}</h2>
      <button onClick={logout}>Logout</button>
    </div>
  )
}`}</code></pre>

        <h3>useKMSConfig Hook</h3>

        <p>
          For encrypted uploads, you can configure KMS settings:
        </p>

        <pre><code>{`import React from 'react'
import { useKMSConfig } from '@storacha/ui-react'

function KMSConfig() {
  const { kmsConfig, setKmsConfig, isConfigured } = useKMSConfig({
    keyManagerServiceURL: 'https://kms.storacha.network',
    keyManagerServiceDID: 'did:web:kms.storacha.network'
  })

  return (
    <div>
      <p>KMS Configured: {isConfigured ? 'Yes' : 'No'}</p>
      {/* Your KMS configuration UI */}
    </div>
  )
}`}</code></pre>

        <h2>Error Handling</h2>

        <p>
          The Provider includes built-in error handling for common scenarios:
        </p>

        <pre><code>{`import React from 'react'
import { Provider, useW3 } from '@storacha/ui-react'

function ErrorBoundary({ children }) {
  const [{ client }] = useW3()

  if (!client) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-800 font-semibold">Connection Error</h3>
        <p className="text-red-600">
          Unable to connect to Web3.Storage. Please check your network connection.
        </p>
      </div>
    )
  }

  return children
}

function App() {
  return (
    <Provider>
      <ErrorBoundary>
        {/* Your app content */}
      </ErrorBoundary>
    </Provider>
  )
}`}</code></pre>

        <h2>Development vs Production</h2>

        <p>
          The Provider automatically handles different environments:
        </p>

        <div className="grid gap-4 md:grid-cols-2 my-6">
          <div className="p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
            <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
              Development
            </h4>
            <ul className="text-green-700 dark:text-green-300 text-sm space-y-1">
              <li>• Uses development endpoints</li>
              <li>• Enhanced error messages</li>
              <li>• Debug logging enabled</li>
            </ul>
          </div>
          <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
              Production
            </h4>
            <ul className="text-blue-700 dark:text-blue-300 text-sm space-y-1">
              <li>• Uses production endpoints</li>
              <li>• Optimized performance</li>
              <li>• Minimal logging</li>
            </ul>
          </div>
        </div>

        <h2>Best Practices</h2>

        <h3>1. Single Provider Instance</h3>
        <p>
          Use only one Provider instance per application. Multiple providers can cause 
          state conflicts and unexpected behavior.
        </p>

        <h3>2. Provider Placement</h3>
        <p>
          Place the Provider as high as possible in your component tree, ideally at the 
          root level of your application.
        </p>

        <h3>3. Error Boundaries</h3>
        <p>
          Wrap your Provider with error boundaries to handle connection failures gracefully.
        </p>

        <h3>4. Loading States</h3>
        <p>
          Always check if the client is available before rendering components that depend on it.
        </p>

        <h2>Next Steps</h2>

        <p>
          Now that you have the Provider configured, you can:
        </p>

        <ul>
          <li><a href="/ui-toolkit/authentication">Set up authentication components</a></li>
          <li><a href="/ui-toolkit/space-management">Configure space management</a></li>
          <li><a href="/ui-toolkit/content-management">Add upload functionality</a></li>
          <li><a href="/examples">Explore working examples</a></li>
        </ul>

        <blockquote>
          <p>
            <strong>Tip:</strong> The Provider automatically handles client initialization and state management. 
            You don't need to manually manage Web3.Storage client instances.
          </p>
        </blockquote>
      </MDXContent>
    </Layout>
  )
}

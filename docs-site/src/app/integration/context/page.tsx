import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'

export default function IntegrationContextPage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Integration Context</h1>
        
        <p>
          Understanding the integration context is crucial for successfully implementing the Storacha UI Toolkit 
          in your application. This guide covers different integration approaches and their trade-offs.
        </p>

        <h2>Integration Approaches</h2>

        <p>
          There are two primary ways to integrate Storacha functionality into your application:
        </p>

        <div className="grid gap-6 md:grid-cols-2 my-8">
          <div className="p-6 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
            <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-3">
              🖼️ Iframe Integration
            </h3>
            <p className="text-blue-700 dark:text-blue-300 mb-4">
              Embed Storacha functionality in an iframe within your application.
            </p>
            <ul className="text-blue-700 dark:text-blue-300 text-sm space-y-1">
              <li>✅ Complete isolation</li>
              <li>✅ Simple implementation</li>
              <li>✅ Easy theming boundary</li>
              <li>❌ Cross-window messaging complexity</li>
              <li>❌ Authentication bridging required</li>
            </ul>
          </div>
          
          <div className="p-6 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
            <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-3">
              🏠 Native Integration
            </h3>
            <p className="text-green-700 dark:text-green-300 mb-4">
              Integrate Storacha components directly into your application.
            </p>
            <ul className="text-green-700 dark:text-green-300 text-sm space-y-1">
              <li>✅ Seamless routing</li>
              <li>✅ Shared state management</li>
              <li>✅ Faster interactions</li>
              <li>❌ Tighter coupling</li>
              <li>❌ Requires app routing integration</li>
            </ul>
          </div>
        </div>

        <h2>When to Use Each Approach</h2>

        <h3>Iframe Integration</h3>

        <p>
          Use iframe integration when:
        </p>

        <ul>
          <li><strong>Partner Applications:</strong> Third-party integrations where you need complete isolation</li>
          <li><strong>Quick Prototyping:</strong> Rapid development without deep integration</li>
          <li><strong>Legacy Systems:</strong> Adding Web3.Storage to existing applications without major refactoring</li>
          <li><strong>Security Requirements:</strong> When you need strict isolation between your app and Storacha functionality</li>
        </ul>

        <h3>Native Integration</h3>

        <p>
          Use native integration when:
        </p>

        <ul>
          <li><strong>First-Party Applications:</strong> Applications you fully control and can modify</li>
          <li><strong>Performance Critical:</strong> When you need optimal performance and user experience</li>
          <li><strong>Complex Workflows:</strong> When Storacha functionality is deeply integrated into your user flows</li>
          <li><strong>Custom Styling:</strong> When you need complete control over the appearance and behavior</li>
        </ul>

        <h2>Integration Architecture</h2>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 my-6">
          <h3 className="text-lg font-semibold mb-4">Recommended Architecture</h3>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
              <div>
                <h4 className="font-medium">Provider Setup</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Configure the Storacha Provider at your app root</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
              <div>
                <h4 className="font-medium">Authentication Flow</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Implement authentication using Authenticator components</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
              <div>
                <h4 className="font-medium">Space Management</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Ensure spaces are available for file operations</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
              <div>
                <h4 className="font-medium">Content Operations</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Implement upload, download, and management features</p>
              </div>
            </div>
          </div>
        </div>

        <h2>State Management Integration</h2>

        <p>
          The UI Toolkit provides its own state management through React context. Here's how to integrate it with your existing state management:
        </p>

        <h3>Redux Integration</h3>

        <pre><code>{`import { Provider as ReduxProvider } from 'react-redux'
import { Provider as StorachaProvider } from '@storacha/ui-react'
import { store } from './store'

function App() {
  return (
    <ReduxProvider store={store}>
      <StorachaProvider>
        {/* Your app components */}
      </StorachaProvider>
    </ReduxProvider>
  )
}`}</code></pre>

        <h3>Zustand Integration</h3>

        <pre><code>{`import { Provider as StorachaProvider } from '@storacha/ui-react'
import { useStorachaStore } from './stores/storacha'

function StorachaIntegration() {
  const { setUploads, addUpload } = useStorachaStore()
  
  return (
    <StorachaProvider>
      <Uploader onUploadComplete={(props) => {
        addUpload(props.dataCID)
      }}>
        {/* Upload components */}
      </Uploader>
    </StorachaProvider>
  )
}`}</code></pre>

        <h2>Routing Integration</h2>

        <p>
          Integrate Storacha components with your routing system:
        </p>

        <h3>React Router Integration</h3>

        <pre><code>{`import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Provider as StorachaProvider } from '@storacha/ui-react'

function App() {
  return (
    <BrowserRouter>
      <StorachaProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/files" element={<FilesPage />} />
        </Routes>
      </StorachaProvider>
    </BrowserRouter>
  )
}

function UploadPage() {
  return (
    <Authenticator>
      <SpaceEnsurer>
        <Uploader>
          {/* Upload components */}
        </Uploader>
      </SpaceEnsurer>
    </Authenticator>
  )
}`}</code></pre>

        <h3>Next.js App Router Integration</h3>

        <pre><code>{`// app/layout.tsx
import { Provider as StorachaProvider } from '@storacha/ui-react'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <StorachaProvider>
          {children}
        </StorachaProvider>
      </body>
    </html>
  )
}

// app/upload/page.tsx
import { Authenticator, SpaceEnsurer, Uploader } from '@storacha/ui-react'

export default function UploadPage() {
  return (
    <Authenticator>
      <SpaceEnsurer>
        <Uploader>
          {/* Upload components */}
        </Uploader>
      </SpaceEnsurer>
    </Authenticator>
  )
}`}</code></pre>

        <h2>Authentication Integration</h2>

        <p>
          Integrate Storacha authentication with your existing auth system:
        </p>

        <h3>Custom Auth Provider</h3>

        <pre><code>{`import { useAuthenticator } from '@storacha/ui-react'
import { useAuth } from './hooks/useAuth'

function AuthIntegration() {
  const [{ accounts }] = useAuthenticator()
  const { user, login, logout } = useAuth()

  // Sync Storacha auth with your auth system
  useEffect(() => {
    if (accounts.length > 0 && !user) {
      // User is authenticated with Storacha but not with your system
      login(accounts[0].email)
    } else if (accounts.length === 0 && user) {
      // User is logged out of Storacha but still in your system
      logout()
    }
  }, [accounts, user, login, logout])

  return null // This is just for integration
}`}</code></pre>

        <h2>Error Handling Integration</h2>

        <p>
          Integrate Storacha error handling with your application's error system:
        </p>

        <pre><code>{`import { useUploader } from '@storacha/ui-react'
import { useErrorHandler } from './hooks/useErrorHandler'

function UploadWithErrorHandling() {
  const [{ error, status }] = useUploader()
  const { reportError } = useErrorHandler()

  useEffect(() => {
    if (error && status === 'failed') {
      reportError({
        type: 'STORACHA_UPLOAD_ERROR',
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      })
    }
  }, [error, status, reportError])

  return (
    <Uploader>
      {/* Upload components */}
    </Uploader>
  )
}`}</code></pre>

        <h2>Performance Considerations</h2>

        <h3>Code Splitting</h3>

        <p>
          Implement code splitting to reduce initial bundle size:
        </p>

        <pre><code>{`import { lazy, Suspense } from 'react'

const StorachaUploader = lazy(() => import('./components/StorachaUploader'))

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <StorachaUploader />
    </Suspense>
  )
}`}</code></pre>

        <h3>Lazy Loading</h3>

        <p>
          Load Storacha components only when needed:
        </p>

        <pre><code>{`import { useState } from 'react'
import { Provider as StorachaProvider } from '@storacha/ui-react'

function ConditionalStorachaProvider({ children }) {
  const [shouldLoad, setShouldLoad] = useState(false)

  if (!shouldLoad) {
    return (
      <button onClick={() => setShouldLoad(true)}>
        Enable Web3.Storage Features
      </button>
    )
  }

  return (
    <StorachaProvider>
      {children}
    </StorachaProvider>
  )
}`}</code></pre>

        <h2>Best Practices</h2>

        <h3>1. Gradual Adoption</h3>
        <p>
          Start with simple components and gradually add more complex features as needed.
        </p>

        <h3>2. Error Boundaries</h3>
        <p>
          Wrap Storacha components in error boundaries to prevent crashes from affecting your entire app.
        </p>

        <h3>3. Testing Strategy</h3>
        <p>
          Mock Storacha components in your tests to ensure reliable test execution.
        </p>

        <h3>4. Monitoring</h3>
        <p>
          Monitor Storacha API usage and implement proper logging for debugging.
        </p>

        <h2>Next Steps</h2>

        <p>
          Now that you understand integration contexts, you can:
        </p>

        <ul>
          <li><a href="/integration/iframe-vs-native">Learn about iframe vs native integration</a></li>
          <li><a href="/integration/partner-integration">Explore partner integration patterns</a></li>
          <li><a href="/examples">See complete integration examples</a></li>
        </ul>

        <blockquote>
          <p>
            <strong>Integration Tip:</strong> Start with native integration for better user experience, 
            and consider iframe integration only when you need complete isolation or are working with 
            legacy systems that are difficult to modify.
          </p>
        </blockquote>
      </MDXContent>
    </Layout>
  )
}

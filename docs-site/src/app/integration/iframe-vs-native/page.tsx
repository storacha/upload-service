import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'

export default function IframeVsNativePage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Iframe vs Native Integration</h1>
        
        <p>
          Choosing between iframe and native integration is one of the most important decisions when 
          implementing Storacha functionality. This guide provides a detailed comparison to help you 
          make the right choice for your use case.
        </p>

        <h2>Quick Comparison</h2>

        <div className="overflow-x-auto my-8">
          <table className="min-w-full border border-gray-200 dark:border-gray-700 rounded-lg">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Aspect</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Iframe</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Native</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">Implementation Complexity</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Low</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Medium</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">Performance</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Good</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Excellent</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">User Experience</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Good</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Excellent</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">Isolation</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Complete</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">None</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">Styling Control</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Limited</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Complete</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">State Management</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Complex</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Simple</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>Iframe Integration</h2>

        <p>
          Iframe integration embeds Storacha functionality in a separate window context within your application.
        </p>

        <h3>Advantages</h3>

        <div className="grid gap-4 md:grid-cols-2 my-6">
          <div className="p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
            <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">✅ Complete Isolation</h4>
            <p className="text-green-700 dark:text-green-300 text-sm">
              Storacha code runs in a completely separate context, preventing conflicts with your application.
            </p>
          </div>
          
          <div className="p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
            <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">✅ Simple Implementation</h4>
            <p className="text-green-700 dark:text-green-300 text-sm">
              Just embed an iframe with the Storacha application URL - no complex integration required.
            </p>
          </div>
          
          <div className="p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
            <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">✅ Easy Theming Boundary</h4>
            <p className="text-green-700 dark:text-green-300 text-sm">
              Clear separation between your app's styling and Storacha's styling.
            </p>
          </div>
          
          <div className="p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
            <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">✅ Security</h4>
            <p className="text-green-700 dark:text-green-300 text-sm">
              Storacha code cannot access your application's DOM or JavaScript context.
            </p>
          </div>
        </div>

        <h3>Disadvantages</h3>

        <div className="grid gap-4 md:grid-cols-2 my-6">
          <div className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">❌ Cross-Window Messaging</h4>
            <p className="text-red-700 dark:text-red-300 text-sm">
              Communication between your app and the iframe requires postMessage API, adding complexity.
            </p>
          </div>
          
          <div className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">❌ Authentication Bridging</h4>
            <p className="text-red-700 dark:text-red-300 text-sm">
              You need to pass authentication tokens between your app and the iframe.
            </p>
          </div>
          
          <div className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">❌ Limited Styling Control</h4>
            <p className="text-red-700 dark:text-red-300 text-sm">
              You cannot easily customize the appearance of Storacha components.
            </p>
          </div>
          
          <div className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">❌ Performance Overhead</h4>
            <p className="text-red-700 dark:text-red-300 text-sm">
              Additional overhead from iframe context switching and message passing.
            </p>
          </div>
        </div>

        <h3>Iframe Implementation Example</h3>

        <pre><code>{`import React, { useRef, useEffect } from 'react'

function StorachaIframe({ authToken, onUploadComplete }) {
  const iframeRef = useRef(null)

  useEffect(() => {
    const handleMessage = (event) => {
      // Verify origin for security
      if (event.origin !== 'https://storacha.network') return

      if (event.data.type === 'UPLOAD_COMPLETE') {
        onUploadComplete(event.data.cid)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onUploadComplete])

  const handleIframeLoad = () => {
    // Send authentication token to iframe
    iframeRef.current?.contentWindow?.postMessage({
      type: 'AUTH_TOKEN',
      token: authToken
    }, 'https://storacha.network')
  }

  return (
    <iframe
      ref={iframeRef}
      src="https://storacha.network/embed/upload"
      width="100%"
      height="600"
      onLoad={handleIframeLoad}
      style={{ border: 'none', borderRadius: '8px' }}
    />
  )
}

function App() {
  const [authToken] = useAuth()
  
  const handleUploadComplete = (cid) => {
    console.log('Upload completed:', cid)
    // Handle upload completion in your app
  }

  return (
    <div>
      <h1>My App</h1>
      <StorachaIframe 
        authToken={authToken}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  )
}`}</code></pre>

        <h2>Native Integration</h2>

        <p>
          Native integration embeds Storacha components directly into your application's component tree.
        </p>

        <h3>Advantages</h3>

        <div className="grid gap-4 md:grid-cols-2 my-6">
          <div className="p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
            <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">✅ Seamless Routing</h4>
            <p className="text-green-700 dark:text-green-300 text-sm">
              Storacha components integrate naturally with your application's routing system.
            </p>
          </div>
          
          <div className="p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
            <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">✅ Shared State</h4>
            <p className="text-green-700 dark:text-green-300 text-sm">
              Easy access to shared state between your app and Storacha components.
            </p>
          </div>
          
          <div className="p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
            <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">✅ Faster Interactions</h4>
            <p className="text-green-700 dark:text-green-300 text-sm">
              No context switching overhead, resulting in faster user interactions.
            </p>
          </div>
          
          <div className="p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
            <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">✅ Complete Styling Control</h4>
            <p className="text-green-700 dark:text-green-300 text-sm">
              Full control over component appearance and behavior.
            </p>
          </div>
        </div>

        <h3>Disadvantages</h3>

        <div className="grid gap-4 md:grid-cols-2 my-6">
          <div className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">❌ Tighter Coupling</h4>
            <p className="text-red-700 dark:text-red-300 text-sm">
              Your application becomes more tightly coupled to Storacha's implementation.
            </p>
          </div>
          
          <div className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">❌ App Routing Integration</h4>
            <p className="text-red-700 dark:text-red-300 text-sm">
              Requires integration with your application's routing and state management.
            </p>
          </div>
          
          <div className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">❌ Potential Conflicts</h4>
            <p className="text-red-700 dark:text-red-300 text-sm">
              Risk of CSS or JavaScript conflicts between your app and Storacha components.
            </p>
          </div>
          
          <div className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">❌ Bundle Size</h4>
            <p className="text-red-700 dark:text-red-300 text-sm">
              Storacha components add to your application's bundle size.
            </p>
          </div>
        </div>

        <h3>Native Implementation Example</h3>

        <pre><code>{`import React from 'react'
import { Provider, Authenticator, SpaceEnsurer, Uploader } from '@storacha/ui-react'
import { useAuth } from './hooks/useAuth'

function StorachaUpload() {
  const { user } = useAuth()
  
  const handleUploadComplete = (props) => {
    console.log('Upload completed:', props.dataCID)
    // Update your app's state
    updateUserUploads(props.dataCID)
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Upload Files</h2>
      
      <Uploader onUploadComplete={handleUploadComplete}>
        <Uploader.Form>
          <div className="space-y-4">
            <Uploader.Input className="w-full p-3 border rounded-lg" />
            <button 
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
            >
              Upload
            </button>
          </div>
        </Uploader.Form>
      </Uploader>
    </div>
  )
}

function App() {
  return (
    <Provider>
      <Authenticator>
        <SpaceEnsurer>
          <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow">
              <div className="max-w-7xl mx-auto px-4">
                <h1 className="text-2xl font-bold">My Application</h1>
              </div>
            </header>
            
            <main className="max-w-7xl mx-auto py-6">
              <StorachaUpload />
            </main>
          </div>
        </SpaceEnsurer>
      </Authenticator>
    </Provider>
  )
}`}</code></pre>

        <h2>Decision Matrix</h2>

        <p>
          Use this decision matrix to choose the right integration approach:
        </p>

        <div className="overflow-x-auto my-8">
          <table className="min-w-full border border-gray-200 dark:border-gray-700 rounded-lg">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Use Case</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Recommended</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">Partner/Third-party Integration</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Iframe</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Complete isolation and security</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">First-party Application</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Native</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Better UX and performance</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">Legacy System Integration</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Iframe</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Minimal changes required</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">Performance Critical</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Native</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">No iframe overhead</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">Quick Prototype</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Iframe</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Fastest to implement</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">Custom Styling Required</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Native</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Full styling control</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>Migration Path</h2>

        <p>
          You can start with iframe integration and migrate to native integration later:
        </p>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 my-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4">
            Migration Strategy
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
              <p className="text-blue-800 dark:text-blue-200 text-sm">
                Start with iframe integration for quick implementation
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
              <p className="text-blue-800 dark:text-blue-200 text-sm">
                Gather user feedback and identify pain points
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
              <p className="text-blue-800 dark:text-blue-200 text-sm">
                Plan native integration based on user needs
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</div>
              <p className="text-blue-800 dark:text-blue-200 text-sm">
                Implement native integration incrementally
              </p>
            </div>
          </div>
        </div>

        <h2>Best Practices</h2>

        <h3>For Iframe Integration</h3>
        <ul>
          <li>Always verify message origins for security</li>
          <li>Implement proper error handling for message passing</li>
          <li>Use responsive iframe sizing</li>
          <li>Handle authentication token passing securely</li>
        </ul>

        <h3>For Native Integration</h3>
        <ul>
          <li>Use CSS-in-JS or CSS modules to prevent style conflicts</li>
          <li>Implement proper error boundaries</li>
          <li>Consider code splitting for better performance</li>
          <li>Test thoroughly for component interactions</li>
        </ul>

        <h2>Next Steps</h2>

        <p>
          Now that you understand the trade-offs, you can:
        </p>

        <ul>
          <li><a href="/integration/partner-integration">Learn about partner integration patterns</a></li>
          <li><a href="/integration/auth-flow">Explore authentication flow integration</a></li>
          <li><a href="/examples">See complete integration examples</a></li>
        </ul>

        <blockquote>
          <p>
            <strong>Recommendation:</strong> Start with native integration for first-party applications 
            and iframe integration for third-party integrations. You can always migrate between 
            approaches as your needs evolve.
          </p>
        </blockquote>
      </MDXContent>
    </Layout>
  )
}

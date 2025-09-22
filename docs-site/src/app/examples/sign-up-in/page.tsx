import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'
import { Playground } from '@/components/Playground'

export default function SignUpInExamplePage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Sign Up / Sign In Example</h1>
        
        <p>
          This example demonstrates how to implement a complete authentication flow using the Storacha UI Toolkit. 
          It includes email-based authentication, account management, and session handling.
        </p>

        <h2>Live Demo</h2>

        <p>
          Try the authentication flow below. Enter your email address to sign in or create a new account.
        </p>

        <Playground initialCode={`import React, { useState } from 'react'
import { Provider, Authenticator, useAuthenticator } from '@storacha/ui-react'

function AuthForm() {
  const [{ email, submitted, accounts }, { setEmail }] = useAuthenticator()
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    
    try {
      // The Authenticator handles the actual authentication
      // This is just for custom error handling
    } catch (err) {
      setError(err.message)
    }
  }

  if (accounts.length > 0) {
    return (
      <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
        <h3 className="text-green-800 font-semibold mb-2">✅ Authentication Successful!</h3>
        <p className="text-green-600 mb-4">Welcome! You are now signed in.</p>
        <div className="space-y-2 text-sm">
          <p><strong>Email:</strong> {accounts[0].email}</p>
          <p><strong>Account ID:</strong> {accounts[0].did}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
          Sign In to Web3.Storage
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-hot-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={submitted}
            className="w-full bg-hot-blue hover:bg-hot-blue/90 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitted ? 'Signing in...' : 'Sign In / Sign Up'}
          </button>
        </form>
        
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
            How it works:
          </h4>
          <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <li>1. Enter your email address</li>
            <li>2. Check your email for a verification link</li>
            <li>3. Click the link to complete authentication</li>
            <li>4. You'll be redirected back to this page</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <Provider>
      <Authenticator appName="Storacha UI Toolkit Demo">
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <AuthForm />
        </div>
      </Authenticator>
    </Provider>
  )
}`} />

        <h2>Code Breakdown</h2>

        <p>
          Let's break down the key components and concepts used in this example:
        </p>

        <h3>1. Provider Setup</h3>

        <p>
          The <code>Provider</code> component sets up the Web3.Storage client and provides context to all child components:
        </p>

        <pre><code>{`import { Provider } from '@storacha/ui-react'

function App() {
  return (
    <Provider>
      {/* Your app components */}
    </Provider>
  )
}`}</code></pre>

        <h3>2. Authenticator Component</h3>

        <p>
          The <code>Authenticator</code> component manages authentication state and provides context to child components:
        </p>

        <pre><code>{`import { Authenticator } from '@storacha/ui-react'

function App() {
  return (
    <Provider>
      <Authenticator appName="My App">
        {/* Authentication-aware components */}
      </Authenticator>
    </Provider>
  )
}`}</code></pre>

        <h3>3. useAuthenticator Hook</h3>

        <p>
          The <code>useAuthenticator</code> hook provides access to authentication state and actions:
        </p>

        <pre><code>{`import { useAuthenticator } from '@storacha/ui-react'

function AuthForm() {
  const [{ email, submitted, accounts }, { setEmail }] = useAuthenticator()
  
  // Use the state and actions in your component
  return (
    <form>
      <input 
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
      />
      <button type="submit" disabled={submitted}>
        {submitted ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  )
}`}</code></pre>

        <h2>Authentication States</h2>

        <p>
          The authentication flow has several states that you can handle:
        </p>

        <div className="space-y-4 my-6">
          <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold mb-2">Initial State</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              User hasn't entered email yet. Show email input form.
            </p>
          </div>
          
          <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
            <h4 className="font-semibold mb-2">Submitted State</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Form has been submitted, waiting for email verification. Show loading state.
            </p>
          </div>
          
          <div className="p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
            <h4 className="font-semibold mb-2">Authenticated State</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              User is signed in. Show authenticated content and account information.
            </p>
          </div>
        </div>

        <h2>Email Verification Flow</h2>

        <p>
          The authentication process works as follows:
        </p>

        <ol>
          <li><strong>Email Entry:</strong> User enters their email address</li>
          <li><strong>Form Submission:</strong> Form is submitted and email verification is sent</li>
          <li><strong>Email Verification:</strong> User clicks the verification link in their email</li>
          <li><strong>Redirect:</strong> User is redirected back to your application</li>
          <li><strong>Authentication Complete:</strong> Authentication state is updated automatically</li>
        </ol>

        <h2>Advanced Features</h2>

        <h3>Custom Error Handling</h3>

        <p>
          You can implement custom error handling for authentication failures:
        </p>

        <pre><code>{`function AuthForm() {
  const [{ email, submitted, accounts }, { setEmail }] = useAuthenticator()
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    
    try {
      // The Authenticator handles the actual authentication
      // This is just for custom error handling
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      {/* Rest of form */}
    </form>
  )
}`}</code></pre>

        <h3>Session Management</h3>

        <p>
          The Authenticator automatically handles session persistence and restoration:
        </p>

        <ul>
          <li><strong>Automatic Login:</strong> Users stay logged in across browser sessions</li>
          <li><strong>Session Restoration:</strong> Authentication state is restored on page reload</li>
          <li><strong>Logout:</strong> Users can sign out, clearing all stored credentials</li>
        </ul>

        <h2>Integration with Other Components</h2>

        <p>
          The Authenticator works seamlessly with other UI Toolkit components:
        </p>

        <pre><code>{`import React from 'react'
import { Provider, Authenticator, Uploader, useW3 } from '@storacha/ui-react'

function App() {
  return (
    <Provider>
      <Authenticator>
        <AuthGate>
          <Uploader>
            <Uploader.Form>
              <Uploader.Input />
              <button type="submit">Upload File</button>
            </Uploader.Form>
          </Uploader>
        </AuthGate>
      </Authenticator>
    </Provider>
  )
}

function AuthGate({ children }) {
  const [{ accounts }] = useW3()
  
  if (accounts.length === 0) {
    return (
      <div className="p-6 text-center">
        <h2>Please sign in to upload files</h2>
        <p>You need to be authenticated to use this feature.</p>
      </div>
    )
  }
  
  return children
}`}</code></pre>

        <h2>Best Practices</h2>

        <h3>1. Error Handling</h3>
        <p>
          Always provide clear error messages and fallback states for authentication failures.
        </p>

        <h3>2. Loading States</h3>
        <p>
          Show loading indicators during authentication to improve user experience.
        </p>

        <h3>3. Email Validation</h3>
        <p>
          Validate email format on the client side before submission.
        </p>

        <h3>4. Accessibility</h3>
        <p>
          Ensure your authentication forms are accessible with proper labels and ARIA attributes.
        </p>

        <h2>Next Steps</h2>

        <p>
          Now that you understand authentication, you can:
        </p>

        <ul>
          <li><a href="/examples/file-upload">Learn about file uploads</a></li>
          <li><a href="/examples/space-management">Explore space management</a></li>
          <li><a href="/ui-toolkit/authentication">Read the authentication documentation</a></li>
        </ul>

        <blockquote>
          <p>
            <strong>Security Note:</strong> The authentication system uses Web3.Storage's secure 
            email-based authentication. Private keys are generated and stored securely in the browser.
          </p>
        </blockquote>
      </MDXContent>
    </Layout>
  )
}

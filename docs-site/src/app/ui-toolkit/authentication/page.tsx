import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'
import { PropsTable } from '@/components/PropsTable'
import { Playground } from '@/components/Playground'

export default function AuthenticationSuitePage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Authentication Suite</h1>
        
        <p>
          The Authentication Suite provides a complete authentication flow for Web3.Storage, 
          including email-based login, account management, and session handling. It's designed 
          to be headless and flexible, allowing you to create custom authentication UIs.
        </p>

        <h2>Components Overview</h2>

        <p>
          The Authentication Suite consists of several components that work together:
        </p>

        <ul>
          <li><strong>Authenticator</strong> - Main authentication component</li>
          <li><strong>Authenticator.Form</strong> - Form wrapper for authentication</li>
          <li><strong>Authenticator.EmailInput</strong> - Email input field</li>
          <li><strong>Authenticator.CancelButton</strong> - Cancel authentication button</li>
          <li><strong>useAuthenticator</strong> - Hook for accessing authentication state</li>
        </ul>

        <h2>Basic Usage</h2>

        <p>
          Here's a simple authentication setup:
        </p>

        <Playground initialCode={`import React from 'react'
import { Provider, Authenticator } from '@storacha/ui-react'

function AuthExample() {
  return (
    <Provider>
      <Authenticator>
        <Authenticator.Form>
          <div className="space-y-4">
            <div>
              <label htmlFor="email">Email Address</label>
              <Authenticator.EmailInput 
                id="email"
                placeholder="Enter your email"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
            >
              Sign In / Sign Up
            </button>
          </div>
        </Authenticator.Form>
      </Authenticator>
    </Provider>
  )
}`} />

        <h2>Authenticator Component</h2>

        <p>
          The <code>Authenticator</code> component manages the authentication state and provides 
          context to child components.
        </p>

        <PropsTable rows={[
          { 
            name: 'appName', 
            type: 'string', 
            description: 'Application name for authentication (optional)' 
          },
          { 
            name: 'children', 
            type: 'ReactNode', 
            description: 'Child components that will have access to authentication context' 
          }
        ]} />

        <h3>Authenticator Context</h3>

        <p>
          The Authenticator provides a context with the following state and actions:
        </p>

        <div className="grid gap-4 md:grid-cols-2 my-6">
          <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold mb-2">State</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li><code>email</code> - Current email value</li>
              <li><code>submitted</code> - Whether form has been submitted</li>
              <li><code>accounts</code> - Available accounts</li>
              <li><code>spaces</code> - Available spaces</li>
              <li><code>client</code> - Web3.Storage client instance</li>
            </ul>
          </div>
          <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold mb-2">Actions</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li><code>setEmail</code> - Update email value</li>
              <li><code>cancelLogin</code> - Cancel pending login</li>
              <li><code>logout</code> - Sign out user</li>
            </ul>
          </div>
        </div>

        <h2>useAuthenticator Hook</h2>

        <p>
          The <code>useAuthenticator</code> hook provides access to authentication state and actions:
        </p>

        <pre><code>{`import React from 'react'
import { useAuthenticator } from '@storacha/ui-react'

function AuthStatus() {
  const [{ email, submitted, accounts }, { setEmail, logout }] = useAuthenticator()

  if (accounts.length > 0) {
    return (
      <div>
        <p>Welcome! You have {accounts.length} account(s).</p>
        <button onClick={logout}>Sign Out</button>
      </div>
    )
  }

  return (
    <div>
      <p>Please sign in to continue.</p>
      <input 
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
      />
    </div>
  )
}`}</code></pre>

        <h2>Advanced Authentication Flow</h2>

        <p>
          Here's a more complete authentication example with custom styling and error handling:
        </p>

        <Playground initialCode={`import React, { useState } from 'react'
import { Provider, Authenticator, useAuthenticator } from '@storacha/ui-react'

function AuthForm() {
  const [{ email, submitted, accounts }, { setEmail, cancelLogin }] = useAuthenticator()
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
        <h3 className="text-green-800 font-semibold">Authentication Successful!</h3>
        <p className="text-green-600">You are now signed in.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}
      
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Email Address
        </label>
        <Authenticator.EmailInput
          id="email"
          placeholder="Enter your email"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      
      <div className="flex gap-2">
        <button 
          type="submit"
          disabled={submitted}
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {submitted ? 'Signing in...' : 'Sign In / Sign Up'}
        </button>
        
        {submitted && (
          <button 
            type="button"
            onClick={cancelLogin}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

function AuthExample() {
  return (
    <Provider>
      <Authenticator appName="My Storacha App">
        <div className="max-w-md mx-auto mt-8">
          <h2 className="text-2xl font-bold mb-6">Sign In to Web3.Storage</h2>
          <AuthForm />
        </div>
      </Authenticator>
    </Provider>
  )
}`} />

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
          
          <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold mb-2">Submitted State</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Form has been submitted, waiting for email verification. Show loading state.
            </p>
          </div>
          
          <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
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
          <li>User enters their email address</li>
          <li>Form is submitted and email verification is sent</li>
          <li>User clicks the verification link in their email</li>
          <li>User is redirected back to your application</li>
          <li>Authentication state is updated automatically</li>
        </ol>

        <h2>Session Management</h2>

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
          Now that you have authentication set up, you can:
        </p>

        <ul>
          <li><a href="/ui-toolkit/space-management">Configure space management</a></li>
          <li><a href="/ui-toolkit/content-management">Add upload functionality</a></li>
          <li><a href="/examples/sign-up-in">See a complete authentication example</a></li>
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

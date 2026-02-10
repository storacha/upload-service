import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'
import { PropsTable } from '@/components/PropsTable'
import { Playground } from '@/components/Playground'

export default function ThemingPage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Theming & Styling</h1>
        
        <p>
          The Storacha UI Toolkit is designed to be completely unstyled by default, giving you full control 
          over the appearance of your components. This approach allows for seamless integration into any 
          design system while maintaining consistency with Storacha's design language.
        </p>

        <h2>Design Philosophy</h2>

        <p>
          The UI Toolkit follows these design principles:
        </p>

        <ul>
          <li><strong>Headless by Default:</strong> Components provide functionality without imposed styling</li>
          <li><strong>Flexible Styling:</strong> Use any CSS framework or custom styles</li>
          <li><strong>Accessibility First:</strong> Built-in accessibility features with customizable appearance</li>
          <li><strong>Consistent API:</strong> Predictable component interfaces across all components</li>
        </ul>

        <h2>Storacha Design Tokens</h2>

        <p>
          The toolkit includes Storacha's signature design tokens for consistent branding:
        </p>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 my-6">
          <div className="text-center">
            <div className="w-full h-16 bg-hot-red rounded-lg mb-2"></div>
            <div className="text-sm font-medium">Hot Red</div>
            <div className="text-xs text-gray-500">#E91315</div>
          </div>
          <div className="text-center">
            <div className="w-full h-16 bg-hot-yellow rounded-lg mb-2"></div>
            <div className="text-sm font-medium">Hot Yellow</div>
            <div className="text-xs text-gray-500">#FFC83F</div>
          </div>
          <div className="text-center">
            <div className="w-full h-16 bg-hot-blue rounded-lg mb-2"></div>
            <div className="text-sm font-medium">Hot Blue</div>
            <div className="text-xs text-gray-500">#0176CE</div>
          </div>
          <div className="text-center">
            <div className="w-full h-16 bg-gray-dark rounded-lg mb-2"></div>
            <div className="text-sm font-medium">Gray Dark</div>
            <div className="text-xs text-gray-500">#1d2027</div>
          </div>
        </div>

        <h2>CSS Custom Properties</h2>

        <p>
          Use CSS custom properties for dynamic theming:
        </p>

        <pre><code>{`:root {
  --storacha-hot-red: #E91315;
  --storacha-hot-red-light: #EFE3F3;
  --storacha-hot-yellow: #FFC83F;
  --storacha-hot-yellow-light: #FFE4AE;
  --storacha-hot-blue: #0176CE;
  --storacha-hot-blue-light: #BDE0FF;
  --storacha-gray-dark: #1d2027;
}

[data-theme="dark"] {
  --storacha-hot-red: #ff4757;
  --storacha-hot-blue: #3742fa;
  --storacha-hot-yellow: #ffa502;
}`}</code></pre>

        <h2>TailwindCSS Integration</h2>

        <p>
          The recommended approach is to use TailwindCSS with Storacha's design tokens:
        </p>

        <h3>Installation</h3>

        <pre><code>{`npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p`}</code></pre>

        <h3>Configuration</h3>

        <pre><code>{`/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@storacha/ui-react/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'hot-red': '#E91315',
        'hot-red-light': '#EFE3F3',
        'hot-yellow': '#FFC83F',
        'hot-yellow-light': '#FFE4AE',
        'hot-blue': '#0176CE',
        'hot-blue-light': '#BDE0FF',
        'gray-dark': '#1d2027',
      },
      fontFamily: {
        'epilogue': ['Epilogue', 'sans-serif'],
      },
    },
  },
  plugins: [],
}`}</code></pre>

        <h2>Component Styling Examples</h2>

        <h3>Authentication Form</h3>

        <Playground initialCode={`import React from 'react'
import { Provider, Authenticator, useAuthenticator } from '@storacha/ui-react'

function StyledAuthForm() {
  const [{ email, submitted, accounts }, { setEmail }] = useAuthenticator()

  if (accounts.length > 0) {
    return (
      <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
        <h3 className="text-green-800 font-semibold mb-2">✅ Authenticated</h3>
        <p className="text-green-600">Welcome! You are signed in.</p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
          Sign In to Web3.Storage
        </h2>
        
        <Authenticator.Form>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email Address
              </label>
              <Authenticator.EmailInput
                id="email"
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
          </div>
        </Authenticator.Form>
      </div>
    </div>
  )
}

function App() {
  return (
    <Provider>
      <Authenticator appName="My Storacha App">
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <StyledAuthForm />
        </div>
      </Authenticator>
    </Provider>
  )
}`} />

        <h3>Upload Component</h3>

        <Playground initialCode={`import React from 'react'
import { Provider, Authenticator, Uploader, useUploader } from '@storacha/ui-react'

function StyledUploader() {
  const [{ file, status, error, dataCID }] = useUploader()

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Upload File to Web3.Storage
        </h2>
        
        <Uploader.Form>
          <div className="space-y-6">
            <div>
              <label htmlFor="file" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Choose File
              </label>
              <Uploader.Input
                id="file"
                className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-hot-blue file:text-white hover:file:bg-hot-blue/90 transition-colors"
              />
            </div>
            
            {file && (
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {file.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {status === 'uploading' && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-hot-blue mr-3"></div>
                  <p className="text-blue-600 dark:text-blue-400 font-medium">Uploading...</p>
                </div>
              </div>
            )}
            
            {status === 'succeeded' && dataCID && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-green-600 dark:text-green-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <p className="text-green-600 dark:text-green-400 font-medium">Upload Successful!</p>
                    <p className="text-green-600 dark:text-green-400 text-sm">
                      CID: <code className="bg-green-100 dark:bg-green-800 px-1 rounded">{dataCID.toString()}</code>
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {status === 'failed' && error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-red-600 dark:text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <p className="text-red-600 dark:text-red-400 font-medium">Upload Failed</p>
                </div>
                <p className="text-red-600 dark:text-red-400 text-sm mt-1">{error.message}</p>
              </div>
            )}
            
            <button
              type="submit"
              disabled={!file || status === 'uploading'}
              className="w-full bg-hot-blue hover:bg-hot-blue/90 text-white font-medium py-3 px-4 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'uploading' ? 'Uploading...' : 'Upload File'}
            </button>
          </div>
        </Uploader.Form>
      </div>
    </div>
  )
}

function App() {
  return (
    <Provider>
      <Authenticator>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <StyledUploader />
        </div>
      </Authenticator>
    </Provider>
  )
}`} />

        <h2>Dark Mode Support</h2>

        <p>
          The UI Toolkit components work seamlessly with dark mode implementations:
        </p>

        <pre><code>{`/* TailwindCSS dark mode classes */
.dark {
  --storacha-bg-primary: #1f2937;
  --storacha-bg-secondary: #374151;
  --storacha-text-primary: #f9fafb;
  --storacha-text-secondary: #d1d5db;
}

/* Component dark mode styles */
.uploader-input {
  @apply bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600;
}

.uploader-button {
  @apply bg-hot-blue hover:bg-hot-blue/90 text-white;
}

.uploader-progress {
  @apply bg-blue-200 dark:bg-blue-800;
}`}</code></pre>

        <h2>Custom CSS Framework Integration</h2>

        <p>
          You can integrate with any CSS framework or use custom styles:
        </p>

        <h3>Bootstrap Integration</h3>

        <pre><code>{`import React from 'react'
import { Uploader, useUploader } from '@storacha/ui-react'

function BootstrapUploader() {
  const [{ file, status }] = useUploader()

  return (
    <Uploader.Form>
      <div className="mb-3">
        <label htmlFor="file" className="form-label">Choose File</label>
        <Uploader.Input
          id="file"
          className="form-control"
        />
      </div>
      
      {file && (
        <div className="alert alert-info">
          Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
        </div>
      )}
      
      <button
        type="submit"
        className="btn btn-primary"
        disabled={!file || status === 'uploading'}
      >
        {status === 'uploading' ? 'Uploading...' : 'Upload'}
      </button>
    </Uploader.Form>
  )
}`}</code></pre>

        <h3>Material-UI Integration</h3>

        <pre><code>{`import React from 'react'
import { Button, TextField, Box, Alert } from '@mui/material'
import { Uploader, useUploader } from '@storacha/ui-react'

function MaterialUploader() {
  const [{ file, status, error }] = useUploader()

  return (
    <Uploader.Form>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          type="file"
          inputProps={{ component: Uploader.Input }}
          variant="outlined"
          fullWidth
        />
        
        {file && (
          <Alert severity="info">
            Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </Alert>
        )}
        
        {error && (
          <Alert severity="error">
            Upload failed: {error.message}
          </Alert>
        )}
        
        <Button
          type="submit"
          variant="contained"
          disabled={!file || status === 'uploading'}
          fullWidth
        >
          {status === 'uploading' ? 'Uploading...' : 'Upload'}
        </Button>
      </Box>
    </Uploader.Form>
  )
}`}</code></pre>

        <h2>Responsive Design</h2>

        <p>
          Components are designed to work well on all screen sizes:
        </p>

        <pre><code>{`/* Mobile-first responsive styles */
.uploader-container {
  @apply w-full max-w-md mx-auto p-4;
}

@media (min-width: 768px) {
  .uploader-container {
    @apply max-w-2xl;
  }
}

@media (min-width: 1024px) {
  .uploader-container {
    @apply max-w-4xl;
  }
}

/* Responsive upload form */
.upload-form {
  @apply grid grid-cols-1 gap-4;
}

@media (min-width: 640px) {
  .upload-form {
    @apply grid-cols-2;
  }
}`}</code></pre>

        <h2>Accessibility Considerations</h2>

        <p>
          The UI Toolkit components include built-in accessibility features:
        </p>

        <ul>
          <li><strong>ARIA Labels:</strong> Proper labeling for screen readers</li>
          <li><strong>Keyboard Navigation:</strong> Full keyboard support</li>
          <li><strong>Focus Management:</strong> Proper focus handling</li>
          <li><strong>Color Contrast:</strong> WCAG AA compliant color combinations</li>
        </ul>

        <h2>Best Practices</h2>

        <h3>1. Consistent Spacing</h3>
        <p>
          Use consistent spacing patterns throughout your application for better visual hierarchy.
        </p>

        <h3>2. Color Usage</h3>
        <p>
          Use Storacha's color palette consistently for branding while ensuring accessibility.
        </p>

        <h3>3. Typography</h3>
        <p>
          Maintain consistent typography scales and font weights across components.
        </p>

        <h3>4. Interactive States</h3>
        <p>
          Provide clear visual feedback for hover, focus, and disabled states.
        </p>

        <h2>Next Steps</h2>

        <p>
          Now that you understand theming and styling, you can:
        </p>

        <ul>
          <li><a href="/examples">See styled examples in action</a></li>
          <li><a href="/integration">Learn about integration patterns</a></li>
          <li><a href="/styling/theming">Explore advanced theming options</a></li>
        </ul>

        <blockquote>
          <p>
            <strong>Design Tip:</strong> Start with Storacha's design tokens and customize from there. 
            This ensures consistency while allowing for brand-specific adaptations.
          </p>
        </blockquote>
      </MDXContent>
    </Layout>
  )
}

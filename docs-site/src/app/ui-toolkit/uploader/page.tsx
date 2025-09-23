import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'
import { PropsTable } from '@/components/PropsTable'
import { Playground } from '@/components/Playground'
import UploadDemoSingle from '@/components/demos/UploadDemoSingle'
import UploadDemoMulti from '@/components/demos/UploadDemoMulti'

export default function UploaderComponentsPage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Uploader Components</h1>
        
        <p>
          The Uploader Components provide a comprehensive set of tools for file uploads to Web3.Storage. 
          These components handle everything from simple file inputs to complex multi-file uploads with 
          progress tracking and error handling.
        </p>

        <h2>Component Architecture</h2>

        <p>
          The Uploader components follow a compound component pattern, allowing for flexible composition:
        </p>

        <ul>
          <li><strong>Uploader</strong> - Root component that manages upload state</li>
          <li><strong>Uploader.Form</strong> - Form wrapper that handles submission</li>
          <li><strong>Uploader.Input</strong> - File input component with validation</li>
          <li><strong>useUploader</strong> - Hook for accessing upload state and actions</li>
        </ul>

        <h2>Uploader Root Component</h2>

        <p>
          The main <code>Uploader</code> component manages the upload state and provides context to child components.
        </p>

        <PropsTable rows={[
          { 
            name: 'onUploadComplete', 
            type: '(props: OnUploadCompleteProps) => void', 
            description: 'Callback fired when upload completes successfully' 
          },
          { 
            name: 'defaultWrapInDirectory', 
            type: 'boolean', 
            description: 'Whether single files should be wrapped in a directory (default: false)' 
          },
          { 
            name: 'defaultUploadAsCAR', 
            type: 'boolean', 
            description: 'Whether single files should be uploaded as CAR format (default: false)' 
          },
          { 
            name: 'defaultEncryptionStrategy', 
            type: 'EncryptionStrategy', 
            description: 'Default encryption strategy for private spaces (default: "kms")' 
          },
          { 
            name: 'kmsConfig', 
            type: 'KMSConfig', 
            description: 'KMS configuration for encrypted uploads (optional)' 
          }
        ]} />

        <h3>Upload States</h3>

        <p>
          The Uploader component manages several states:
        </p>

        <div className="grid gap-3 md:grid-cols-2 my-6">
          <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Idle</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">Ready for file selection</p>
          </div>
          <div className="p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">Uploading</h4>
            <p className="text-sm text-blue-600 dark:text-blue-400">File is being uploaded</p>
          </div>
          <div className="p-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
            <h4 className="font-semibold text-green-800 dark:text-green-200 mb-1">Succeeded</h4>
            <p className="text-sm text-green-600 dark:text-green-400">Upload completed successfully</p>
          </div>
          <div className="p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <h4 className="font-semibold text-red-800 dark:text-red-200 mb-1">Failed</h4>
            <p className="text-sm text-red-600 dark:text-red-400">Upload failed with error</p>
          </div>
        </div>

        <h2>Basic Upload Example</h2>
        <Playground initialCode={`// Basic uploader usage
import { Provider, Authenticator, Uploader } from '@storacha/ui-react'
`}>
          <UploadDemoSingle />
        </Playground>

        <Playground initialCode={`import React from 'react'
import { Provider, Authenticator, Uploader, useUploader } from '@storacha/ui-react'

function SimpleUpload() {
  const [{ file, status, error, dataCID }] = useUploader()

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="file" className="block text-sm font-medium mb-1">
          Choose File
        </label>
        <Uploader.Input
          id="file"
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>
      
      {file && (
        <div className="p-3 bg-gray-50 rounded-md">
          <p className="text-sm">
            <strong>Selected:</strong> {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        </div>
      )}
      
      {status === 'uploading' && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            <p className="text-blue-600 text-sm">Uploading...</p>
          </div>
        </div>
      )}
      
      {status === 'succeeded' && dataCID && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-green-600 text-sm">
            ✅ Upload successful! CID: <code className="bg-green-100 px-1 rounded">{dataCID.toString()}</code>
          </p>
        </div>
      )}
      
      {status === 'failed' && error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600 text-sm">❌ Upload failed: {error.message}</p>
        </div>
      )}
      
      <button
        type="submit"
        disabled={!file || status === 'uploading'}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'uploading' ? 'Uploading...' : 'Upload File'}
      </button>
    </div>
  )
}

function App() {
  return (
    <Provider>
      <Authenticator>
        <Uploader onUploadComplete={(props) => {
          console.log('Upload completed:', props)
        }}>
          <Uploader.Form>
            <h2 className="text-xl font-semibold mb-4">Simple File Upload</h2>
            <SimpleUpload />
          </Uploader.Form>
        </Uploader>
      </Authenticator>
    </Provider>
  )
}`} />

        <h2>Advanced Upload with Progress</h2>
        <Playground initialCode={`// Multiple files with progress
import { Uploader } from '@storacha/ui-react'
`}>
          <UploadDemoMulti />
        </Playground>

        <p>
          Track detailed upload progress with shard information:
        </p>

        <Playground initialCode={`import React from 'react'
import { Provider, Authenticator, Uploader, useUploader } from '@storacha/ui-react'

function AdvancedUpload() {
  const [{ 
    file, 
    status, 
    error, 
    dataCID, 
    uploadProgress, 
    storedDAGShards 
  }] = useUploader()

  const totalProgress = Object.values(uploadProgress).reduce((acc, progress) => {
    if (progress.bytesTotal) {
      return acc + (progress.bytesSent / progress.bytesTotal)
    }
    return acc
  }, 0)

  const averageProgress = Object.keys(uploadProgress).length > 0 
    ? (totalProgress / Object.keys(uploadProgress).length) * 100 
    : 0

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="advanced-file" className="block text-sm font-medium mb-1">
          Select File
        </label>
        <Uploader.Input
          id="advanced-file"
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>
      
      {file && (
        <div className="p-3 bg-gray-50 rounded-md">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-gray-500">
                {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {status === 'uploading' && (
        <div className="space-y-3">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex justify-between items-center mb-2">
              <p className="text-blue-600 text-sm font-medium">Uploading...</p>
              <p className="text-blue-600 text-sm">{Math.round(averageProgress)}%</p>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: \`\${averageProgress}%\` }}
              ></div>
            </div>
          </div>
          
          {storedDAGShards.length > 0 && (
            <div className="p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-600">
                Shards stored: {storedDAGShards.length}
              </p>
            </div>
          )}
          
          {Object.keys(uploadProgress).length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Upload Progress:</p>
              {Object.entries(uploadProgress).map(([url, progress]) => (
                <div key={url} className="text-xs">
                  <div className="flex justify-between mb-1">
                    <span className="truncate max-w-xs">{url}</span>
                    <span>{progress.bytesTotal ? Math.round((progress.bytesSent / progress.bytesTotal) * 100) : 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1">
                    <div 
                      className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                      style={{ 
                        width: progress.bytesTotal ? \`\${(progress.bytesSent / progress.bytesTotal) * 100}%\` : '0%' 
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {status === 'succeeded' && dataCID && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-green-600 text-sm font-medium mb-2">✅ Upload Successful!</p>
          <div className="space-y-1 text-xs">
            <p><strong>CID:</strong> <code className="bg-green-100 px-1 rounded">{dataCID.toString()}</code></p>
            <p><strong>Shards:</strong> {storedDAGShards.length}</p>
            <a 
              href={\`https://\${dataCID.toString()}.ipfs.w3s.link\`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-700 hover:text-green-800 underline"
            >
              View on IPFS →
            </a>
          </div>
        </div>
      )}
      
      {status === 'failed' && error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600 text-sm font-medium">❌ Upload Failed</p>
          <p className="text-red-600 text-sm mt-1">{error.message}</p>
        </div>
      )}
      
      <button
        type="submit"
        disabled={!file || status === 'uploading'}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'uploading' ? 'Uploading...' : 'Upload File'}
      </button>
    </div>
  )
}

function App() {
  return (
    <Provider>
      <Authenticator>
        <Uploader onUploadComplete={(props) => {
          console.log('Upload completed:', props)
        }}>
          <Uploader.Form>
            <h2 className="text-xl font-semibold mb-4">Advanced Upload with Progress</h2>
            <AdvancedUpload />
          </Uploader.Form>
        </Uploader>
      </Authenticator>
    </Provider>
  )
}`} />

        <h2>Directory Upload</h2>

        <p>
          Upload entire directories with the <code>allowDirectory</code> prop:
        </p>

        <Playground initialCode={`import React from 'react'
import { Provider, Authenticator, Uploader, useUploader } from '@storacha/ui-react'

function DirectoryUpload() {
  const [{ files, status, error, dataCID }] = useUploader()

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="directory" className="block text-sm font-medium mb-1">
          Select Directory
        </label>
        <Uploader.Input
          id="directory"
          allowDirectory={true}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>
      
      {files && files.length > 0 && (
        <div className="p-3 bg-gray-50 rounded-md">
          <p className="font-medium mb-2">Selected Directory ({files.length} files)</p>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {files.slice(0, 10).map((file, index) => (
              <div key={index} className="text-sm text-gray-600">
                {file.webkitRelativePath || file.name}
                <span className="text-gray-400 ml-2">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            ))}
            {files.length > 10 && (
              <p className="text-sm text-gray-500">... and {files.length - 10} more files</p>
            )}
          </div>
        </div>
      )}
      
      {status === 'uploading' && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            <p className="text-blue-600 text-sm">Uploading directory...</p>
          </div>
        </div>
      )}
      
      {status === 'succeeded' && dataCID && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-green-600 text-sm">
            ✅ Directory uploaded! CID: <code className="bg-green-100 px-1 rounded">{dataCID.toString()}</code>
          </p>
        </div>
      )}
      
      {status === 'failed' && error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600 text-sm">❌ Upload failed: {error.message}</p>
        </div>
      )}
      
      <button
        type="submit"
        disabled={!files || files.length === 0 || status === 'uploading'}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'uploading' ? 'Uploading...' : \`Upload \${files?.length || 0} Files\`}
      </button>
    </div>
  )
}

function App() {
  return (
    <Provider>
      <Authenticator>
        <Uploader onUploadComplete={(props) => {
          console.log('Directory upload completed:', props)
        }}>
          <Uploader.Form>
            <h2 className="text-xl font-semibold mb-4">Directory Upload</h2>
            <DirectoryUpload />
          </Uploader.Form>
        </Uploader>
      </Authenticator>
    </Provider>
  )
}`} />

        <h2>Upload Options</h2>

        <p>
          Configure upload behavior with various options:
        </p>

        <div className="space-y-4 my-6">
          <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold mb-2">Wrap in Directory</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Wrap single files in a directory structure for better organization
            </p>
            <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded">
{`<Uploader defaultWrapInDirectory={true}>
  {/* Single files will be wrapped in a directory */}
</Uploader>`}
            </pre>
          </div>
          
          <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold mb-2">Upload as CAR</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Upload single files as CAR (Content Addressed Archive) format
            </p>
            <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded">
{`<Uploader defaultUploadAsCAR={true}>
  {/* Files will be uploaded as CAR format */}
</Uploader>`}
            </pre>
          </div>
        </div>

        <h2>useUploader Hook</h2>

        <p>
          Access upload state and actions with the <code>useUploader</code> hook:
        </p>

        <PropsTable rows={[
          { 
            name: 'file', 
            type: 'File | undefined', 
            description: 'Currently selected single file' 
          },
          { 
            name: 'files', 
            type: 'File[] | undefined', 
            description: 'Currently selected files (for multi-file uploads)' 
          },
          { 
            name: 'status', 
            type: 'UploadStatus', 
            description: 'Current upload status (idle, uploading, succeeded, failed)' 
          },
          { 
            name: 'error', 
            type: 'Error | undefined', 
            description: 'Error from failed upload' 
          },
          { 
            name: 'dataCID', 
            type: 'AnyLink | undefined', 
            description: 'CID of successfully uploaded content' 
          },
          { 
            name: 'uploadProgress', 
            type: 'UploadProgress', 
            description: 'Progress information for each upload shard' 
          },
          { 
            name: 'storedDAGShards', 
            type: 'CARMetadata[]', 
            description: 'Metadata for stored DAG shards' 
          }
        ]} />

        <h2>Error Handling</h2>

        <p>
          Implement robust error handling for various upload scenarios:
        </p>

        <pre><code>{`import { useUploader } from '@storacha/ui-react'

function UploadWithErrorHandling() {
  const [{ status, error, file }] = useUploader()

  const getErrorMessage = (error) => {
    if (error.message.includes('network')) {
      return 'Network error. Please check your connection and try again.'
    }
    if (error.message.includes('size')) {
      return 'File is too large. Please select a smaller file.'
    }
    if (error.message.includes('type')) {
      return 'File type not supported. Please select a different file.'
    }
    return 'Upload failed. Please try again.'
  }

  return (
    <div>
      {status === 'failed' && error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Upload Failed</h3>
              <p className="mt-1 text-sm text-red-700">{getErrorMessage(error)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}`}</code></pre>

        <h2>Best Practices</h2>

        <h3>1. File Validation</h3>
        <p>
          Validate file types and sizes before upload to prevent unnecessary failures.
        </p>

        <h3>2. Progress Feedback</h3>
        <p>
          Always show upload progress for files larger than a few MB.
        </p>

        <h3>3. Error Recovery</h3>
        <p>
          Provide clear error messages and retry options for failed uploads.
        </p>

        <h3>4. Accessibility</h3>
        <p>
          Ensure upload components are accessible with proper labels and ARIA attributes.
        </p>

        <h2>Next Steps</h2>

        <p>
          Now that you understand the Uploader components, you can:
        </p>

        <ul>
          <li><a href="/ui-toolkit/content-management">Learn about content management</a></li>
          <li><a href="/examples">Explore complete examples</a></li>
          <li><a href="/integration">Learn about integration patterns</a></li>
        </ul>

        <blockquote>
          <p>
            <strong>Performance Tip:</strong> For large files, consider implementing file chunking 
            and resumable uploads for better reliability and user experience.
          </p>
        </blockquote>
      </MDXContent>
    </Layout>
  )
}

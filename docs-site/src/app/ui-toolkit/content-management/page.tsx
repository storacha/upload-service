import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'
import { PropsTable } from '@/components/PropsTable'
import { Playground } from '@/components/Playground'

export default function ContentManagementPage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Content Management Suite</h1>
        
        <p>
          The Content Management Suite provides comprehensive tools for uploading, managing, and organizing 
          files in Web3.Storage. It includes upload components, file listing, progress tracking, and 
          sharing capabilities.
        </p>

        <h2>Components Overview</h2>

        <p>
          The Content Management Suite consists of several key components:
        </p>

        <ul>
          <li><strong>Uploader</strong> - Main upload component with progress tracking</li>
          <li><strong>Uploader.Input</strong> - File input component</li>
          <li><strong>Uploader.Form</strong> - Form wrapper for uploads</li>
          <li><strong>useUploader</strong> - Hook for upload state management</li>
          <li><strong>UploadsList</strong> - Component for listing uploaded files</li>
        </ul>

        <h2>Uploader Component</h2>

        <p>
          The <code>Uploader</code> component handles file uploads with progress tracking, error handling, 
          and support for both single files and directories.
        </p>

        <PropsTable rows={[
          { 
            name: 'onUploadComplete', 
            type: '(props: OnUploadCompleteProps) => void', 
            description: 'Callback when upload completes successfully' 
          },
          { 
            name: 'defaultWrapInDirectory', 
            type: 'boolean', 
            description: 'Whether to wrap single files in a directory (default: false)' 
          },
          { 
            name: 'defaultUploadAsCAR', 
            type: 'boolean', 
            description: 'Whether to upload single files as CAR format (default: false)' 
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

        <h3>Basic Upload Example</h3>

        <Playground initialCode={`import React from 'react'
import { Provider, Authenticator, Uploader, useUploader } from '@storacha/ui-react'

function UploadForm() {
  const [{ file, status, error, dataCID }, { setFile }] = useUploader()

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="file-input" className="block text-sm font-medium mb-1">
          Select File
        </label>
        <Uploader.Input
          id="file-input"
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
          <p className="text-blue-600 text-sm">Uploading...</p>
        </div>
      )}
      
      {status === 'succeeded' && dataCID && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-green-600 text-sm">
            Upload successful! CID: {dataCID.toString()}
          </p>
        </div>
      )}
      
      {status === 'failed' && error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600 text-sm">Upload failed: {error.message}</p>
        </div>
      )}
      
      <button
        type="submit"
        disabled={!file || status === 'uploading'}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
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
            <h2 className="text-xl font-semibold mb-4">Upload File</h2>
            <UploadForm />
          </Uploader.Form>
        </Uploader>
      </Authenticator>
    </Provider>
  )
}`} />

        <h2>Multiple File Upload</h2>

        <p>
          Support for uploading multiple files or entire directories:
        </p>

        <Playground initialCode={`import React from 'react'
import { Provider, Authenticator, Uploader, useUploader } from '@storacha/ui-react'

function MultiFileUpload() {
  const [{ files, status, uploadProgress }, { setFiles }] = useUploader()

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFiles([...e.target.files])
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="files-input" className="block text-sm font-medium mb-1">
          Select Files or Directory
        </label>
        <input
          id="files-input"
          type="file"
          multiple
          webkitdirectory="true"
          onChange={handleFileChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
      </div>
      
      {files && files.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium">Selected Files ({files.length})</h4>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {files.map((file, index) => (
              <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                {file.webkitRelativePath || file.name}
                <span className="text-gray-500 ml-2">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {status === 'uploading' && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Upload Progress</p>
          {Object.entries(uploadProgress).map(([url, progress]) => (
            <div key={url} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>{url}</span>
                <span>{progress.bytesTotal ? Math.round((progress.bytesSent / progress.bytesTotal) * 100) : 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: progress.bytesTotal ? Math.round((progress.bytesSent / progress.bytesTotal) * 100) : '0%' 
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <button
        type="submit"
        disabled={!files || files.length === 0 || status === 'uploading'}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {status === 'uploading' ? 'Uploading...' : 'Upload [n] Files'}
      </button>
    </div>
  )
}

function App() {
  return (
    <Provider>
      <Authenticator>
        <Uploader>
          <Uploader.Form>
            <h2 className="text-xl font-semibold mb-4">Upload Multiple Files</h2>
            <MultiFileUpload />
          </Uploader.Form>
        </Uploader>
      </Authenticator>
    </Provider>
  )
}`} />

        <h2>Encrypted Uploads</h2>

        <p>
          For private spaces, files are automatically encrypted using KMS (Key Management Service):
        </p>

        <Playground initialCode={`import React from 'react'
import { Provider, Authenticator, Uploader } from '@storacha/ui-react'

function EncryptedUploadApp() {
  const kmsConfig = {
    keyManagerServiceURL: process.env.NEXT_PUBLIC_UCAN_KMS_URL || 'https://kms.storacha.network',
    keyManagerServiceDID: process.env.NEXT_PUBLIC_UCAN_KMS_DID || 'did:web:kms.storacha.network',
    location: process.env.NEXT_PUBLIC_UCAN_KMS_LOCATION,
    keyring: process.env.NEXT_PUBLIC_UCAN_KMS_KEYRING
  }

  return (
    <Provider>
      <Authenticator>
        <Uploader 
          defaultEncryptionStrategy="kms"
          kmsConfig={kmsConfig}
          onUploadComplete={(props) => {
            console.log('Encrypted upload completed:', props)
          }}
        >
          <Uploader.Form>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
              <h3 className="font-semibold text-blue-800 mb-2">🔒 Encrypted Upload</h3>
              <p className="text-blue-700 text-sm">
                Files will be encrypted using KMS before upload. This is automatically enabled for private spaces.
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="encrypted-file" className="block text-sm font-medium mb-1">
                  Select File to Encrypt
                </label>
                <Uploader.Input
                  id="encrypted-file"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
              >
                Upload Encrypted File
              </button>
            </div>
          </Uploader.Form>
        </Uploader>
      </Authenticator>
    </Provider>
  )
}`} />

        <h2>Upload Options</h2>

        <p>
          The Uploader component supports various upload options:
        </p>

        <div className="grid gap-4 md:grid-cols-2 my-6">
          <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold mb-2">Wrap in Directory</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Wrap single files in a directory structure
            </p>
            <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded">
{`<Uploader defaultWrapInDirectory={true}>
  {/* Single files will be wrapped */}
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
  {/* Files uploaded as CAR */}
</Uploader>`}
            </pre>
          </div>
        </div>

        <h2>Upload Progress Tracking</h2>

        <p>
          Monitor upload progress with detailed status information:
        </p>

        <pre><code>{`import { useUploader } from '@storacha/ui-react'

function UploadProgress() {
  const [{ status, uploadProgress, storedDAGShards }] = useUploader()

  return (
    <div className="space-y-4">
      <div>
        <h4>Upload Status: {status}</h4>
      </div>
      
      {status === 'uploading' && (
        <div>
          <h4>Progress:</h4>
          {Object.entries(uploadProgress).map(([url, progress]) => (
            <div key={url}>
              <p>{url}</p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ 
                    width: '[progress % here]' 
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      
      {storedDAGShards.length > 0 && (
        <div>
          <h4>Stored Shards: {storedDAGShards.length}</h4>
        </div>
      )}
    </div>
  )
}`}</code></pre>

        <h2>File Listing Component</h2>

        <p>
          Create a component to list and manage uploaded files:
        </p>

        <Playground initialCode={`import React, { useState, useEffect } from 'react'
import { useW3 } from '@storacha/ui-react'

function UploadsList() {
  const [{ client, spaces }] = useW3()
  const [uploads, setUploads] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchUploads() {
      if (!client) return

      setLoading(true)
      setError(null)

      try {
        const currentSpace = client.currentSpace()
        if (!currentSpace) {
          throw new Error('No space selected')
        }

        // This is a simplified example - actual implementation would
        // depend on your storage and indexing strategy
        const spaceUploads = await client.list()
        setUploads(spaceUploads.results || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchUploads()
  }, [client, spaces])

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading uploads...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <p className="text-red-600">Error loading uploads: {error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Uploaded Files</h3>
      
      {uploads.length === 0 ? (
        <p className="text-gray-500">No files uploaded yet.</p>
      ) : (
        <div className="space-y-2">
          {uploads.map((upload, index) => (
            <div key={index} className="p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{upload.name || 'Untitled'}</p>
                  <p className="text-sm text-gray-500">
                    CID: {upload.cid}
                  </p>
                  {upload.size && (
                    <p className="text-sm text-gray-500">
                      Size: {(upload.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <a
                    href={'https://[cid].ipfs.w3s.link'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    View
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}`} />

        <h2>Best Practices</h2>

        <h3>1. Error Handling</h3>
        <p>
          Always provide clear error messages and retry options for failed uploads.
        </p>

        <h3>2. Progress Feedback</h3>
        <p>
          Show upload progress to improve user experience, especially for large files.
        </p>

        <h3>3. File Validation</h3>
        <p>
          Validate file types and sizes before upload to prevent unnecessary failures.
        </p>

        <h3>4. Space Management</h3>
        <p>
          Ensure a space is available before allowing uploads.
        </p>

        <h2>Integration with Other Components</h2>

        <p>
          Content management works seamlessly with authentication and space management:
        </p>

        <pre><code>{`import React from 'react'
import { Provider, Authenticator, Uploader, useW3 } from '@storacha/ui-react'

function App() {
  return (
    <Provider>
      <Authenticator>
        <SpaceEnsurer>
          <div className="p-6">
            <SpaceInfo />
            <Uploader>
              <Uploader.Form>
                <Uploader.Input />
                <button type="submit">Upload File</button>
              </Uploader.Form>
            </Uploader>
            <UploadsList />
          </div>
        </SpaceEnsurer>
      </Authenticator>
    </Provider>
  )
}`}</code></pre>

        <h2>Next Steps</h2>

        <p>
          Now that you understand content management, you can:
        </p>

        <ul>
          <li><a href="/ui-toolkit/theming">Customize the appearance</a></li>
          <li><a href="/examples">Explore complete examples</a></li>
          <li><a href="/integration">Learn about integration patterns</a></li>
        </ul>

        <blockquote>
          <p>
            <strong>Performance Tip:</strong> For large files, consider implementing chunked uploads 
            and resumable uploads for better user experience and reliability.
          </p>
        </blockquote>
      </MDXContent>
    </Layout>
  )
}

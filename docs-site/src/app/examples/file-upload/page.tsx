import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'
import { Playground } from '@/components/Playground'
import UploadDemoSingle from '@/components/demos/UploadDemoSingle'

export default function FileUploadExamplePage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Single File Upload Example</h1>
        
        <p>
          This example demonstrates how to implement a simple file upload using the Storacha UI Toolkit. 
          It includes file selection, upload progress tracking, and success/error handling.
        </p>

        <h2>Live Demo</h2>

        <p>
          Try uploading a file below. You'll see real-time progress updates and receive a CID when the upload completes.
        </p>

        <Playground initialCode={`import React from 'react'
import { Provider, Authenticator, Uploader, useUploader } from '@storacha/ui-react'

function FileUploadForm() {
  const [{ file, status, error, dataCID, uploadProgress }] = useUploader()

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getProgressPercentage = () => {
    if (Object.keys(uploadProgress).length === 0) return 0
    const totalProgress = Object.values(uploadProgress).reduce((acc, progress) => {
      if (progress.bytesTotal) {
        return acc + (progress.bytesSent / progress.bytesTotal)
      }
      return acc
    }, 0)
    return Math.round((totalProgress / Object.keys(uploadProgress).length) * 100)
  }

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
                      {formatFileSize(file.size)} • {file.type}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {status === 'uploading' && (
              <div className="space-y-3">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-blue-600 dark:text-blue-400 text-sm font-medium">Uploading...</p>
                    <p className="text-blue-600 dark:text-blue-400 text-sm">{getProgressPercentage()}%</p>
                  </div>
                  <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: \`\${getProgressPercentage()}%\` }}
                    ></div>
                  </div>
                </div>
                
                {Object.keys(uploadProgress).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Upload Progress:</p>
                    {Object.entries(uploadProgress).map(([url, progress]) => (
                      <div key={url} className="text-xs">
                        <div className="flex justify-between mb-1">
                          <span className="truncate max-w-xs text-gray-600 dark:text-gray-400">{url}</span>
                          <span className="text-gray-600 dark:text-gray-400">
                            {progress.bytesTotal ? Math.round((progress.bytesSent / progress.bytesTotal) * 100) : 0}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
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
                <div className="mt-3">
                  <a 
                    href={\`https://\${dataCID.toString()}.ipfs.w3s.link\`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-700 dark:text-green-300 hover:text-green-800 dark:hover:text-green-200 underline text-sm"
                  >
                    View on IPFS →
                  </a>
                </div>
              </div>
            )}
            
            {status === 'failed' && error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-red-600 dark:text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <div>
                    <p className="text-red-600 dark:text-red-400 font-medium">Upload Failed</p>
                    <p className="text-red-600 dark:text-red-400 text-sm mt-1">{error.message}</p>
                  </div>
                </div>
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
          <FileUploadForm />
        </div>
      </Authenticator>
    </Provider>
  )
}`}>
          <UploadDemoSingle />
        </Playground>

        <h2>Code Breakdown</h2>

        <p>
          Let's break down the key components and concepts used in this example:
        </p>

        <h3>1. Uploader Component</h3>

        <p>
          The <code>Uploader</code> component manages the upload state and provides context to child components:
        </p>

        <pre><code>{`import { Uploader } from '@storacha/ui-react'

function App() {
  return (
    <Provider>
      <Authenticator>
        <Uploader onUploadComplete={(props) => {
          console.log('Upload completed:', props)
        }}>
          {/* Upload components */}
        </Uploader>
      </Authenticator>
    </Provider>
  )
}`}</code></pre>

        <h3>2. useUploader Hook</h3>

        <p>
          The <code>useUploader</code> hook provides access to upload state and actions:
        </p>

        <pre><code>{`import { useUploader } from '@storacha/ui-react'

function FileUploadForm() {
  const [{ file, status, error, dataCID, uploadProgress }] = useUploader()
  
  // Use the state in your component
  return (
    <div>
      {file && <p>Selected: {file.name}</p>}
      {status === 'uploading' && <p>Uploading...</p>}
      {status === 'succeeded' && <p>Upload complete!</p>}
      {status === 'failed' && <p>Upload failed: {error.message}</p>}
    </div>
  )
}`}</code></pre>

        <h3>3. Uploader.Input Component</h3>

        <p>
          The <code>Uploader.Input</code> component provides a file input that integrates with the uploader:
        </p>

        <pre><code>{`import { Uploader } from '@storacha/ui-react'

function FileInput() {
  return (
    <Uploader.Input
      className="file-input-styles"
      accept="image/*" // Optional: restrict file types
    />
  )
}`}</code></pre>

        <h2>Upload States</h2>

        <p>
          The upload process has several states that you can handle:
        </p>

        <div className="space-y-4 my-6">
          <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold mb-2">Idle</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Ready for file selection. No file selected yet.
            </p>
          </div>
          
          <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
            <h4 className="font-semibold mb-2">Uploading</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              File is being uploaded. Progress information is available.
            </p>
          </div>
          
          <div className="p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
            <h4 className="font-semibold mb-2">Succeeded</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Upload completed successfully. CID is available.
            </p>
          </div>
          
          <div className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <h4 className="font-semibold mb-2">Failed</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Upload failed. Error information is available.
            </p>
          </div>
        </div>

        <h2>Progress Tracking</h2>

        <p>
          The uploader provides detailed progress information for each upload shard:
        </p>

        <pre><code>{`function ProgressDisplay() {
  const [{ uploadProgress }] = useUploader()

  return (
    <div>
      {Object.entries(uploadProgress).map(([url, progress]) => (
        <div key={url}>
          <p>{url}</p>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ 
                width: \`\${(progress.bytesSent / progress.bytesTotal) * 100}%\` 
              }}
            />
          </div>
          <p>{Math.round((progress.bytesSent / progress.bytesTotal) * 100)}%</p>
        </div>
      ))}
    </div>
  )
}`}</code></pre>

        <h2>File Validation</h2>

        <p>
          You can add client-side file validation before upload:
        </p>

        <pre><code>{`function FileUploadWithValidation() {
  const [{ file }, { setFile }] = useUploader()
  const [validationError, setValidationError] = useState(null)

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    setValidationError(null)

    // File size validation (10MB limit)
    if (selectedFile && selectedFile.size > 10 * 1024 * 1024) {
      setValidationError('File size must be less than 10MB')
      return
    }

    // File type validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif']
    if (selectedFile && !allowedTypes.includes(selectedFile.type)) {
      setValidationError('Only JPEG, PNG, and GIF files are allowed')
      return
    }

    setFile(selectedFile)
  }

  return (
    <div>
      <input 
        type="file" 
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/gif"
      />
      {validationError && (
        <p className="error">{validationError}</p>
      )}
    </div>
  )
}`}</code></pre>

        <h2>Error Handling</h2>

        <p>
          Implement robust error handling for various upload scenarios:
        </p>

        <pre><code>{`function UploadWithErrorHandling() {
  const [{ status, error }] = useUploader()

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
        <div className="error-message">
          <h4>Upload Failed</h4>
          <p>{getErrorMessage(error)}</p>
          <button onClick={() => window.location.reload()}>
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}`}</code></pre>

        <h2>Advanced Features</h2>

        <h3>Upload Options</h3>

        <p>
          You can configure various upload options:
        </p>

        <pre><code>{`<Uploader
  defaultWrapInDirectory={true}  // Wrap single files in directory
  defaultUploadAsCAR={false}     // Upload as CAR format
  onUploadComplete={(props) => {
    console.log('Upload completed:', props.dataCID)
  }}
>
  {/* Upload components */}
</Uploader>`}</code></pre>

        <h3>Custom Styling</h3>

        <p>
          Customize the appearance of upload components:
        </p>

        <pre><code>{`<Uploader.Input
  className="custom-file-input"
  style={{
    border: '2px dashed #ccc',
    borderRadius: '8px',
    padding: '20px',
    textAlign: 'center'
  }}
/>`}</code></pre>

        <h2>Best Practices</h2>

        <h3>1. File Validation</h3>
        <p>
          Always validate file types and sizes before upload to prevent unnecessary failures.
        </p>

        <h3>2. Progress Feedback</h3>
        <p>
          Show upload progress for files larger than a few MB to improve user experience.
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
          Now that you understand single file uploads, you can:
        </p>

        <ul>
          <li><a href="/examples/multi-file-upload">Learn about multiple file uploads</a></li>
          <li><a href="/examples/encrypted-uploads">Explore encrypted uploads</a></li>
          <li><a href="/ui-toolkit/uploader">Read the uploader documentation</a></li>
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

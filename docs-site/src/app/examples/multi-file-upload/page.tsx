import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'
import { Playground } from '@/components/Playground'
import UploadDemoMulti from '@/components/demos/UploadDemoMulti'

export default function MultiFileUploadExamplePage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Multiple File Upload Example</h1>

        <p>
          Upload multiple files or entire directories with progress tracking. This demo shows how to
          collect files, visualize progress per shard, and submit the upload.
        </p>

        <h2>Live Demo</h2>

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
                <span className="text-gray-500 ml-2">({(file.size / 1024).toFixed(1)} KB)</span>
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
                <span className="truncate max-w-xs">{url}</span>
                <span>{progress.bytesTotal ? Math.round((progress.bytesSent / progress.bytesTotal) * 100) : 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: progress.bytesTotal ? Math.round((progress.bytesSent / progress.bytesTotal) * 100) + '%' : '0%' }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="submit"
        disabled={!files || files.length === 0 || status === 'uploading'}
        className="w-full bg-hot-blue hover:bg-hot-blue/90 text-white font-medium py-3 px-4 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'uploading' ? 'Uploading...' : 'Upload ' + (files?.length || 0) + ' Files'}
      </button>
    </div>
  )
}

function App() {
  return (
    <Provider>
      <Authenticator>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <Uploader>
            <Uploader.Form>
              <div className="max-w-2xl w-full">
                <h2 className="text-xl font-semibold mb-4">Upload Multiple Files</h2>
                <MultiFileUpload />
              </div>
            </Uploader.Form>
          </Uploader>
        </div>
      </Authenticator>
    </Provider>
  )
}`}
        >
          <UploadDemoMulti />
        </Playground>

        <h2>Notes</h2>
        <ul>
          <li>Supports directories via the non-standard <code>webkitdirectory</code> attribute.</li>
          <li>Shows per-shard progress via <code>uploadProgress</code>.</li>
        </ul>
      </MDXContent>
    </Layout>
  )
}



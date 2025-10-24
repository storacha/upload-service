import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'
import { Playground } from '@/components/Playground'
import UploadsListDemo from '@/components/demos/UploadsListDemo'

export default function UploadsListExamplePage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Uploads List Example</h1>

        <p>
          Display a list of uploaded files for the current space. This example shows a simple, client-side
          listing pattern you can adapt to your storage/indexing approach.
        </p>

        <h2>Live Demo</h2>
        <Playground initialCode={`import React, { useState, useEffect } from 'react'
import { Provider, Authenticator, useW3 } from '@storacha/ui-react'

function UploadsList() {
  const [{ client }] = useW3()
  const [uploads, setUploads] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchUploads() {
      if (!client) return
      setLoading(true)
      setError(null)
      try {
        const current = client.currentSpace()
        if (!current) throw new Error('No space selected')
        const list = await client.list()
        setUploads(list.results || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchUploads()
  }, [client])

  if (loading) return <p>Loading uploads…</p>
  if (error) return <p className="text-red-600">Error: {error}</p>

  return (
    <div className="space-y-2">
      {uploads.length === 0 ? (
        <p className="text-gray-500">No uploads yet.</p>
      ) : (
        uploads.map((u, i) => (
          <div key={i} className="p-3 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">{u.name || 'Untitled'}</p>
                <p className="text-sm text-gray-500">CID: {u.cid}</p>
                {u.size && (
                  <p className="text-sm text-gray-500">Size: {(u.size / 1024 / 1024).toFixed(2)} MB</p>
                )}
              </div>
              <a
                href={`https://${u.cid}.ipfs.w3s.link`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-hot-blue hover:underline text-sm"
              >
                View
              </a>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function App() {
  return (
    <Provider>
      <Authenticator>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            <h2 className="text-xl font-semibold mb-4">Uploaded Files</h2>
            <UploadsList />
          </div>
        </div>
      </Authenticator>
    </Provider>
  )
}`}
        >
          <UploadsListDemo />
        </Playground>

        <h2>Notes</h2>
        <ul>
          <li>Replace the simple <code>client.list()</code> call with your own indexing if needed.</li>
          <li>Linking uses the public w3s gateway for quick previews.</li>
        </ul>
      </MDXContent>
    </Layout>
  )
}



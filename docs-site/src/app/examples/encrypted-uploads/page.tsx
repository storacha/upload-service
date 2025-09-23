import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'
import { Playground } from '@/components/Playground'
import UploadDemoSingle from '@/components/demos/UploadDemoSingle'

export default function EncryptedUploadsExamplePage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Encrypted Uploads Example</h1>

        <p>
          Use KMS to encrypt files automatically when uploading to private spaces. Configure KMS endpoints
          with environment variables and pass <code>defaultEncryptionStrategy="kms"</code>.
        </p>

        <h2>Live Demo</h2>
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
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-4">
              <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Encrypted Upload</h3>
              <p className="text-blue-700 dark:text-blue-300 text-sm">
                Files will be encrypted using KMS before upload when in a private space.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="encrypted-file" className="block text-sm font-medium mb-1">Select File</label>
                <Uploader.Input id="encrypted-file" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <button type="submit" className="w-full bg-hot-blue hover:bg-hot-blue/90 text-white font-medium py-3 px-4 rounded-md transition-colors">
                Upload Encrypted File
              </button>
            </div>
          </Uploader.Form>
        </Uploader>
      </Authenticator>
    </Provider>
  )
}`}>
          <UploadDemoSingle />
        </Playground>

        <h2>Environment</h2>
        <pre><code>{`# .env.local
NEXT_PUBLIC_UCAN_KMS_URL=https://kms.storacha.network
NEXT_PUBLIC_UCAN_KMS_DID=did:web:kms.storacha.network
NEXT_PUBLIC_UCAN_KMS_LOCATION=us-west1
NEXT_PUBLIC_UCAN_KMS_KEYRING=my-keyring`}</code></pre>
      </MDXContent>
    </Layout>
  )
}



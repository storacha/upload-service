import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'

export default function SetupUIGuidePage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Setup: @storacha/ui-react</h1>
        <p>
          Follow these steps to install and initialize the Storacha Console Integration Toolkit in a React app.
        </p>

        <h2>1) Install Packages</h2>
        <pre><code>{`npm install @storacha/ui-react
# or
yarn add @storacha/ui-react
# or
pnpm add @storacha/ui-react`}</code></pre>

        <h2>2) Initialize Provider</h2>
        <p>Add the <code>Provider</code> high in your tree (e.g., <code>App.tsx</code>):</p>
        <pre><code>{`import { Provider } from '@storacha/ui-react'

export default function App() {
  return (
    <Provider>
      {/* your app */}
    </Provider>
  )
}`}</code></pre>

        <h2>3) Add Authentication Flow</h2>
        <pre><code>{`import { Authenticator } from '@storacha/ui-react'

function App() {
  return (
    <Provider>
      <Authenticator>
        {/* your routes/components */}
      </Authenticator>
    </Provider>
  )
}`}</code></pre>

        <h2>4) Ensure a Space</h2>
        <p>Use your own logic or copy the pattern from examples to ensure a Space exists and is current.</p>
        <pre><code>{`import { useW3 } from '@storacha/ui-react'
import { useEffect } from 'react'

function SpaceEnsurer({ children }) {
  const [{ client }] = useW3()
  useEffect(() => {
    async function ensure() {
      if (client && !client.currentSpace()) {
        const space = client.spaces()[0] || await client.createSpace('my space')
        await client.setCurrentSpace(space.did())
      }
    }
    void ensure()
  }, [client])
  return <>{children}</>
}`}</code></pre>

        <h2>5) Uploader Usage</h2>
        <pre><code>{`import { Uploader } from '@storacha/ui-react'

function UploadSection() {
  return (
    <Uploader>
      <Uploader.Form>
        <Uploader.Input />
        <button type="submit">Upload</button>
      </Uploader.Form>
    </Uploader>
  )
}`}</code></pre>

        <h2>Optional: Encrypted Uploads (Private Spaces)</h2>
        <p>Provide KMS config via props or env. Example with Google KMS:</p>
        <pre><code>{`import { Uploader } from '@storacha/ui-react'

const kms = {
  keyManagerServiceURL: process.env.NEXT_PUBLIC_UCAN_KMS_URL!,
  keyManagerServiceDID: process.env.NEXT_PUBLIC_UCAN_KMS_DID!,
}

<Uploader kmsConfig={kms} defaultEncryptionStrategy="kms">
  <Uploader.Form>
    <Uploader.Input />
    <button type="submit">Upload</button>
  </Uploader.Form>
</Uploader>`}</code></pre>

        <h2>Environment</h2>
        <pre><code>{`# .env.local
NEXT_PUBLIC_UCAN_KMS_URL=https://kms.storacha.network
NEXT_PUBLIC_UCAN_KMS_DID=did:web:kms.storacha.network
# optional
NEXT_PUBLIC_UCAN_KMS_LOCATION=us-west1
NEXT_PUBLIC_UCAN_KMS_KEYRING=my-keyring
NEXT_PUBLIC_UCAN_KMS_ALLOW_INSECURE_HTTP=false`}</code></pre>

        <h2>Reference Examples</h2>
        <ul>
          <li><a href="https://github.com/storacha/upload-service/tree/main/packages/ui/examples/react/sign-up-in" target="_blank">Sign up / Sign in</a></li>
          <li><a href="https://github.com/storacha/upload-service/tree/main/packages/ui/examples/react/file-upload" target="_blank">Single File Upload</a></li>
          <li><a href="https://github.com/storacha/upload-service/tree/main/packages/ui/examples/react/multi-file-upload" target="_blank">Multiple File Upload</a></li>
          <li><a href="https://github.com/storacha/upload-service/tree/main/packages/ui/examples/react/uploads-list" target="_blank">Uploads List</a></li>
        </ul>
      </MDXContent>
    </Layout>
  )
}

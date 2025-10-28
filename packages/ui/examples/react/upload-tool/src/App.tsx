import { Provider, Authenticator, UploadTool } from '@storacha/ui-react'
import { AuthenticationEnsurer, SpaceEnsurer } from '@storacha/ui-example-react-components'
import { useState } from 'react'

function App(): React.ReactElement {
  const [uploadedCIDs, setUploadedCIDs] = useState<string[]>([])

  return (
    <div className="min-h-screen bg-gradient-fire flex flex-col items-center justify-center p-8">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">
          Storacha Upload Tool
        </h1>
        <p className="text-white/90">
          A complete, plug-and-play upload component for Web3 applications
        </p>
      </div>

      <Provider>
        <Authenticator>
          <AuthenticationEnsurer>
            <SpaceEnsurer>
              <div className="max-w-4xl w-full">
                <UploadTool
                  onUploadComplete={({ dataCID }: { dataCID?: any }) => {
                    if (dataCID) {
                      console.log('Upload complete:', dataCID.toString())
                      setUploadedCIDs((prev) => [dataCID.toString(), ...prev])
                    }
                  }}
                  showTypeSelector={true}
                  showOptions={true}
                  showExplain={true}
                />
                
                {uploadedCIDs.length > 0 && (
                  <div className="mt-8 bg-white p-6 rounded-2xl shadow-lg">
                    <h2 className="text-xl font-bold mb-4">
                      Recent Uploads ({uploadedCIDs.length})
                    </h2>
                    <ul className="space-y-2">
                      {uploadedCIDs.slice(0, 5).map((cid, index) => (
                        <li
                          key={index}
                          className="font-mono text-sm bg-gray-100 p-2 rounded overflow-hidden text-ellipsis"
                        >
                          <a
                            href={`https://w3s.link/ipfs/${cid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                          >
                            {cid}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </SpaceEnsurer>
          </AuthenticationEnsurer>
        </Authenticator>
      </Provider>

      <div className="mt-12 text-center text-white/80 text-sm">
        <p>
          This example demonstrates the <code className="bg-white/20 px-2 py-1 rounded">UploadTool</code> component
          from <code className="bg-white/20 px-2 py-1 rounded">@storacha/ui-react</code>
        </p>
      </div>
    </div>
  )
}

export default App


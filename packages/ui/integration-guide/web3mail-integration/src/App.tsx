import React, { useState } from 'react'
import { Provider, StorachaAuth, Uploader } from '@storacha/ui-react'
import { Web3MailAuth } from './components/Web3MailAuth'
import { Web3MailFileUpload } from './components/Web3MailFileUpload'
import { Web3MailShare } from './components/Web3MailShare'

function App() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [ensName, setEnsName] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAuthEvent = (event: any) => {
    console.log('Auth event:', event)
    if (event.type === 'success') {
      setWalletAddress(event.address)
      setEnsName(event.ensName)
      setError(null)
    } else if (event.type === 'error') {
      setError(event.message)
    }
  }

  const handleAuthSuccess = (address: string, ens?: string) => {
    setWalletAddress(address)
    setEnsName(ens || null)
    setError(null)
  }

  const handleAuthError = (error: Error) => {
    setError(error.message)
  }

  const handleFileUploaded = (fileInfo: any) => {
    setUploadedFile(fileInfo)
  }

  return (
    <Provider>
      <StorachaAuth onAuthEvent={handleAuthEvent}>
        <div className="web3mail-app">
          <header className="app-header">
            <div className="logo-container">
              <img src="/web3mail-logo.svg" alt="Web3Mail" className="web3mail-logo" />
              <span className="divider">×</span>
              <img src="/storacha-logo.svg" alt="Storacha" className="storacha-logo" />
            </div>
            <h1>Storacha × Web3Mail Integration</h1>
            <p>Decentralized storage meets decentralized messaging</p>
          </header>

          <main className="app-main">
            {error && (
              <div className="error-banner">
                <span className="error-icon">⚠️</span>
                <span>{error}</span>
                <button onClick={() => setError(null)} className="close-button">
                  ×
                </button>
              </div>
            )}

            {!walletAddress ? (
              <Web3MailAuth
                onAuthSuccess={handleAuthSuccess}
                onAuthError={handleAuthError}
              />
            ) : (
              <div className="authenticated-content">
                <Web3MailFileUpload
                  walletAddress={walletAddress}
                  ensName={ensName || undefined}
                  onFileUploaded={handleFileUploaded}
                />
                
                {uploadedFile && (
                  <Web3MailShare
                    fileCid={uploadedFile.cid}
                    fileName={uploadedFile.fileName}
                    walletAddress={walletAddress}
                    ensName={ensName || undefined}
                  />
                )}
              </div>
            )}
          </main>

          <footer className="app-footer">
            <p>Powered by Storacha Console Toolkit & Web3Mail</p>
            <div className="footer-links">
              <a href="https://storacha.network" target="_blank" rel="noopener noreferrer">
                Storacha
              </a>
              <a href="https://web3mail.app" target="_blank" rel="noopener noreferrer">
                Web3Mail
              </a>
              <a href="https://github.com/storacha/upload-service" target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
            </div>
          </footer>
        </div>
      </StorachaAuth>
    </Provider>
  )
}

export default App

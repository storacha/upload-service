import React, { useState } from 'react'
import { Provider, StorachaAuth, Uploader } from '@storacha/ui-react'
import { DmailAuth } from './components/DmailAuth'
import { DmailFileUpload } from './components/DmailFileUpload'
import { DmailShare } from './components/DmailShare'

function App() {
  const [dmailEmail, setDmailEmail] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAuthEvent = (event: any) => {
    console.log('Auth event:', event)
    if (event.type === 'success') {
      setDmailEmail(event.email)
      setError(null)
    } else if (event.type === 'error') {
      setError(event.message)
    }
  }

  const handleAuthSuccess = (email: string) => {
    setDmailEmail(email)
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
        <div className="dmail-app">
          <header className="app-header">
            <div className="logo-container">
              <img src="/storacha-logo.svg" alt="Storacha" className="storacha-logo" />
              <span className="divider">×</span>
              <img src="/dmail-logo.svg" alt="Dmail" className="dmail-logo" />
            </div>
            <h1>Storacha × Dmail Integration</h1>
            <p>Decentralized storage meets decentralized email</p>
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

            {!dmailEmail ? (
              <DmailAuth
                onAuthSuccess={handleAuthSuccess}
                onAuthError={handleAuthError}
              />
            ) : (
              <div className="authenticated-content">
                <DmailFileUpload
                  dmailEmail={dmailEmail}
                  onFileUploaded={handleFileUploaded}
                />
                
                {uploadedFile && (
                  <DmailShare
                    fileCid={uploadedFile.cid}
                    fileName={uploadedFile.fileName}
                    dmailEmail={dmailEmail}
                  />
                )}
              </div>
            )}
          </main>

          <footer className="app-footer">
            <p>Powered by Storacha Console Toolkit & Dmail</p>
            <div className="footer-links">
              <a href="https://storacha.network" target="_blank" rel="noopener noreferrer">
                Storacha
              </a>
              <a href="https://dmail.ai" target="_blank" rel="noopener noreferrer">
                Dmail
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

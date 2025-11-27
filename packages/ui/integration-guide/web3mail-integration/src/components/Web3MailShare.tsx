import React, { useState } from 'react'

interface Web3MailShareProps {
  fileCid: string
  fileName: string
  walletAddress: string
  ensName?: string
}

export function Web3MailShare({ fileCid, fileName, walletAddress, ensName }: Web3MailShareProps) {
  const [recipientAddress, setRecipientAddress] = useState('')
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [encryptionEnabled, setEncryptionEnabled] = useState(true)

  const handleSend = async () => {
    if (!recipientAddress) return

    setIsSending(true)
    try {
      // Simulate Web3Mail send
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      console.log('Web3Mail send:', {
        to: recipientAddress,
        from: walletAddress,
        subject: `File shared: ${fileName}`,
        message,
        fileCid,
        fileName,
        encryptionEnabled
      })

      setSent(true)
      setRecipientAddress('')
      setMessage('')
    } catch (error) {
      console.error('Send error:', error)
    } finally {
      setIsSending(false)
    }
  }

  const validateAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  if (sent) {
    return (
      <div className="web3mail-share-success">
        <div className="success-icon">✅</div>
        <h4>File Shared Successfully!</h4>
        <p>The file has been sent via Web3Mail</p>
        <div className="share-details">
          <p><strong>File:</strong> {fileName}</p>
          <p><strong>CID:</strong> {fileCid}</p>
          <p><strong>Recipient:</strong> {recipientAddress}</p>
          <p><strong>Encryption:</strong> {encryptionEnabled ? 'Enabled' : 'Disabled'}</p>
        </div>
        <button onClick={() => setSent(false)} className="share-another-button">
          Share Another File
        </button>
      </div>
    )
  }

  return (
    <div className="web3mail-share">
      <h4>Share via Web3Mail</h4>
      <div className="share-form">
        <div className="form-group">
          <label htmlFor="recipient-address">Recipient Wallet Address</label>
          <input
            id="recipient-address"
            type="text"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            placeholder="0x..."
            className="recipient-address-input"
          />
          {recipientAddress && !validateAddress(recipientAddress) && (
            <span className="error-message">Invalid wallet address</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="message">Message (Optional)</label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add a message..."
            className="message-textarea"
            rows={3}
          />
        </div>

        <div className="form-group">
          <label className="encryption-option">
            <input
              type="checkbox"
              checked={encryptionEnabled}
              onChange={(e) => setEncryptionEnabled(e.target.checked)}
            />
            <span>🔒 Enable end-to-end encryption</span>
          </label>
        </div>

        <button
          onClick={handleSend}
          disabled={!recipientAddress || !validateAddress(recipientAddress) || isSending}
          className="send-button"
        >
          {isSending ? 'Sending...' : 'Send via Web3Mail'}
        </button>
      </div>
    </div>
  )
}

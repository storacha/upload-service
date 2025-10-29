import React, { useState } from 'react'

interface DmailShareProps {
  fileCid: string
  fileName: string
  dmailEmail: string
}

export function DmailShare({ fileCid, fileName, dmailEmail }: DmailShareProps) {
  const [recipientEmail, setRecipientEmail] = useState('')
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSend = async () => {
    if (!recipientEmail) return

    setIsSending(true)
    try {
      // Simulate Dmail send
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      console.log('Dmail send:', {
        to: recipientEmail,
        from: dmailEmail,
        subject: `File shared: ${fileName}`,
        message,
        fileCid,
        fileName
      })

      setSent(true)
      setRecipientEmail('')
      setMessage('')
    } catch (error) {
      console.error('Send error:', error)
    } finally {
      setIsSending(false)
    }
  }

  if (sent) {
    return (
      <div className="dmail-share-success">
        <div className="success-icon">✅</div>
        <h4>File Shared Successfully!</h4>
        <p>The file has been sent via Dmail</p>
        <div className="share-details">
          <p><strong>File:</strong> {fileName}</p>
          <p><strong>CID:</strong> {fileCid}</p>
          <p><strong>Recipient:</strong> {recipientEmail}</p>
        </div>
        <button onClick={() => setSent(false)} className="share-another-button">
          Share Another File
        </button>
      </div>
    )
  }

  return (
    <div className="dmail-share">
      <h4>Share via Dmail</h4>
      <div className="share-form">
        <div className="form-group">
          <label htmlFor="recipient-email">Recipient Email</label>
          <input
            id="recipient-email"
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="recipient@dmail.ai"
            className="recipient-email-input"
          />
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

        <button
          onClick={handleSend}
          disabled={!recipientEmail || isSending}
          className="send-button"
        >
          {isSending ? 'Sending...' : 'Send via Dmail'}
        </button>
      </div>
    </div>
  )
}

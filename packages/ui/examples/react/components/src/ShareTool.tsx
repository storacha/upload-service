import React from 'react'
import { ShareTool, useShareTool } from '@storacha/ui-react'
import type { Space } from '@storacha/ui-react'

interface ShareToolExampleProps {
  space: Space
}

/**
 * Example: Basic ShareTool form
 */
export function BasicShareToolExample({ space }: ShareToolExampleProps) {
  const handleShared = (recipient: string) => {
    console.log('Space shared with:', recipient)
  }

  const handleError = (error: Error) => {
    console.error('Failed to share space:', error)
  }

  return (
    <div style={{ maxWidth: '500px', margin: '20px' }}>
      <h2>Share Space: {space.name || 'Untitled'}</h2>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
        Share this space with others by entering their email or DID
      </p>
      <ShareTool
        space={space}
        onShared={handleShared}
        onError={handleError}
      >
        <ShareForm />
      </ShareTool>
    </div>
  )
}

/**
 * Custom share form component
 */
function ShareForm() {
  const [{ sharing }] = useShareTool()

  return (
    <ShareTool.Form
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
      }}
    >
      <div>
        <label
          style={{
            display: 'block',
            marginBottom: '5px',
            fontWeight: 'bold',
            fontSize: '14px',
          }}
        >
          Recipient Email or DID
        </label>
        <ShareTool.RecipientInput
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '14px',
          }}
          placeholder="user@example.com or did:key:..."
        />
        <small style={{ color: '#666', fontSize: '12px' }}>
          Enter an email address or decentralized identifier (DID)
        </small>
      </div>

      <ShareTool.Error
        style={{
          padding: '10px',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '4px',
          color: '#721c24',
          fontSize: '14px',
        }}
      />

      <ShareTool.Success
        style={{
          padding: '10px',
          backgroundColor: '#d4edda',
          border: '1px solid #c3e6cb',
          borderRadius: '4px',
          color: '#155724',
          fontSize: '14px',
        }}
      />

      <ShareTool.SubmitButton
        style={{
          padding: '12px 24px',
          backgroundColor: sharing ? '#6c757d' : '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: sharing ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s',
        }}
      >
        {sharing ? 'Sharing...' : 'Share Space'}
      </ShareTool.SubmitButton>
    </ShareTool.Form>
  )
}

/**
 * Example: Minimal ShareTool
 */
export function MinimalShareToolExample({ space }: ShareToolExampleProps) {
  return (
    <div style={{ maxWidth: '400px' }}>
      <ShareTool space={space}>
        <ShareTool.Form>
          <div>
            <label>Share with:</label>
            <ShareTool.RecipientInput />
          </div>
          <ShareTool.Error />
          <ShareTool.Success />
          <ShareTool.SubmitButton>Share</ShareTool.SubmitButton>
        </ShareTool.Form>
      </ShareTool>
    </div>
  )
}

/**
 * Example: ShareTool in a modal
 */
export function ModalShareToolExample({ space }: ShareToolExampleProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={{
          padding: '10px 20px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        🔗 Share Space
      </button>

      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '8px',
              maxWidth: '500px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
              }}
            >
              <h2 style={{ margin: 0 }}>Share Space</h2>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#999',
                }}
              >
                ×
              </button>
            </div>
            <BasicShareToolExample space={space} />
          </div>
        </div>
      )}
    </>
  )
}


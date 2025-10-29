import type { Space } from '@storacha/ui-react'
import { SpaceCreator, useSpaceCreator } from '@storacha/ui-react'

/**
 * Example: Basic SpaceCreator form
 */
export function BasicSpaceCreatorExample() {
  const handleSpaceCreated = (space: Space) => {
    console.log('Space created:', space.did())
    alert(`Space "${space.name}" created successfully!`)
  }

  const handleError = (error: Error) => {
    console.error('Failed to create space:', error)
    alert(`Error: ${error.message}`)
  }

  return (
    <div style={{ maxWidth: '500px', margin: '20px' }}>
      <h2>Create a New Space</h2>
      <SpaceCreator
        onSpaceCreated={handleSpaceCreated}
        onError={handleError}
        allowPrivateSpaces={true}
      >
        <SpaceCreatorForm />
      </SpaceCreator>
    </div>
  )
}

/**
 * Custom form component with styling
 */
function SpaceCreatorForm() {
  const [{ accessType, creating, created, createdSpace, error }] =
    useSpaceCreator()

  if (created && createdSpace) {
    return (
      <div
        style={{
          padding: '20px',
          backgroundColor: '#d4edda',
          border: '1px solid #c3e6cb',
          borderRadius: '4px',
          color: '#155724',
        }}
      >
        <h3>✅ Space Created Successfully!</h3>
        <p>
          <strong>Name:</strong> {createdSpace.name || 'Untitled'}
        </p>
        <p>
          <strong>DID:</strong>{' '}
          <code style={{ fontSize: '12px' }}>{createdSpace.did()}</code>
        </p>
      </div>
    )
  }

  return (
    <SpaceCreator.Form
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
          Space Name
        </label>
        <SpaceCreator.NameInput
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '14px',
          }}
          placeholder="Enter space name"
        />
      </div>

      <div>
        <label
          style={{
            display: 'block',
            marginBottom: '5px',
            fontWeight: 'bold',
            fontSize: '14px',
          }}
        >
          Access Type
        </label>
        <SpaceCreator.AccessTypeSelect
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        />
        <small style={{ color: '#666', fontSize: '12px' }}>
          {accessType === 'public'
            ? 'Files stored unencrypted and accessible via IPFS'
            : 'Files encrypted locally before upload'}
        </small>
      </div>

      {error && (
        <div
          style={{
            padding: '10px',
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '4px',
            color: '#721c24',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}

      <SpaceCreator.SubmitButton
        style={{
          padding: '12px 24px',
          backgroundColor: creating ? '#6c757d' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: creating ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s',
        }}
        disabled={creating}
      >
        {creating ? 'Creating Space...' : 'Create Space'}
      </SpaceCreator.SubmitButton>
    </SpaceCreator.Form>
  )
}

/**
 * Example: Minimal SpaceCreator
 */
export function MinimalSpaceCreatorExample() {
  return (
    <div style={{ maxWidth: '400px' }}>
      <SpaceCreator>
        <SpaceCreator.Form>
          <div>
            <label>Name:</label>
            <SpaceCreator.NameInput />
          </div>
          <div>
            <label>Type:</label>
            <SpaceCreator.AccessTypeSelect />
          </div>
          <SpaceCreator.SubmitButton>Create</SpaceCreator.SubmitButton>
        </SpaceCreator.Form>
      </SpaceCreator>
    </div>
  )
}


import { useState } from 'react'
import type { Space } from '@storacha/ui-react'
import {
  SpacePicker,
  SpaceCreator,
  UploadsList,
  ShareTool,
  useSpacePicker,
} from '@storacha/ui-react'

/**
 * Comprehensive example showing all space management components together
 */
export function ComprehensiveSpaceManagementExample() {
  const [currentView, setCurrentView] = useState<'list' | 'create' | 'browse'>(
    'list'
  )
  const [selectedSpace, setSelectedSpace] = useState<Space | undefined>()

  const handleSpaceCreated = (space: Space) => {
    setSelectedSpace(space)
    setCurrentView('browse')
  }

  const handleSpaceSelected = (space: Space) => {
    setSelectedSpace(space)
    setCurrentView('browse')
  }

  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '20px auto',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <header
        style={{
          padding: '20px',
          backgroundColor: '#1a1a1a',
          color: 'white',
          borderRadius: '8px 8px 0 0',
        }}
      >
        <h1 style={{ margin: 0 }}>Storacha Space Management</h1>
        <p style={{ margin: '10px 0 0', opacity: 0.8 }}>
          Manage your decentralized storage spaces
        </p>
      </header>

      <nav
        style={{
          display: 'flex',
          gap: '0',
          backgroundColor: '#f5f5f5',
          borderBottom: '2px solid #ddd',
        }}
      >
        <button
          onClick={() => setCurrentView('list')}
          style={{
            padding: '12px 24px',
            border: 'none',
            backgroundColor:
              currentView === 'list' ? 'white' : 'transparent',
            borderBottom:
              currentView === 'list' ? '2px solid #007bff' : 'none',
            cursor: 'pointer',
            fontWeight: currentView === 'list' ? 'bold' : 'normal',
            color: currentView === 'list' ? '#007bff' : '#666',
          }}
        >
          📁 My Spaces
        </button>
        <button
          onClick={() => setCurrentView('create')}
          style={{
            padding: '12px 24px',
            border: 'none',
            backgroundColor:
              currentView === 'create' ? 'white' : 'transparent',
            borderBottom:
              currentView === 'create' ? '2px solid #007bff' : 'none',
            cursor: 'pointer',
            fontWeight: currentView === 'create' ? 'bold' : 'normal',
            color: currentView === 'create' ? '#007bff' : '#666',
          }}
        >
          ➕ Create Space
        </button>
        {selectedSpace && (
          <button
            onClick={() => setCurrentView('browse')}
            style={{
              padding: '12px 24px',
              border: 'none',
              backgroundColor:
                currentView === 'browse' ? 'white' : 'transparent',
              borderBottom:
                currentView === 'browse' ? '2px solid #007bff' : 'none',
              cursor: 'pointer',
              fontWeight: currentView === 'browse' ? 'bold' : 'normal',
              color: currentView === 'browse' ? '#007bff' : '#666',
            }}
          >
            🗂️ Browse
          </button>
        )}
      </nav>

      <main
        style={{
          padding: '20px',
          backgroundColor: 'white',
          minHeight: '400px',
          borderRadius: '0 0 8px 8px',
        }}
      >
        {currentView === 'list' && (
          <SpacesList onSpaceSelected={handleSpaceSelected} />
        )}
        {currentView === 'create' && (
          <CreateSpaceView onSpaceCreated={handleSpaceCreated} />
        )}
        {currentView === 'browse' && selectedSpace && (
          <BrowseSpaceView space={selectedSpace} />
        )}
      </main>
    </div>
  )
}

/**
 * Spaces list view
 */
function SpacesList({ onSpaceSelected }: { onSpaceSelected: (space: Space) => void }) {
  return (
    <div>
      <h2>Select a Space</h2>
      <SpacePicker onSpaceSelected={onSpaceSelected}>
        <div style={{ marginBottom: '15px' }}>
          <SpacePicker.Input
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
            }}
            placeholder="Search spaces by name or DID..."
          />
        </div>
        <SpacePickerCustomList />
      </SpacePicker>
    </div>
  )
}

function SpacePickerCustomList() {
  const [{ publicSpaces, privateSpaces, selectedSpace }, { setSelectedSpace }] =
    useSpacePicker()

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '15px',
      }}
    >
      {[...publicSpaces, ...privateSpaces].map((space) => (
        <div
          key={space.did()}
          onClick={() => setSelectedSpace(space)}
          style={{
            padding: '15px',
            border: '2px solid #ddd',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor:
              selectedSpace?.did() === space.did() ? '#e3f2fd' : 'white',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (selectedSpace?.did() !== space.did()) {
              e.currentTarget.style.borderColor = '#007bff'
            }
          }}
          onMouseLeave={(e) => {
            if (selectedSpace?.did() !== space.did()) {
              e.currentTarget.style.borderColor = '#ddd'
            }
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px',
            }}
          >
            <span style={{ fontSize: '24px' }}>
              {(space as any).access?.type === 'private' ? '🔒' : '🌐'}
            </span>
            <strong style={{ fontSize: '16px' }}>
              {space.name || 'Untitled'}
            </strong>
          </div>
          <div
            style={{
              fontSize: '11px',
              color: '#999',
              fontFamily: 'monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {space.did()}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Create space view
 */
function CreateSpaceView({ onSpaceCreated }: { onSpaceCreated: (space: Space) => void }) {
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2>Create a New Space</h2>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        A space is a decentralized bucket. Give it a memorable name and choose
        the access type.
      </p>
      <SpaceCreator onSpaceCreated={onSpaceCreated}>
        <SpaceCreator.Form
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: 'bold',
              }}
            >
              Space Name
            </label>
            <SpaceCreator.NameInput
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: 'bold',
              }}
            >
              Access Type
            </label>
            <SpaceCreator.AccessTypeSelect
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            />
          </div>

          <SpaceCreator.SubmitButton
            style={{
              padding: '14px 28px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            Create Space
          </SpaceCreator.SubmitButton>
        </SpaceCreator.Form>
      </SpaceCreator>
    </div>
  )
}

/**
 * Browse space view with uploads and share
 */
function BrowseSpaceView({ space }: { space: Space }) {
  const [showShare, setShowShare] = useState(false)

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          paddingBottom: '15px',
          borderBottom: '2px solid #f0f0f0',
        }}
      >
        <div>
          <h2 style={{ margin: '0 0 5px' }}>{space.name || 'Untitled Space'}</h2>
          <p
            style={{
              margin: 0,
              fontSize: '12px',
              color: '#999',
              fontFamily: 'monospace',
            }}
          >
            {space.did()}
          </p>
        </div>
        <button
          onClick={() => setShowShare(!showShare)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          {showShare ? '✕ Close' : '🔗 Share Space'}
        </button>
      </div>

      {showShare && (
        <div
          style={{
            padding: '20px',
            backgroundColor: '#f9f9f9',
            border: '1px solid #ddd',
            borderRadius: '4px',
            marginBottom: '20px',
          }}
        >
          <ShareTool space={space}>
            <ShareTool.Form
              style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}
            >
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '5px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                  }}
                >
                  Share with (email or DID):
                </label>
                <ShareTool.RecipientInput
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                  }}
                />
              </div>
              <ShareTool.SubmitButton
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                Share
              </ShareTool.SubmitButton>
            </ShareTool.Form>
            <ShareTool.Error style={{ marginTop: '10px', color: 'red' }} />
            <ShareTool.Success
              style={{ marginTop: '10px', color: 'green' }}
            />
          </ShareTool>
        </div>
      )}

      <div>
        <h3>Uploads</h3>
        <UploadsList space={space} size={10}>
          <UploadsList.Table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid #ddd',
            }}
          />
          <div style={{ marginTop: '15px' }}>
            <UploadsList.Pagination />
          </div>
        </UploadsList>
      </div>
    </div>
  )
}


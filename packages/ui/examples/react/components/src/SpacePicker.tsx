import type { Space } from '@storacha/ui-react'
import { SpacePicker, useSpacePicker } from '@storacha/ui-react'

/**
 * Example: Basic SpacePicker with custom styling
 */
export function BasicSpacePickerExample() {
  const handleSpaceSelected = (space: Space) => {
    console.log('Selected space:', space.did())
  }

  return (
    <div style={{ maxWidth: '400px', margin: '20px' }}>
      <h2>Select a Space</h2>
      <SpacePicker
        onSpaceSelected={handleSpaceSelected}
        showPrivateSpaces={true}
      >
        <div style={{ marginBottom: '10px' }}>
          <SpacePicker.Input
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px',
            }}
            placeholder="Search spaces..."
          />
        </div>
        <SpacePickerList />
      </SpacePicker>
    </div>
  )
}

/**
 * Custom space list component
 */
function SpacePickerList() {
  const [{ publicSpaces, privateSpaces, selectedSpace }, { setSelectedSpace }] =
    useSpacePicker()

  return (
    <div
      style={{
        border: '1px solid #ccc',
        borderRadius: '4px',
        maxHeight: '300px',
        overflowY: 'auto',
        backgroundColor: 'white',
      }}
    >
      {publicSpaces.length > 0 && (
        <>
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: '#f5f5f5',
              fontWeight: 'bold',
              fontSize: '12px',
              color: '#666',
              borderBottom: '1px solid #e0e0e0',
            }}
          >
            PUBLIC SPACES
          </div>
          {publicSpaces.map((space: Space) => (
            <div
              key={space.did()}
              onClick={() => setSelectedSpace(space)}
              style={{
                padding: '12px',
                cursor: 'pointer',
                backgroundColor:
                  selectedSpace?.did() === space.did() ? '#e3f2fd' : 'transparent',
                borderBottom: '1px solid #f0f0f0',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  selectedSpace?.did() === space.did() ? '#e3f2fd' : '#f9f9f9')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor =
                  selectedSpace?.did() === space.did() ? '#e3f2fd' : 'transparent')
              }
            >
              <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                {space.name || 'Untitled Space'}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: '#999',
                  fontFamily: 'monospace',
                }}
              >
                {space.did()}
              </div>
            </div>
          ))}
        </>
      )}

      {privateSpaces.length > 0 && (
        <>
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: '#fff3e0',
              fontWeight: 'bold',
              fontSize: '12px',
              color: '#666',
              borderBottom: '1px solid #e0e0e0',
            }}
          >
            🔒 PRIVATE SPACES
          </div>
          {privateSpaces.map((space: Space) => (
            <div
              key={space.did()}
              onClick={() => setSelectedSpace(space)}
              style={{
                padding: '12px',
                cursor: 'pointer',
                backgroundColor:
                  selectedSpace?.did() === space.did() ? '#fff3e0' : 'transparent',
                borderBottom: '1px solid #f0f0f0',
                transition: 'background-color 0.2s',
              }}
            >
              <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                🔒 {space.name || 'Untitled Private Space'}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: '#999',
                  fontFamily: 'monospace',
                }}
              >
                {space.did()}
              </div>
            </div>
          ))}
        </>
      )}

      {publicSpaces.length === 0 && privateSpaces.length === 0 && (
        <div
          style={{
            padding: '20px',
            textAlign: 'center',
            color: '#999',
          }}
        >
          No spaces found
        </div>
      )}
    </div>
  )
}

/**
 * Example: Using SpacePicker.Item for individual space rendering
 */
export function SpacePickerItemExample() {
  const [{ spaces }] = useSpacePicker()

  return (
    <div>
      <h3>Available Spaces</h3>
      {spaces.map((space: Space) => (
        <SpacePicker.Item
          key={space.did()}
          space={space}
          style={{
            display: 'block',
            padding: '10px',
            margin: '5px 0',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          {space.name || space.did()}
        </SpacePicker.Item>
      ))}
    </div>
  )
}


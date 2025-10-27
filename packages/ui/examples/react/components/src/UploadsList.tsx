import { UploadsList, useUploadsList } from '@storacha/ui-react'
import type { Space, UnknownLink } from '@storacha/ui-react'

interface UploadsListExampleProps {
  space: Space
}

/**
 * Example: Basic UploadsList with table
 */
export function BasicUploadsListExample({ space }: UploadsListExampleProps) {
  const handleUploadSelected = (root: UnknownLink) => {
    console.log('Selected upload:', root.toString())
  }

  return (
    <div style={{ maxWidth: '900px', margin: '20px' }}>
      <h2>Uploads in {space.name || space.did()}</h2>
      <UploadsList
        space={space}
        size={10}
        onUploadSelected={handleUploadSelected}
      >
        <UploadsTable />
        <UploadsPagination />
      </UploadsList>
    </div>
  )
}

/**
 * Custom uploads table with styling
 */
function UploadsTable() {
  const [{ uploads, loading }] = useUploadsList()

  if (uploads.length === 0 && !loading) {
    return (
      <UploadsList.Empty
        style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f9f9f9',
          border: '1px solid #ddd',
          borderRadius: '4px',
          color: '#666',
        }}
      >
        <p>No uploads found in this space.</p>
        <p style={{ fontSize: '14px', marginTop: '10px' }}>
          Upload some files to get started!
        </p>
      </UploadsList.Empty>
    )
  }

  return (
    <UploadsList.Table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        border: '1px solid #ddd',
        borderRadius: '4px',
        overflow: 'hidden',
        backgroundColor: 'white',
      }}
      renderRow={(upload) => (
        <UploadsList.Item
          key={upload.root.toString()}
          upload={upload}
          style={{
            borderBottom: '1px solid #f0f0f0',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e: any) =>
            (e.currentTarget.style.backgroundColor = '#f9f9f9')
          }
          onMouseLeave={(e: any) =>
            (e.currentTarget.style.backgroundColor = 'white')
          }
        >
          <td
            style={{
              padding: '12px',
              fontFamily: 'monospace',
              fontSize: '12px',
              maxWidth: '500px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {upload.root.toString()}
          </td>
          <td
            style={{
              padding: '12px',
              fontSize: '12px',
              color: '#666',
              width: '200px',
            }}
          >
            {new Date(upload.updatedAt).toLocaleString()}
          </td>
        </UploadsList.Item>
      )}
    />
  )
}

/**
 * Custom pagination controls
 */
function UploadsPagination() {
  const [{ hasNext, hasPrev, loading }, { loadNext, loadPrev, refresh }] =
    useUploadsList()

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '15px',
      }}
    >
      <button
        onClick={loadPrev}
        disabled={!hasPrev || loading}
        style={{
          padding: '8px 16px',
          backgroundColor: hasPrev && !loading ? '#007bff' : '#e0e0e0',
          color: hasPrev && !loading ? 'white' : '#999',
          border: 'none',
          borderRadius: '4px',
          cursor: hasPrev && !loading ? 'pointer' : 'not-allowed',
          fontSize: '14px',
        }}
      >
        ← Previous
      </button>

      <button
        onClick={refresh}
        disabled={loading}
        style={{
          padding: '8px 16px',
          backgroundColor: loading ? '#e0e0e0' : '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '14px',
        }}
      >
        {loading ? '⟳ Loading...' : '⟳ Refresh'}
      </button>

      <button
        onClick={loadNext}
        disabled={!hasNext || loading}
        style={{
          padding: '8px 16px',
          backgroundColor: hasNext && !loading ? '#007bff' : '#e0e0e0',
          color: hasNext && !loading ? 'white' : '#999',
          border: 'none',
          borderRadius: '4px',
          cursor: hasNext && !loading ? 'pointer' : 'not-allowed',
          fontSize: '14px',
        }}
      >
        Next →
      </button>
    </div>
  )
}

/**
 * Example: Compact UploadsList
 */
export function CompactUploadsListExample({ space }: UploadsListExampleProps) {
  return (
    <div>
      <h3>Recent Uploads</h3>
      <UploadsList space={space} size={5}>
        <UploadsList.Table />
        <UploadsList.Pagination />
      </UploadsList>
    </div>
  )
}


import 'fake-indexeddb/auto'
import { test, expect, vi, describe, beforeEach, afterEach } from 'vitest'
import { userEvent as user } from '@testing-library/user-event'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import {
  Context,
  ContextDefaultValue,
  ContextValue,
} from '../src/providers/Provider.js'
import {
  BlobsList,
  BlobsListContext,
  BlobsListContextDefaultValue,
  BlobsListContextValue,
} from '../src/BlobsList.js'

const mockSpace = {
  did: () => 'did:key:z6MktestSpace',
  name: 'Test Space',
}

const mockBlobs = [
  {
    blob: {
      digest: new Uint8Array([1, 2, 3]),
      size: 1024,
    },
    insertedAt: new Date().toISOString(),
  },
  {
    blob: {
      digest: new Uint8Array([4, 5, 6]),
      size: 2048,
    },
    insertedAt: new Date().toISOString(),
  },
]

const mockClient = {
  currentSpace: vi.fn().mockReturnValue(mockSpace),
  setCurrentSpace: vi.fn().mockResolvedValue(undefined),
  capability: {
    blob: {
      list: vi.fn().mockResolvedValue({
        results: mockBlobs,
        cursor: 'next-cursor',
      }),
    },
  },
}

describe('BlobsList', () => {
  let contextValue: ContextValue

  beforeEach(() => {
    vi.clearAllMocks()
    contextValue = [
      {
        ...ContextDefaultValue[0],
        // @ts-expect-error not a real client
        client: mockClient,
      },
      ContextDefaultValue[1],
    ]
  })

  afterEach(() => {
    cleanup()
  })

  test('renders table component', async () => {
    render(
      <Context.Provider value={contextValue}>
        {/* @ts-expect-error not a real space */}
        <BlobsList space={mockSpace}>
          <BlobsList.Table />
        </BlobsList>
      </Context.Provider>
    )

    await waitFor(() => {
      expect(mockClient.capability.blob.list).toHaveBeenCalled()
    })
  })

  test('renders pagination controls', async () => {
    render(
      <Context.Provider value={contextValue}>
        {/* @ts-expect-error not a real space */}
        <BlobsList space={mockSpace}>
          <BlobsList.Pagination />
        </BlobsList>
      </Context.Provider>
    )

    await waitFor(() => {
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })
  })

  test('shows empty state when no blobs', async () => {
    const emptyClient = {
      ...mockClient,
      capability: {
        blob: {
          list: vi.fn().mockResolvedValue({
            results: [],
            cursor: undefined,
          }),
        },
      },
    }

    const emptyContextValue: ContextValue = [
      {
        ...ContextDefaultValue[0],
        // @ts-expect-error not a real client
        client: emptyClient,
      },
      ContextDefaultValue[1],
    ]

    render(
      <Context.Provider value={emptyContextValue}>
        {/* @ts-expect-error not a real space */}
        <BlobsList space={mockSpace}>
          <BlobsList.Empty>No blobs found</BlobsList.Empty>
        </BlobsList>
      </Context.Provider>
    )

    await waitFor(() => {
      expect(screen.getByText('No blobs found')).toBeDefined()
    })
  })

  test('calls onBlobSelected when blob is clicked', async () => {
    const onBlobSelected = vi.fn()

    const blobsContextValue: BlobsListContextValue = [
      {
        ...BlobsListContextDefaultValue[0],
        // @ts-expect-error not a real space
        space: mockSpace,
        // @ts-expect-error not real blobs
        blobs: mockBlobs,
        loading: false,
      },
      {
        ...BlobsListContextDefaultValue[1],
        selectBlob: onBlobSelected,
      },
    ]

    render(
      <BlobsListContext.Provider value={blobsContextValue}>
        {/* @ts-expect-error not a real blob */}
        <BlobsList.Item blob={mockBlobs[0]}>
          <td>Blob 1</td>
        </BlobsList.Item>
      </BlobsListContext.Provider>
    )

    const row = screen.getByText('Blob 1').closest('tr')
    if (row) {
      await user.click(row)
      expect(onBlobSelected).toHaveBeenCalledWith(mockBlobs[0])
    }
  })

  test('navigates to next page', async () => {
    const loadNext = vi.fn()

    const blobsContextValue: BlobsListContextValue = [
      {
        ...BlobsListContextDefaultValue[0],
        // @ts-expect-error not a real space
        space: mockSpace,
        // @ts-expect-error not real blobs
        blobs: mockBlobs,
        hasNext: true,
        loading: false,
      },
      {
        ...BlobsListContextDefaultValue[1],
        loadNext,
      },
    ]

    render(
      <BlobsListContext.Provider value={blobsContextValue}>
        <BlobsList.Pagination />
      </BlobsListContext.Provider>
    )

    const nextButton = screen.getByText('Next')
    await user.click(nextButton)

    expect(loadNext).toHaveBeenCalledOnce()
  })

  test('refreshes list', async () => {
    const refresh = vi.fn()

    const blobsContextValue: BlobsListContextValue = [
      {
        ...BlobsListContextDefaultValue[0],
        // @ts-expect-error not a real space
        space: mockSpace,
        // @ts-expect-error not real blobs
        blobs: mockBlobs,
        loading: false,
      },
      {
        ...BlobsListContextDefaultValue[1],
        refresh,
      },
    ]

    render(
      <BlobsListContext.Provider value={blobsContextValue}>
        <BlobsList.Pagination />
      </BlobsListContext.Provider>
    )

    const refreshButton = screen.getByText('Refresh')
    await user.click(refreshButton)

    expect(refresh).toHaveBeenCalledOnce()
  })
})


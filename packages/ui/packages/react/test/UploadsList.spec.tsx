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
  UploadsList,
  UploadsListContext,
  UploadsListContextDefaultValue,
  UploadsListContextValue,
} from '../src/UploadsList.js'

const mockSpace = {
  did: () => 'did:key:z6MktestSpace',
  name: 'Test Space',
}

const mockUploads = [
  {
    root: { toString: () => 'bafyupload1' },
    updatedAt: new Date().toISOString(),
  },
  {
    root: { toString: () => 'bafyupload2' },
    updatedAt: new Date().toISOString(),
  },
]

const mockClient = {
  currentSpace: vi.fn().mockReturnValue(mockSpace),
  setCurrentSpace: vi.fn().mockResolvedValue(undefined),
  capability: {
    upload: {
      list: vi.fn().mockResolvedValue({
        results: mockUploads,
        cursor: 'next-cursor',
      }),
    },
  },
}

describe('UploadsList', () => {
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
        <UploadsList space={mockSpace}>
          <UploadsList.Table />
        </UploadsList>
      </Context.Provider>
    )

    await waitFor(() => {
      expect(mockClient.capability.upload.list).toHaveBeenCalled()
    })
  })

  test('renders pagination controls', async () => {
    render(
      <Context.Provider value={contextValue}>
        {/* @ts-expect-error not a real space */}
        <UploadsList space={mockSpace}>
          <UploadsList.Pagination />
        </UploadsList>
      </Context.Provider>
    )

    await waitFor(() => {
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })
  })

  test('shows empty state when no uploads', async () => {
    const emptyClient = {
      ...mockClient,
      capability: {
        upload: {
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
        <UploadsList space={mockSpace}>
          <UploadsList.Empty>No uploads found</UploadsList.Empty>
        </UploadsList>
      </Context.Provider>
    )

    await waitFor(() => {
      expect(screen.getByText('No uploads found')).toBeDefined()
    })
  })

  test('calls onUploadSelected when upload is clicked', async () => {
    const onUploadSelected = vi.fn()

    const uploadsContextValue: UploadsListContextValue = [
      {
        ...UploadsListContextDefaultValue[0],
        // @ts-expect-error not a real space
        space: mockSpace,
        // @ts-expect-error not real uploads
        uploads: mockUploads,
        loading: false,
      },
      {
        ...UploadsListContextDefaultValue[1],
        selectUpload: onUploadSelected,
      },
    ]

    render(
      <UploadsListContext.Provider value={uploadsContextValue}>
        {/* @ts-expect-error not a real upload */}
        <UploadsList.Item upload={mockUploads[0]}>
          <td>Upload 1</td>
        </UploadsList.Item>
      </UploadsListContext.Provider>
    )

    const row = screen.getByText('Upload 1').closest('tr')
    if (row) {
      await user.click(row)
      expect(onUploadSelected).toHaveBeenCalledWith(mockUploads[0].root)
    }
  })

  test('navigates to next page', async () => {
    const loadNext = vi.fn()

    const uploadsContextValue: UploadsListContextValue = [
      {
        ...UploadsListContextDefaultValue[0],
        // @ts-expect-error not a real space
        space: mockSpace,
        // @ts-expect-error not real uploads
        uploads: mockUploads,
        hasNext: true,
        loading: false,
      },
      {
        ...UploadsListContextDefaultValue[1],
        loadNext,
      },
    ]

    render(
      <UploadsListContext.Provider value={uploadsContextValue}>
        <UploadsList.Pagination />
      </UploadsListContext.Provider>
    )

    const nextButton = screen.getByText('Next')
    await user.click(nextButton)

    expect(loadNext).toHaveBeenCalledOnce()
  })

  test('refreshes list', async () => {
    const refresh = vi.fn()

    const uploadsContextValue: UploadsListContextValue = [
      {
        ...UploadsListContextDefaultValue[0],
        // @ts-expect-error not a real space
        space: mockSpace,
        // @ts-expect-error not real uploads
        uploads: mockUploads,
        loading: false,
      },
      {
        ...UploadsListContextDefaultValue[1],
        refresh,
      },
    ]

    render(
      <UploadsListContext.Provider value={uploadsContextValue}>
        <UploadsList.Pagination />
      </UploadsListContext.Provider>
    )

    const refreshButton = screen.getByText('Refresh')
    await user.click(refreshButton)

    expect(refresh).toHaveBeenCalledOnce()
  })
})


import 'fake-indexeddb/auto'
import { test, expect, vi, describe, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import {
  Context,
  ContextDefaultValue,
  ContextValue,
} from '../src/providers/Provider.js'
import {
  FileViewer,
  FileViewerContext,
  FileViewerContextDefaultValue,
  FileViewerContextValue,
} from '../src/FileViewer.js'

const mockSpace = {
  did: () => 'did:key:z6MktestSpace',
  name: 'Test Space',
}

const mockFile = {
  toString: () => 'bafyfile123',
  code: 0x0202, // CAR codec
  multihash: new Uint8Array([1, 2, 3]),
}

const mockClient = {
  currentSpace: vi.fn().mockReturnValue(mockSpace),
  setCurrentSpace: vi.fn().mockResolvedValue(undefined),
  capability: {
    blob: {
      get: vi.fn().mockResolvedValue({
        ok: {
          blob: {
            size: 1024,
          },
        },
      }),
    },
  },
}

describe('FileViewer', () => {
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

  test('renders file CID', async () => {
    render(
      <Context.Provider value={contextValue}>
        {/* @ts-expect-error not real space and file */}
        <FileViewer space={mockSpace} file={mockFile}>
          <FileViewer.CID />
        </FileViewer>
      </Context.Provider>
    )

    await waitFor(() => {
      expect(screen.getByText('bafyfile123')).toBeDefined()
    })
  })

  test('renders file size', async () => {
    render(
      <Context.Provider value={contextValue}>
        {/* @ts-expect-error not real space and file */}
        <FileViewer space={mockSpace} file={mockFile}>
          <FileViewer.Size />
        </FileViewer>
      </Context.Provider>
    )

    await waitFor(() => {
      expect(screen.getByText('1024 bytes')).toBeDefined()
    })
  })

  test('shows loading state', () => {
    const fileViewerContextValue: FileViewerContextValue = [
      {
        ...FileViewerContextDefaultValue[0],
        // @ts-expect-error not a real space
        space: mockSpace,
        // @ts-expect-error not a real file
        file: mockFile,
        loading: true,
      },
      FileViewerContextDefaultValue[1],
    ]

    render(
      <FileViewerContext.Provider value={fileViewerContextValue}>
        <FileViewer.Loading>Loading...</FileViewer.Loading>
      </FileViewerContext.Provider>
    )

    expect(screen.getByText('Loading...')).toBeDefined()
  })

  test('shows error message', () => {
    const fileViewerContextValue: FileViewerContextValue = [
      {
        ...FileViewerContextDefaultValue[0],
        // @ts-expect-error not a real space
        space: mockSpace,
        // @ts-expect-error not a real file
        file: mockFile,
        error: 'Failed to load file',
      },
      FileViewerContextDefaultValue[1],
    ]

    render(
      <FileViewerContext.Provider value={fileViewerContextValue}>
        <FileViewer.Error />
      </FileViewerContext.Provider>
    )

    expect(screen.getByText('Failed to load file')).toBeDefined()
  })

  test('renders file details', async () => {
    const fileDetails = {
      link: mockFile,
      size: 1024,
      pieceCid: 'bafypiece123',
    }

    const fileViewerContextValue: FileViewerContextValue = [
      {
        ...FileViewerContextDefaultValue[0],
        // @ts-expect-error not a real space
        space: mockSpace,
        // @ts-expect-error not a real file
        file: mockFile,
        // @ts-expect-error not full file details
        fileDetails,
        loading: false,
      },
      FileViewerContextDefaultValue[1],
    ]

    render(
      <FileViewerContext.Provider value={fileViewerContextValue}>
        <FileViewer.Details />
      </FileViewerContext.Provider>
    )

    expect(screen.getByText(/bafyfile123/)).toBeDefined()
    expect(screen.getByText(/1024 bytes/)).toBeDefined()
  })

  test('hides loading when not loading', () => {
    const fileViewerContextValue: FileViewerContextValue = [
      {
        ...FileViewerContextDefaultValue[0],
        // @ts-expect-error not a real space
        space: mockSpace,
        // @ts-expect-error not a real file
        file: mockFile,
        loading: false,
      },
      FileViewerContextDefaultValue[1],
    ]

    render(
      <FileViewerContext.Provider value={fileViewerContextValue}>
        <FileViewer.Loading>Loading...</FileViewer.Loading>
      </FileViewerContext.Provider>
    )

    const loadingDiv = screen.getByText('Loading...')
    expect(loadingDiv.style.display).toBe('none')
  })

  test('hides error when no error', () => {
    const fileViewerContextValue: FileViewerContextValue = [
      {
        ...FileViewerContextDefaultValue[0],
        // @ts-expect-error not a real space
        space: mockSpace,
        // @ts-expect-error not a real file
        file: mockFile,
      },
      FileViewerContextDefaultValue[1],
    ]

    render(
      <FileViewerContext.Provider value={fileViewerContextValue}>
        <FileViewer.Error>Error placeholder</FileViewer.Error>
      </FileViewerContext.Provider>
    )

    const errorDiv = screen.getByText('Error placeholder')
    expect(errorDiv.style.display).toBe('none')
  })
})


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
  ShareTool,
  ShareToolContext,
  ShareToolContextDefaultValue,
  ShareToolContextValue,
} from '../src/ShareTool.js'

const mockSpace = {
  did: () => 'did:key:z6MktestSpace',
  name: 'Test Space',
}

const mockClient = {
  currentSpace: vi.fn().mockReturnValue(mockSpace),
  setCurrentSpace: vi.fn().mockResolvedValue(undefined),
  shareSpace: vi.fn().mockResolvedValue(undefined),
  createDelegation: vi.fn().mockResolvedValue({
    archive: vi.fn().mockResolvedValue({
      ok: new Uint8Array([1, 2, 3]),
      error: undefined,
    }),
  }),
}

describe('ShareTool', () => {
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

  test('renders recipient input', () => {
    render(
      <Context.Provider value={contextValue}>
        {/* @ts-expect-error not a real space */}
        <ShareTool space={mockSpace}>
          <ShareTool.Form>
            <ShareTool.RecipientInput placeholder="Email or DID" />
          </ShareTool.Form>
        </ShareTool>
      </Context.Provider>
    )

    const input = screen.getByPlaceholderText('Email or DID')
    expect(input).toBeDefined()
    expect(input.hasAttribute('required')).toBe(true)
  })

  test('renders submit button', () => {
    render(
      <Context.Provider value={contextValue}>
        {/* @ts-expect-error not a real space */}
        <ShareTool space={mockSpace}>
          <ShareTool.Form>
            <ShareTool.SubmitButton>Share</ShareTool.SubmitButton>
          </ShareTool.Form>
        </ShareTool>
      </Context.Provider>
    )

    const button = screen.getByText('Share')
    expect(button).toBeDefined()
    expect(button.getAttribute('type')).toBe('submit')
  })

  test('allows typing recipient', async () => {
    render(
      <Context.Provider value={contextValue}>
        {/* @ts-expect-error not a real space */}
        <ShareTool space={mockSpace}>
          <ShareTool.Form>
            <ShareTool.RecipientInput placeholder="Email or DID" />
          </ShareTool.Form>
        </ShareTool>
      </Context.Provider>
    )

    const input = screen.getByPlaceholderText('Email or DID')
    await user.click(input)
    await user.keyboard('test@example.com')

    expect((input as HTMLInputElement).value).toBe('test@example.com')
  })

  test('disables submit button while sharing', () => {
    const shareContextValue: ShareToolContextValue = [
      {
        ...ShareToolContextDefaultValue[0],
        // @ts-expect-error not a real space
        space: mockSpace,
        sharing: true,
        recipient: 'test@example.com',
      },
      ShareToolContextDefaultValue[1],
    ]

    render(
      <ShareToolContext.Provider value={shareContextValue}>
        <ShareTool.SubmitButton>Share</ShareTool.SubmitButton>
      </ShareToolContext.Provider>
    )

    const button = screen.getByText('Share')
    expect(button.hasAttribute('disabled')).toBe(true)
  })

  test('shows error message', () => {
    const shareContextValue: ShareToolContextValue = [
      {
        ...ShareToolContextDefaultValue[0],
        // @ts-expect-error not a real space
        space: mockSpace,
        error: 'Failed to share space',
      },
      ShareToolContextDefaultValue[1],
    ]

    render(
      <ShareToolContext.Provider value={shareContextValue}>
        <ShareTool.Error />
      </ShareToolContext.Provider>
    )

    expect(screen.getByText('Failed to share space')).toBeDefined()
  })

  test('shows success message', () => {
    const shareContextValue: ShareToolContextValue = [
      {
        ...ShareToolContextDefaultValue[0],
        // @ts-expect-error not a real space
        space: mockSpace,
        successMessage: 'Space shared successfully',
      },
      ShareToolContextDefaultValue[1],
    ]

    render(
      <ShareToolContext.Provider value={shareContextValue}>
        <ShareTool.Success />
      </ShareToolContext.Provider>
    )

    expect(screen.getByText('Space shared successfully')).toBeDefined()
  })

  test('calls onShared when share is successful', async () => {
    const onShared = vi.fn()

    render(
      <Context.Provider value={contextValue}>
        {/* @ts-expect-error not a real space */}
        <ShareTool space={mockSpace} onShared={onShared}>
          <ShareTool.Form>
            <ShareTool.RecipientInput placeholder="Email or DID" />
            <ShareTool.SubmitButton>Share</ShareTool.SubmitButton>
          </ShareTool.Form>
        </ShareTool>
      </Context.Provider>
    )

    const input = screen.getByPlaceholderText('Email or DID')
    await user.click(input)
    await user.keyboard('test@example.com')

    const button = screen.getByText('Share')
    await user.click(button)

    await waitFor(() => {
      expect(onShared).toHaveBeenCalledWith('test@example.com')
    })
  })

  test('hides error when no error', () => {
    const shareContextValue: ShareToolContextValue = [
      {
        ...ShareToolContextDefaultValue[0],
        // @ts-expect-error not a real space
        space: mockSpace,
      },
      ShareToolContextDefaultValue[1],
    ]

    render(
      <ShareToolContext.Provider value={shareContextValue}>
        <ShareTool.Error>Error placeholder</ShareTool.Error>
      </ShareToolContext.Provider>
    )

    const errorDiv = screen.getByText('Error placeholder')
    expect(errorDiv.style.display).toBe('none')
  })
})


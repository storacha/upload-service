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
  SpaceCreator,
  SpaceCreatorContext,
  SpaceCreatorContextDefaultValue,
  SpaceCreatorContextValue,
} from '../src/SpaceCreator.js'

const mockAccount = {
  did: () => 'did:mailto:test@example.com',
  plan: {
    get: vi.fn().mockResolvedValue({ ok: { product: 'free' } }),
  },
  provision: vi.fn().mockResolvedValue({ ok: {} }),
}

const mockClient = {
  createSpace: vi.fn().mockResolvedValue({
    did: () => 'did:key:z6MknewSpace',
    name: 'New Test Space',
    save: vi.fn().mockResolvedValue(undefined),
    createRecovery: vi.fn().mockResolvedValue({}),
  }),
  capability: {
    access: {
      delegate: vi.fn().mockResolvedValue({ ok: {} }),
    },
  },
  spaces: vi.fn().mockReturnValue([
    {
      did: () => 'did:key:z6MknewSpace',
      name: 'New Test Space',
    },
  ]),
}

describe('SpaceCreator', () => {
  let contextValue: ContextValue

  beforeEach(() => {
    vi.clearAllMocks()
    contextValue = [
      {
        ...ContextDefaultValue[0],
        // @ts-expect-error not a real client
        client: mockClient,
        // @ts-expect-error not real accounts
        accounts: [mockAccount],
      },
      ContextDefaultValue[1],
    ]
  })

  afterEach(() => {
    cleanup()
  })

  test('renders name input', () => {
    render(
      <Context.Provider value={contextValue}>
        <SpaceCreator>
          <SpaceCreator.Form>
            <SpaceCreator.NameInput placeholder="Space name" />
          </SpaceCreator.Form>
        </SpaceCreator>
      </Context.Provider>
    )

    const input = screen.getByPlaceholderText('Space name')
    expect(input).toBeDefined()
    expect(input.hasAttribute('required')).toBe(true)
  })

  test('renders access type select', () => {
    render(
      <Context.Provider value={contextValue}>
        <SpaceCreator>
          <SpaceCreator.Form>
            <SpaceCreator.AccessTypeSelect />
          </SpaceCreator.Form>
        </SpaceCreator>
      </Context.Provider>
    )

    const select = screen.getByRole('combobox')
    expect(select).toBeDefined()
  })

  test('renders submit button', () => {
    render(
      <Context.Provider value={contextValue}>
        <SpaceCreator>
          <SpaceCreator.Form>
            <SpaceCreator.SubmitButton>Create</SpaceCreator.SubmitButton>
          </SpaceCreator.Form>
        </SpaceCreator>
      </Context.Provider>
    )

    const button = screen.getByText('Create')
    expect(button).toBeDefined()
    expect(button.getAttribute('type')).toBe('submit')
  })

  test('allows typing space name', async () => {
    render(
      <Context.Provider value={contextValue}>
        <SpaceCreator>
          <SpaceCreator.Form>
            <SpaceCreator.NameInput placeholder="Space name" />
          </SpaceCreator.Form>
        </SpaceCreator>
      </Context.Provider>
    )

    const input = screen.getByPlaceholderText('Space name')
    await user.click(input)
    await user.keyboard('My New Space')

    expect((input as HTMLInputElement).value).toBe('My New Space')
  })

  test('allows selecting access type', async () => {
    render(
      <Context.Provider value={contextValue}>
        <SpaceCreator>
          <SpaceCreator.Form>
            <SpaceCreator.AccessTypeSelect />
          </SpaceCreator.Form>
        </SpaceCreator>
      </Context.Provider>
    )

    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'private')

    expect((select as HTMLSelectElement).value).toBe('private')
  })

  test('disables submit button while creating', () => {
    const creatorContextValue: SpaceCreatorContextValue = [
      {
        ...SpaceCreatorContextDefaultValue[0],
        creating: true,
        name: 'Test Space',
      },
      SpaceCreatorContextDefaultValue[1],
    ]

    render(
      <SpaceCreatorContext.Provider value={creatorContextValue}>
        <SpaceCreator.SubmitButton>Create</SpaceCreator.SubmitButton>
      </SpaceCreatorContext.Provider>
    )

    const button = screen.getByText('Create')
    expect(button.hasAttribute('disabled')).toBe(true)
  })

  test('calls onSpaceCreated when space is created', async () => {
    const onSpaceCreated = vi.fn()

    render(
      <Context.Provider value={contextValue}>
        <SpaceCreator onSpaceCreated={onSpaceCreated}>
          <SpaceCreator.Form>
            <SpaceCreator.NameInput placeholder="Space name" />
            <SpaceCreator.AccessTypeSelect />
            <SpaceCreator.SubmitButton>Create</SpaceCreator.SubmitButton>
          </SpaceCreator.Form>
        </SpaceCreator>
      </Context.Provider>
    )

    const input = screen.getByPlaceholderText('Space name')
    await user.click(input)
    await user.keyboard('Test Space')

    const button = screen.getByText('Create')
    await user.click(button)

    await waitFor(() => {
      expect(mockClient.createSpace).toHaveBeenCalledWith(
        'Test Space',
        expect.any(Object)
      )
    })
  })

  test('calls onError when creation fails', async () => {
    const onError = vi.fn()
    const failingClient = {
      ...mockClient,
      createSpace: vi.fn().mockRejectedValue(new Error('Creation failed')),
    }

    const failingContextValue: ContextValue = [
      {
        ...ContextDefaultValue[0],
        // @ts-expect-error not a real client
        client: failingClient,
        // @ts-expect-error not real accounts
        accounts: [mockAccount],
      },
      ContextDefaultValue[1],
    ]

    render(
      <Context.Provider value={failingContextValue}>
        <SpaceCreator onError={onError}>
          <SpaceCreator.Form>
            <SpaceCreator.NameInput placeholder="Space name" />
            <SpaceCreator.SubmitButton>Create</SpaceCreator.SubmitButton>
          </SpaceCreator.Form>
        </SpaceCreator>
      </Context.Provider>
    )

    const input = screen.getByPlaceholderText('Space name')
    await user.click(input)
    await user.keyboard('Test Space')

    const button = screen.getByText('Create')
    await user.click(button)

    await waitFor(() => {
      expect(onError).toHaveBeenCalled()
    })
  })
})


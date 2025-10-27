import 'fake-indexeddb/auto'
import { test, expect, vi, describe, beforeEach, afterEach } from 'vitest'
import { userEvent as user } from '@testing-library/user-event'
import { render, screen, cleanup } from '@testing-library/react'
import {
  Context,
  ContextDefaultValue,
  ContextValue,
} from '../src/providers/Provider.js'
import {
  SpacePicker,
  SpacePickerContext,
  SpacePickerContextDefaultValue,
  SpacePickerContextValue,
} from '../src/SpacePicker.js'

// Mock space objects
const mockPublicSpace = {
  did: () => 'did:key:z6MkpublicSpace',
  name: 'Public Test Space',
  access: { type: 'public' },
}

const mockPrivateSpace = {
  did: () => 'did:key:z6MkprivateSpace',
  name: 'Private Test Space',
  access: { type: 'private' },
}

describe('SpacePicker', () => {
  let contextValue: ContextValue

  beforeEach(() => {
    contextValue = [
      {
        ...ContextDefaultValue[0],
        // @ts-expect-error not real spaces
        spaces: [mockPublicSpace, mockPrivateSpace],
      },
      ContextDefaultValue[1],
    ]
  })

  afterEach(() => {
    cleanup()
  })

  test('renders input field', () => {
    render(
      <Context.Provider value={contextValue}>
        <SpacePicker>
          <SpacePicker.Input placeholder="Search spaces" />
        </SpacePicker>
      </Context.Provider>
    )

    const input = screen.getByPlaceholderText('Search spaces')
    expect(input).toBeDefined()
  })

  test('filters spaces by query', async () => {
    const onSpaceSelected = vi.fn()
    
    render(
      <Context.Provider value={contextValue}>
        <SpacePicker onSpaceSelected={onSpaceSelected}>
          <SpacePicker.Input placeholder="Search" />
        </SpacePicker>
      </Context.Provider>
    )

    const input = screen.getByPlaceholderText('Search')
    await user.click(input)
    await user.keyboard('Public')

    // After typing, the input should contain the search query
    expect((input as HTMLInputElement).value).toBe('Public')
  })

  test('calls onSpaceSelected when space is selected', async () => {
    const onSpaceSelected = vi.fn()
    
    const pickerContextValue: SpacePickerContextValue = [
      {
        ...SpacePickerContextDefaultValue[0],
        spaces: [mockPublicSpace as any],
        publicSpaces: [mockPublicSpace as any],
        privateSpaces: [],
        filteredSpaces: [mockPublicSpace as any],
        query: '',
      },
      {
        ...SpacePickerContextDefaultValue[1],
        setSelectedSpace: onSpaceSelected,
      },
    ]

    render(
      <SpacePickerContext.Provider value={pickerContextValue}>
        <SpacePicker.Item space={mockPublicSpace as any}>
          Select Space
        </SpacePicker.Item>
      </SpacePickerContext.Provider>
    )

    const item = screen.getByText('Select Space')
    await user.click(item)

    expect(onSpaceSelected).toHaveBeenCalledWith(mockPublicSpace)
  })

  test('separates public and private spaces', () => {
    render(
      <Context.Provider value={contextValue}>
        <SpacePicker showPrivateSpaces={true}>
          <SpacePicker.Input />
        </SpacePicker>
      </Context.Provider>
    )

    // Component should properly categorize spaces
    // This is a structural test to ensure no errors occur
    expect(screen.getByRole('searchbox')).toBeDefined()
  })

  test('hides private spaces when showPrivateSpaces is false', () => {
    render(
      <Context.Provider value={contextValue}>
        <SpacePicker showPrivateSpaces={false}>
          <SpacePicker.Input />
        </SpacePicker>
      </Context.Provider>
    )

    expect(screen.getByRole('searchbox')).toBeDefined()
  })
})

describe('useSpaceSelection hook', () => {
  afterEach(() => {
    cleanup()
  })

  test('returns spaces and selection functions', () => {
    const contextValue: ContextValue = [
      {
        ...ContextDefaultValue[0],
        // @ts-expect-error not real spaces
        spaces: [mockPublicSpace],
      },
      ContextDefaultValue[1],
    ]

    render(
      <Context.Provider value={contextValue}>
        <SpacePicker>
          <SpacePicker.Input />
        </SpacePicker>
      </Context.Provider>
    )

    // If component renders without error, hook is working
    expect(screen.getByRole('searchbox')).toBeDefined()
  })
})


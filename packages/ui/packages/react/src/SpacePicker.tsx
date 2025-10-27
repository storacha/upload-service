import type { As, Component, Props, Options } from 'ariakit-react-utils'
import type { ChangeEvent } from 'react'
import {
  Fragment,
  createContext,
  useContext,
  useState,
  useMemo,
} from 'react'
import { createComponent, createElement } from 'ariakit-react-utils'
import { useW3 } from './providers/Provider.js'
import type { Space } from '@storacha/ui-core'

/**
 * SpacePicker State
 */
export interface SpacePickerState {
  spaces: Space[]
  publicSpaces: Space[]
  privateSpaces: Space[]
  filteredSpaces: Space[]
  selectedSpace?: Space
  query: string
  showPrivateSpaces: boolean
}

/**
 * SpacePicker Actions
 */
export interface SpacePickerActions {
  setSelectedSpace: (space: Space) => void
  setQuery: (query: string) => void
  clearSelection: () => void
}

/**
 * SpacePicker Context Value
 */
export type SpacePickerContextValue = [SpacePickerState, SpacePickerActions]

/**
 * Default context value
 */
export const SpacePickerContextDefaultValue: SpacePickerContextValue = [
  {
    spaces: [],
    publicSpaces: [],
    privateSpaces: [],
    filteredSpaces: [],
    selectedSpace: undefined,
    query: '',
    showPrivateSpaces: true,
  },
  {
    setSelectedSpace: () => {},
    setQuery: () => {},
    clearSelection: () => {},
  },
]

/**
 * SpacePicker Context
 */
export const SpacePickerContext = createContext<SpacePickerContextValue>(
  SpacePickerContextDefaultValue
)

/**
 * Hook to access SpacePicker state and actions
 */
export function useSpacePicker(): SpacePickerContextValue {
  return useContext(SpacePickerContext)
}

/**
 * SpacePicker Root Options
 */
export type SpacePickerRootOptions<T extends As = typeof Fragment> = Options<T>

/**
 * SpacePicker Root Props
 */
export type SpacePickerRootProps<T extends As = typeof Fragment> = Props<
  SpacePickerRootOptions<T>
> & {
  onSpaceSelected?: (space: Space) => void
  showPrivateSpaces?: boolean
}

/**
 * SpacePicker Root Component
 */
export const SpacePickerRoot: Component<SpacePickerRootProps> = createComponent(
  (props) => {
    const { onSpaceSelected, showPrivateSpaces = true, children } = props
    const [{ spaces }] = useW3()
    const [selectedSpace, setSelectedSpaceState] = useState<Space | undefined>()
    const [query, setQuery] = useState('')

    // Separate public and private spaces
    const { publicSpaces, privateSpaces } = useMemo(() => {
      const pub: Space[] = []
      const priv: Space[] = []

      spaces.forEach((space) => {
        const accessType = (space as any).access?.type
        if (accessType === 'private') {
          priv.push(space)
        } else {
          pub.push(space)
        }
      })

      return { publicSpaces: pub, privateSpaces: priv }
    }, [spaces])

    // Filter spaces based on query
    const filteredSpaces = useMemo(() => {
      if (!query) {
        return showPrivateSpaces
          ? [...publicSpaces, ...privateSpaces]
          : publicSpaces
      }

      const lowerQuery = query.toLowerCase()
      const allSpaces = showPrivateSpaces
        ? [...publicSpaces, ...privateSpaces]
        : publicSpaces

      return allSpaces.filter(
        (space) =>
          space.name?.toLowerCase().includes(lowerQuery) ||
          space.did().toLowerCase().includes(lowerQuery)
      )
    }, [query, publicSpaces, privateSpaces, showPrivateSpaces])

    // Actions
    const setSelectedSpace = (space: Space) => {
      setSelectedSpaceState(space)
      onSpaceSelected?.(space)
    }

    const clearSelection = () => {
      setSelectedSpaceState(undefined)
    }

    const contextValue: SpacePickerContextValue = [
      {
        spaces,
        publicSpaces: showPrivateSpaces ? publicSpaces : [],
        privateSpaces: showPrivateSpaces ? privateSpaces : [],
        filteredSpaces,
        selectedSpace,
        query,
        showPrivateSpaces,
      },
      {
        setSelectedSpace,
        setQuery,
        clearSelection,
      },
    ]

    return createElement(
      SpacePickerContext.Provider,
      { value: contextValue, children }
    )
  }
)

/**
 * SpacePicker Input Options
 */
export type SpacePickerInputOptions<T extends As = 'input'> = Options<T> & {
  placeholder?: string
}

/**
 * SpacePicker Input Props
 */
export type SpacePickerInputProps<T extends As = 'input'> = Props<
  SpacePickerInputOptions<T>
>

/**
 * SpacePicker Input Component
 */
export const SpacePickerInput: Component<SpacePickerInputProps> =
  createComponent((props) => {
    const [{ query }, { setQuery }] = useSpacePicker()

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value)
    }

    return createElement('input', {
      ...props,
      type: 'text',
      value: query,
      onChange: handleChange,
      role: 'searchbox',
    })
  })

/**
 * SpacePicker List Options
 */
export type SpacePickerListOptions<T extends As = 'div'> = Options<T>

/**
 * SpacePicker List Props
 */
export type SpacePickerListProps<T extends As = 'div'> = Props<
  SpacePickerListOptions<T>
>

/**
 * SpacePicker List Component
 */
export const SpacePickerList: Component<SpacePickerListProps> = createComponent(
  (props) => {
    const [{ filteredSpaces }] = useSpacePicker()

    return createElement('div', {
      ...props,
      role: 'listbox',
      children:
        filteredSpaces.length === 0
          ? 'No spaces found'
          : filteredSpaces.map((space) =>
              createElement(SpacePickerOption, {
                key: space.did(),
                space,
                children: space.name || space.did(),
              })
            ),
    })
  }
)

/**
 * SpacePicker Option Options
 */
export type SpacePickerOptionOptions<T extends As = 'div'> = Options<T> & {
  space: Space
}

/**
 * SpacePicker Option Props
 */
export type SpacePickerOptionProps<T extends As = 'div'> = Props<
  SpacePickerOptionOptions<T>
>

/**
 * SpacePicker Option Component
 */
export const SpacePickerOption: Component<SpacePickerOptionProps> =
  createComponent((props) => {
    const { space, children, ...restProps } = props
    const [{ selectedSpace }, { setSelectedSpace }] = useSpacePicker()

    const isSelected = selectedSpace?.did() === space.did()

    return createElement('div', {
      ...restProps,
      role: 'option',
      'aria-selected': isSelected,
      onClick: () => setSelectedSpace(space),
      children,
    })
  })

/**
 * SpacePicker Item (alias for Option)
 */
export const SpacePickerItem = SpacePickerOption

/**
 * SpacePicker Public Spaces Section Options
 */
export type SpacePickerPublicSpacesSectionOptions<T extends As = 'div'> =
  Options<T>

/**
 * SpacePicker Public Spaces Section Props
 */
export type SpacePickerPublicSpacesSectionProps<T extends As = 'div'> = Props<
  SpacePickerPublicSpacesSectionOptions<T>
>

/**
 * SpacePicker Public Spaces Section
 */
export const SpacePickerPublicSpacesSection: Component<SpacePickerPublicSpacesSectionProps> =
  createComponent((props) => {
    const [{ publicSpaces }] = useSpacePicker()

    if (publicSpaces.length === 0) {
      return createElement('div', { ...props, style: { display: 'none' } })
    }

    return createElement('div', props)
  })

/**
 * SpacePicker Private Spaces Section Options
 */
export type SpacePickerPrivateSpacesSectionOptions<T extends As = 'div'> =
  Options<T>

/**
 * SpacePicker Private Spaces Section Props
 */
export type SpacePickerPrivateSpacesSectionProps<T extends As = 'div'> = Props<
  SpacePickerPrivateSpacesSectionOptions<T>
>

/**
 * SpacePicker Private Spaces Section
 */
export const SpacePickerPrivateSpacesSection: Component<SpacePickerPrivateSpacesSectionProps> =
  createComponent((props) => {
    const [{ privateSpaces }] = useSpacePicker()

    if (privateSpaces.length === 0) {
      return createElement('div', { ...props, style: { display: 'none' } })
    }

    return createElement('div', props)
  })

/**
 * SpacePicker Empty State Options
 */
export type SpacePickerEmptyOptions<T extends As = 'div'> = Options<T>

/**
 * SpacePicker Empty State Props
 */
export type SpacePickerEmptyProps<T extends As = 'div'> = Props<
  SpacePickerEmptyOptions<T>
>

/**
 * SpacePicker Empty State
 */
export const SpacePickerEmpty: Component<SpacePickerEmptyProps> =
  createComponent((props) => {
    const [{ filteredSpaces }] = useSpacePicker()

    if (filteredSpaces.length > 0) {
      return createElement('div', { ...props, style: { display: 'none' } })
    }

    return createElement('div', { ...props, role: 'status' })
  })

/**
 * Main SpacePicker Component
 */
export const SpacePicker = Object.assign(SpacePickerRoot, {
  Input: SpacePickerInput,
  List: SpacePickerList,
  Option: SpacePickerOption,
  Item: SpacePickerItem,
  PublicSpacesSection: SpacePickerPublicSpacesSection,
  PrivateSpacesSection: SpacePickerPrivateSpacesSection,
  Empty: SpacePickerEmpty,
})

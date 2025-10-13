import type { As, Component, Props, Options } from 'ariakit-react-utils'
import type { Space } from '@storacha/ui-core'
import type { ChangeEvent, FormEventHandler } from 'react'

import {
  Fragment,
  useState,
  createContext,
  useContext,
  useCallback,
  useMemo,
} from 'react'
import { createComponent, createElement } from 'ariakit-react-utils'
import { useW3 } from './providers/Provider.js'

export interface SpacePickerContextState {
  /**
   * Available spaces for the current user
   */
  spaces: Space[]
  /**
   * Currently selected space
   */
  selectedSpace?: Space
  /**
   * Is the create space dialog open?
   */
  showCreateDialog: boolean
  /**
   * Name for new space being created
   */
  newSpaceName: string
  /**
   * Is a space creation in progress?
   */
  creatingSpace: boolean
  /**
   * Error during space creation
   */
  createError?: Error
}

export interface SpacePickerContextActions {
  /**
   * Select a space
   */
  selectSpace: (space: Space) => void
  /**
   * Open/close create space dialog
   */
  setShowCreateDialog: (show: boolean) => void
  /**
   * Set new space name
   */
  setNewSpaceName: (name: string) => void
  /**
   * Create a new space
   */
  createSpace: () => Promise<void>
}

export type SpacePickerContextValue = [
  state: SpacePickerContextState,
  actions: SpacePickerContextActions
]

export const SpacePickerContextDefaultValue: SpacePickerContextValue = [
  {
    spaces: [],
    showCreateDialog: false,
    newSpaceName: '',
    creatingSpace: false,
  },
  {
    selectSpace: () => {
      throw new Error('missing select space function')
    },
    setShowCreateDialog: () => {
      throw new Error('missing set show create dialog function')
    },
    setNewSpaceName: () => {
      throw new Error('missing set new space name function')
    },
    createSpace: async () => {
      throw new Error('missing create space function')
    },
  },
]

export const SpacePickerContext = createContext<SpacePickerContextValue>(
  SpacePickerContextDefaultValue
)

export type SpacePickerRootOptions<T extends As = typeof Fragment> = Options<T> & {
  /**
   * Callback when a space is selected
   */
  onSpaceSelect?: (space: Space) => void
  /**
   * Filter spaces by type
   */
  spaceType?: 'public' | 'private' | 'all'
}

export type SpacePickerRootProps<T extends As = typeof Fragment> = Props<
  SpacePickerRootOptions<T>
>

/**
 * Top level component of the headless SpacePicker.
 *
 * Must be used inside a w3ui Provider.
 */
export const SpacePickerRoot: Component<SpacePickerRootProps> =
  createComponent(({ onSpaceSelect, spaceType = 'all', ...props }) => {
    const [{ client, spaces: allSpaces }] = useW3()
    const [selectedSpace, setSelectedSpace] = useState<Space>()
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [newSpaceName, setNewSpaceName] = useState('')
    const [creatingSpace, setCreatingSpace] = useState(false)
    const [createError, setCreateError] = useState<Error>()

    // Filter spaces based on spaceType
    const spaces = useMemo(() => {
      if (spaceType === 'all') return allSpaces
      return allSpaces.filter(space => {
        const access = space.meta()?.access
        if (spaceType === 'private') return access?.type === 'private'
        if (spaceType === 'public') return access?.type !== 'private'
        return true
      })
    }, [allSpaces, spaceType])

    const selectSpace = useCallback((space: Space) => {
      setSelectedSpace(space)
      onSpaceSelect?.(space)
    }, [onSpaceSelect])

    const createSpace = useCallback(async () => {
      if (!client) {
        throw new Error('Client not available')
      }
      
      setCreatingSpace(true)
      setCreateError(undefined)
      
      try {
        const space = await client.createSpace(newSpaceName || '') as any
        setNewSpaceName('')
        setShowCreateDialog(false)
        selectSpace(space)
      } catch (error) {
        setCreateError(error instanceof Error ? error : new Error(String(error)))
      } finally {
        setCreatingSpace(false)
      }
    }, [client, newSpaceName, selectSpace])

    const value = useMemo<SpacePickerContextValue>(
      () => [
        {
          spaces,
          selectedSpace,
          showCreateDialog,
          newSpaceName,
          creatingSpace,
          createError,
        },
        {
          selectSpace,
          setShowCreateDialog,
          setNewSpaceName,
          createSpace,
        },
      ],
      [
        spaces,
        selectedSpace,
        showCreateDialog,
        newSpaceName,
        creatingSpace,
        createError,
        selectSpace,
        createSpace,
      ]
    )

    return (
      <SpacePickerContext.Provider value={value}>
        {createElement(Fragment, props)}
      </SpacePickerContext.Provider>
    )
  })

export type SpacePickerListOptions<T extends As = 'div'> = Options<T>
export type SpacePickerListProps<T extends As = 'div'> = Props<
  SpacePickerListOptions<T>
>

/**
 * List container for spaces
 */
export const SpacePickerList: Component<SpacePickerListProps> =
  createComponent((props) => {
    return createElement('div', { ...props, role: 'list' })
  })

export type SpacePickerItemOptions<T extends As = 'button'> = Options<T> & {
  space: Space
}
export type SpacePickerItemProps<T extends As = 'button'> = Props<
  SpacePickerItemOptions<T>
>

/**
 * Individual space item in the list
 */
export const SpacePickerItem: Component<SpacePickerItemProps> =
  createComponent(({ space, ...props }) => {
    const [{ selectedSpace }, { selectSpace }] = useSpacePicker()
    
    const handleClick = useCallback(() => {
      selectSpace(space)
    }, [space, selectSpace])

    const isSelected = selectedSpace?.did() === space.did()

    return createElement('button', {
      ...props,
      onClick: handleClick,
      'aria-selected': isSelected,
      role: 'listitem',
    })
  })

export type SpacePickerCreateDialogOptions<T extends As = 'div'> = Options<T>
export type SpacePickerCreateDialogProps<T extends As = 'div'> = Props<
  SpacePickerCreateDialogOptions<T>
>

/**
 * Dialog for creating a new space
 */
export const SpacePickerCreateDialog: Component<SpacePickerCreateDialogProps> =
  createComponent((props) => {
    const [{ showCreateDialog }] = useSpacePicker()
    
    if (!showCreateDialog) {
      return createElement('div', { style: { display: 'none' } })
    }

    return createElement('div', {
      ...props,
      role: 'dialog',
      'aria-modal': true,
    })
  })

export type SpacePickerCreateFormOptions<T extends As = 'form'> = Options<T>
export type SpacePickerCreateFormProps<T extends As = 'form'> = Props<
  SpacePickerCreateFormOptions<T>
>

/**
 * Form for creating a new space
 */
export const SpacePickerCreateForm: Component<SpacePickerCreateFormProps> =
  createComponent((props) => {
    const [, { createSpace }] = useSpacePicker()
    
    const handleSubmit: FormEventHandler<HTMLFormElement> = useCallback(
      async (e) => {
        e.preventDefault()
        await createSpace()
      },
      [createSpace]
    )

    return createElement('form', {
      ...props,
      onSubmit: handleSubmit,
    })
  })

export type SpacePickerNameInputOptions<T extends As = 'input'> = Options<T>
export type SpacePickerNameInputProps<T extends As = 'input'> = Props<
  SpacePickerNameInputOptions<T>
>

/**
 * Input for space name
 */
export const SpacePickerNameInput: Component<SpacePickerNameInputProps> =
  createComponent((props) => {
    const [{ newSpaceName }, { setNewSpaceName }] = useSpacePicker()
    
    const handleChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        setNewSpaceName(e.target.value)
      },
      [setNewSpaceName]
    )

    return createElement('input', {
      ...props,
      type: 'text',
      value: newSpaceName,
      onChange: handleChange,
    })
  })

export type SpacePickerCreateButtonOptions<T extends As = 'button'> = Options<T>
export type SpacePickerCreateButtonProps<T extends As = 'button'> = Props<
  SpacePickerCreateButtonOptions<T>
>

/**
 * Button to trigger space creation
 */
export const SpacePickerCreateButton: Component<SpacePickerCreateButtonOptions> =
  createComponent((props) => {
    const [{ creatingSpace }] = useSpacePicker()
    
    return createElement('button', {
      ...props,
      type: 'submit',
      disabled: creatingSpace,
    })
  })

export type SpacePickerCancelButtonOptions<T extends As = 'button'> = Options<T>
export type SpacePickerCancelButtonProps<T extends As = 'button'> = Props<
  SpacePickerCancelButtonOptions<T>
>

/**
 * Button to cancel space creation
 */
export const SpacePickerCancelButton: Component<SpacePickerCancelButtonProps> =
  createComponent((props) => {
    const [, { setShowCreateDialog, setNewSpaceName }] = useSpacePicker()
    
    const handleClick = useCallback(() => {
      setShowCreateDialog(false)
      setNewSpaceName('')
    }, [setShowCreateDialog, setNewSpaceName])

    return createElement('button', {
      ...props,
      type: 'button',
      onClick: handleClick,
    })
  })

/**
 * Use the scoped space picker context state from a parent `SpacePicker`.
 */
export function useSpacePicker(): SpacePickerContextValue {
  return useContext(SpacePickerContext)
}

export const SpacePicker = Object.assign(SpacePickerRoot, {
  List: SpacePickerList,
  Item: SpacePickerItem,
  CreateDialog: SpacePickerCreateDialog,
  CreateForm: SpacePickerCreateForm,
  NameInput: SpacePickerNameInput,
  CreateButton: SpacePickerCreateButton,
  CancelButton: SpacePickerCancelButton,
})
import type { As, Component, Props, Options } from 'ariakit-react-utils'
import type { ChangeEvent } from 'react'
import type { Space } from '@storacha/ui-core'

import React, {
  Fragment,
  useState,
  createContext,
  useContext,
  useCallback,
  useMemo,
} from 'react'
import { createComponent, createElement } from 'ariakit-react-utils'
import { useW3, ContextState, ContextActions } from './providers/Provider.js'

export type SpaceAccessType = 'public' | 'private'

export interface SpaceCreationOptions {
  name: string
  accessType: SpaceAccessType
}

export type SpaceCreatorContextState = ContextState & {
  /**
   * Name of the space being created
   */
  name: string
  /**
   * Access type (public or private)
   */
  accessType: SpaceAccessType
  /**
   * Is the creation in progress?
   */
  creating: boolean
  /**
   * Has the space been created?
   */
  created: boolean
  /**
   * The newly created space
   */
  createdSpace?: Space
  /**
   * Error message if creation failed
   */
  error?: string
  /**
   * Callback to handle form submission
   */
  handleCreateSubmit?: (e: React.FormEvent<HTMLFormElement>) => Promise<void>
}

export type SpaceCreatorContextActions = ContextActions & {
  /**
   * Set the space name
   */
  setName: React.Dispatch<React.SetStateAction<string>>
  /**
   * Set the access type
   */
  setAccessType: React.Dispatch<React.SetStateAction<SpaceAccessType>>
  /**
   * Reset the form
   */
  resetForm: () => void
}

export type SpaceCreatorContextValue = [
  state: SpaceCreatorContextState,
  actions: SpaceCreatorContextActions
]

export const SpaceCreatorContextDefaultValue: SpaceCreatorContextValue = [
  {
    accounts: [],
    spaces: [],
    name: '',
    accessType: 'public',
    creating: false,
    created: false,
  },
  {
    setName: () => {
      throw new Error('missing setName function')
    },
    setAccessType: () => {
      throw new Error('missing setAccessType function')
    },
    resetForm: () => {
      throw new Error('missing resetForm function')
    },
    logout: () => {
      throw new Error('missing logout function')
    },
  },
]

export const SpaceCreatorContext = createContext<SpaceCreatorContextValue>(
  SpaceCreatorContextDefaultValue
)

export type SpaceCreatorRootOptions<T extends As = typeof Fragment> = Options<T> & {
  /**
   * Callback when space is created
   */
  onSpaceCreated?: (space: Space) => void
  /**
   * Callback when creation fails
   */
  onError?: (error: Error) => void
  /**
   * Whether to allow private space creation
   */
  allowPrivateSpaces?: boolean
}

export type SpaceCreatorRootProps<T extends As = typeof Fragment> = Props<
  SpaceCreatorRootOptions<T>
>

/**
 * Top level component of the headless SpaceCreator.
 *
 * Must be used inside a w3ui Provider.
 *
 * Designed to be used by SpaceCreator.Form, SpaceCreator.NameInput
 * and others to make it easy to implement space creation UI.
 */
export const SpaceCreatorRoot: Component<SpaceCreatorRootProps> =
  createComponent((props) => {
    const [state, actions] = useW3()
    const { client, accounts } = state
    const [name, setName] = useState('')
    const [accessType, setAccessType] = useState<SpaceAccessType>('public')
    const [creating, setCreating] = useState(false)
    const [created, setCreated] = useState(false)
    const [createdSpace, setCreatedSpace] = useState<Space | undefined>()
    const [error, setError] = useState<string | undefined>()

    const resetForm = useCallback(() => {
      setName('')
      setAccessType('public')
      setCreating(false)
      setCreated(false)
      setCreatedSpace(undefined)
      setError(undefined)
    }, [])

    const handleCreateSubmit = useCallback(
      async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!client) {
          const err = new Error('Client not initialized')
          setError(err.message)
          props.onError?.(err)
          return
        }

        const account = accounts[0]
        if (!account) {
          const err = new Error('No account found. Please authorize your email first.')
          setError(err.message)
          props.onError?.(err)
          return
        }

        setCreating(true)
        setError(undefined)

        try {
          // Get account plan
          const { ok: plan } = await account.plan.get()
          if (!plan) {
            throw new Error('A payment plan is required on account to provision a new space.')
          }

          // Create space options
          const spaceOptions: any = {
            access: {
              type: accessType,
              ...(accessType === 'private'
                ? {
                    encryption: {
                      provider: 'google-kms',
                      algorithm: 'RSA_DECRYPT_OAEP_3072_SHA256',
                    },
                  }
                : {}),
            },
          }

          // Create the space
          const space = await client.createSpace(name, spaceOptions)

          // Provision the space
          const provisionResult = await account.provision(space.did())
          if (provisionResult.error) {
            throw new Error('Failed to provision space', { cause: provisionResult.error })
          }

          // Save the space (this creates necessary authorizations)
          await space.save()

          // Create recovery delegation
          const recovery = await space.createRecovery(account.did())
          await client.capability.access.delegate({
            space: space.did(),
            delegations: [recovery],
          })

          // Get the updated space from client
          const newSpace = client.spaces().find((s) => s.did() === space.did())
          if (newSpace) {
            setCreatedSpace(newSpace)
            setCreated(true)
            props.onSpaceCreated?.(newSpace)
          }

          resetForm()
        } catch (err: any) {
          const error = err instanceof Error ? err : new Error('Failed to create space')
          setError(error.message)
          props.onError?.(error)
          console.error('Failed to create space:', error)
        } finally {
          setCreating(false)
        }
      },
      [client, accounts, name, accessType, props.onSpaceCreated, props.onError, resetForm]
    )

    const value = useMemo<SpaceCreatorContextValue>(
      () => [
        {
          ...state,
          name,
          accessType,
          creating,
          created,
          createdSpace,
          error,
          handleCreateSubmit,
        },
        {
          ...actions,
          setName,
          setAccessType,
          resetForm,
        },
      ],
      [
        state,
        actions,
        name,
        accessType,
        creating,
        created,
        createdSpace,
        error,
        handleCreateSubmit,
        resetForm,
      ]
    )

    return (
      <SpaceCreatorContext.Provider value={value}>
        {createElement(Fragment, props)}
      </SpaceCreatorContext.Provider>
    )
  })

export type SpaceCreatorFormOptions<T extends As = 'form'> = Options<T>
export type SpaceCreatorFormProps<T extends As = 'form'> = Props<
  SpaceCreatorFormOptions<T>
>

/**
 * Form component for the headless SpaceCreator.
 *
 * A `form` designed to work with `SpaceCreator`. Any passed props will
 * be passed along to the `form` component.
 */
export const SpaceCreatorForm: Component<SpaceCreatorFormProps> =
  createComponent((props) => {
    const [{ handleCreateSubmit }] = useSpaceCreator()
    return createElement('form', { ...props, onSubmit: handleCreateSubmit })
  })

export type SpaceCreatorNameInputOptions<T extends As = 'input'> = Options<T>
export type SpaceCreatorNameInputProps<T extends As = 'input'> = Props<
  SpaceCreatorNameInputOptions<T>
>

/**
 * Name input component for the headless SpaceCreator.
 *
 * A `input` designed to work with `SpaceCreator.Form`. Any passed props will
 * be passed along to the `input` component.
 */
export const SpaceCreatorNameInput: Component<SpaceCreatorNameInputProps> =
  createComponent((props) => {
    const [{ name }, { setName }] = useSpaceCreator()
    const onChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        setName(e.target.value)
      },
      [setName]
    )
    return createElement('input', {
      ...props,
      type: 'text',
      value: name,
      onChange,
      required: true,
    })
  })

export type SpaceCreatorAccessTypeSelectOptions<T extends As = 'select'> = Options<T>
export type SpaceCreatorAccessTypeSelectProps<T extends As = 'select'> = Props<
  SpaceCreatorAccessTypeSelectOptions<T>
>

/**
 * Access type select component for the headless SpaceCreator.
 *
 * A `select` designed to work with `SpaceCreator.Form`. Any passed props will
 * be passed along to the `select` component.
 */
export const SpaceCreatorAccessTypeSelect: Component<SpaceCreatorAccessTypeSelectProps> =
  createComponent((props) => {
    const [{ accessType }, { setAccessType }] = useSpaceCreator()
    const onChange = useCallback(
      (e: ChangeEvent<HTMLSelectElement>) => {
        setAccessType(e.target.value as SpaceAccessType)
      },
      [setAccessType]
    )
    return createElement('select', {
      ...props,
      value: accessType,
      onChange,
      children: (
        <>
          <option value="public">Public</option>
          <option value="private">Private</option>
        </>
      ),
    })
  })

export type SpaceCreatorSubmitButtonOptions<T extends As = 'button'> = Options<T>
export type SpaceCreatorSubmitButtonProps<T extends As = 'button'> = Props<
  SpaceCreatorSubmitButtonOptions<T>
>

/**
 * Submit button component for the headless SpaceCreator.
 *
 * A `button` designed to work with `SpaceCreator.Form`. Any passed props will
 * be passed along to the `button` component.
 */
export const SpaceCreatorSubmitButton: Component<SpaceCreatorSubmitButtonProps> =
  createComponent((props) => {
    const [{ creating }] = useSpaceCreator()
    return createElement('button', {
      ...props,
      type: 'submit',
      disabled: creating,
    })
  })

/**
 * Use the scoped space creator context state from a parent `SpaceCreator`.
 */
export function useSpaceCreator(): SpaceCreatorContextValue {
  return useContext(SpaceCreatorContext)
}

/**
 * Custom hook for space creation logic without UI
 */
export function useCreateSpace() {
  const [{ client, accounts }] = useW3()

  const createSpace = useCallback(
    async (options: SpaceCreationOptions): Promise<Space> => {
      if (!client) {
        throw new Error('Client not initialized')
      }

      const account = accounts[0]
      if (!account) {
        throw new Error('No account found. Please authorize your email first.')
      }

      const { ok: plan } = await account.plan.get()
      if (!plan) {
        throw new Error('A payment plan is required on account to provision a new space.')
      }

      const spaceOptions: any = {
        access: {
          type: options.accessType,
          ...(options.accessType === 'private'
            ? {
                encryption: {
                  provider: 'google-kms',
                  algorithm: 'RSA_DECRYPT_OAEP_3072_SHA256',
                },
              }
            : {}),
        },
      }

      const space = await client.createSpace(options.name, spaceOptions)
      const provisionResult = await account.provision(space.did())
      
      if (provisionResult.error) {
        throw new Error('Failed to provision space', { cause: provisionResult.error })
      }

      await space.save()

      const recovery = await space.createRecovery(account.did())
      await client.capability.access.delegate({
        space: space.did(),
        delegations: [recovery],
      })

      const newSpace = client.spaces().find((s) => s.did() === space.did())
      if (!newSpace) {
        throw new Error('Failed to retrieve created space')
      }

      return newSpace
    },
    [client, accounts]
  )

  return { createSpace }
}

export const SpaceCreator = Object.assign(SpaceCreatorRoot, {
  Form: SpaceCreatorForm,
  NameInput: SpaceCreatorNameInput,
  AccessTypeSelect: SpaceCreatorAccessTypeSelect,
  SubmitButton: SpaceCreatorSubmitButton,
})


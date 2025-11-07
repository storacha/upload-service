import type { As, Component, Props, Options } from 'ariakit-react-utils'
import type { ChangeEvent } from 'react'
import type { Space, Client} from '@storacha/ui-core'


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
import { DID } from '@ucanto/core'

export type ShareToolContextState = ContextState & {
  /**
   * The space being shared
   */
  space?: Space
  /**
   * Email or DID to share with
   */
  recipient: string
  /**
   * Is the sharing in progress?
   */
  sharing: boolean
  /**
   * Has the space been shared?
   */
  shared: boolean
  /**
   * Error message if sharing failed
   */
  error?: string
  /**
   * Success message
   */
  successMessage?: string
  /**
   * Callback to handle share submission
   */
  handleShareSubmit?: (e: React.FormEvent<HTMLFormElement>) => Promise<void>
}

export type ShareToolContextActions = ContextActions & {
  /**
   * Set the recipient email/DID
   */
  setRecipient: React.Dispatch<React.SetStateAction<string>>
  /**
   * Reset the form
   */
  resetForm: () => void
}

export type ShareToolContextValue = [
  state: ShareToolContextState,
  actions: ShareToolContextActions
]

export const ShareToolContextDefaultValue: ShareToolContextValue = [
  {
    accounts: [],
    spaces: [],
    recipient: '',
    sharing: false,
    shared: false,
  },
  {
    setRecipient: () => {
      throw new Error('missing setRecipient function')
    },
    resetForm: () => {
      throw new Error('missing resetForm function')
    },
    logout: () => {
      throw new Error('missing logout function')
    },
  },
]

export const ShareToolContext = createContext<ShareToolContextValue>(
  ShareToolContextDefaultValue
)

/**
 * Helper function to check if a string is a valid DID
 */
function isDID(value: string): boolean {
  try {
    DID.parse(value.trim())
    return true
  } catch {
    return false
  }
}

/**
 * Helper function to check if a string is a valid email address
 */
function isEmail(value: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return !isDID(value) && emailRegex.test(value)
}

/**
 * Share space with email recipient using delegation.
 * The email will be normalized by client.shareSpace internally.
 */
async function shareViaEmail(
  client: Client,
  space: Space,
  email: string
): Promise<void> {
  // client.shareSpace expects EmailAddress type and normalizes internally
  // We pass the string and let the client handle normalization
  await client.shareSpace(email as any, space.did(), {
    abilities: [
      'space/*',
      'store/*',
      'upload/*',
      'access/*',
      'usage/*',
      'filecoin/*',
    ],
    expiration: Infinity,
  })
}

/**
 * Share space with DID recipient by creating a downloadable UCAN delegation
 */
async function shareViaDID(
  client: Client,
  space: Space,
  did: string
): Promise<{ url: string; filename: string }> {
  const audience = DID.parse(did.trim())
  
  // Create delegation with standard capabilities
  const delegation = await client.createDelegation(audience, [
    'space/*',
    'store/*',
    'upload/*',
    'access/*',
    'usage/*',
    'filecoin/*',
  ], {
    expiration: Infinity,
  })

  // Archive the delegation to get downloadable bytes
  const archiveRes = await delegation.archive()
  if (archiveRes.error) {
    throw new Error('Failed to archive delegation', { cause: archiveRes.error })
  }

  // Create a blob URL for download
  const blob = new Blob([archiveRes.ok])
  const url = URL.createObjectURL(blob)
  
  // Generate filename from DID
  const [, method = '', id = ''] = did.split(':')
  const filename = `did-${method}-${id?.substring(0, 10)}.ucan`

  return { url, filename }
}

export type ShareToolRootOptions<T extends As = typeof Fragment> = Options<T> & {
  /**
   * The space to share
   */
  space: Space
  /**
   * Callback when space is successfully shared
   */
  onShared?: (recipient: string) => void
  /**
   * Callback when sharing fails
   */
  onError?: (error: Error) => void
}

export type ShareToolRootProps<T extends As = typeof Fragment> = Props<
  ShareToolRootOptions<T>
>

/**
 * Top level component of the headless ShareTool.
 *
 * Must be used inside a w3ui Provider.
 *
 * Designed to be used by ShareTool.Form, ShareTool.RecipientInput
 * and others to make it easy to implement space sharing UI.
 */
export const ShareToolRoot: Component<ShareToolRootProps> =
  createComponent((props) => {
    const [state, actions] = useW3()
    const { client } = state
    const { space, onShared, onError } = props

    const [recipient, setRecipient] = useState('')
    const [sharing, setSharing] = useState(false)
    const [shared, setShared] = useState(false)
    const [error, setError] = useState<string | undefined>()
    const [successMessage, setSuccessMessage] = useState<string | undefined>()

    const resetForm = useCallback(() => {
      setRecipient('')
      setSharing(false)
      setShared(false)
      setError(undefined)
      setSuccessMessage(undefined)
    }, [])

    const handleShareSubmit = useCallback(
      async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!client || !space) {
          const err = new Error('Client or space not initialized')
          setError(err.message)
          onError?.(err)
          return
        }

        if (!recipient) {
          const err = new Error('Please enter a valid email or DID')
          setError(err.message)
          onError?.(err)
          return
        }

        setSharing(true)
        setError(undefined)
        setSuccessMessage(undefined)

        try {
          // Ensure the space is the current space
          if (client.currentSpace()?.did() !== space.did()) {
            await client.setCurrentSpace(space.did())
          }

          // Determine if recipient is email or DID and handle accordingly
          if (isEmail(recipient)) {
            // Share via email - creates delegation automatically
            await shareViaEmail(client, space, recipient)
            setShared(true)
            setSuccessMessage(`Space successfully shared with ${recipient}`)
            onShared?.(recipient)
          } else if (isDID(recipient)) {
            // Share via DID - creates downloadable UCAN file
            const { url, filename } = await shareViaDID(client, space, recipient)
            
            // Trigger download
            const link = document.createElement('a')
            link.href = url
            link.download = filename
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            
            // Clean up blob URL after a delay
            setTimeout(() => URL.revokeObjectURL(url), 100)
            
            setShared(true)
            setSuccessMessage(`UCAN delegation created for ${recipient}. Download started.`)
            onShared?.(recipient)
          } else {
            throw new Error('Invalid recipient. Please enter a valid email address or DID.')
          }
          
          // Reset after successful share
          setTimeout(() => {
            resetForm()
          }, 3000)
        } catch (err: any) {
          const error = err instanceof Error ? err : new Error('Failed to share space')
          setError(error.message)
          onError?.(error)
          console.error('Failed to share space:', error)
        } finally {
          setSharing(false)
        }
      },
      [client, space, recipient, onShared, onError, resetForm]
    )

    const value = useMemo<ShareToolContextValue>(
      () => [
        {
          ...state,
          space,
          recipient,
          sharing,
          shared,
          error,
          successMessage,
          handleShareSubmit,
        },
        {
          ...actions,
          setRecipient,
          resetForm,
        },
      ],
      [
        state,
        actions,
        space,
        recipient,
        sharing,
        shared,
        error,
        successMessage,
        handleShareSubmit,
        resetForm,
      ]
    )

    return (
      <ShareToolContext.Provider value={value}>
        {createElement(Fragment, props)}
      </ShareToolContext.Provider>
    )
  })

export type ShareToolFormOptions<T extends As = 'form'> = Options<T>
export type ShareToolFormProps<T extends As = 'form'> = Props<
  ShareToolFormOptions<T>
>

/**
 * Form component for the headless ShareTool.
 *
 * A `form` designed to work with `ShareTool`. Any passed props will
 * be passed along to the `form` component.
 */
export const ShareToolForm: Component<ShareToolFormProps> =
  createComponent((props) => {
    const [{ handleShareSubmit }] = useShareTool()
    return createElement('form', { ...props, onSubmit: handleShareSubmit })
  })

export type ShareToolRecipientInputOptions<T extends As = 'input'> = Options<T>
export type ShareToolRecipientInputProps<T extends As = 'input'> = Props<
  ShareToolRecipientInputOptions<T>
>

/**
 * Recipient input component for the headless ShareTool.
 *
 * A `input` designed to work with `ShareTool.Form`. Any passed props will
 * be passed along to the `input` component.
 */
export const ShareToolRecipientInput: Component<ShareToolRecipientInputProps> =
  createComponent((props) => {
    const [{ recipient }, { setRecipient }] = useShareTool()
    const onChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        setRecipient(e.target.value)
      },
      [setRecipient]
    )
    return createElement('input', {
      ...props,
      type: 'text',
      value: recipient,
      onChange,
      placeholder: props.placeholder || 'Email or DID',
      required: true,
    })
  })

export type ShareToolSubmitButtonOptions<T extends As = 'button'> = Options<T>
export type ShareToolSubmitButtonProps<T extends As = 'button'> = Props<
  ShareToolSubmitButtonOptions<T>
>

/**
 * Submit button component for the headless ShareTool.
 *
 * A `button` designed to work with `ShareTool.Form`. Any passed props will
 * be passed along to the `button` component.
 */
export const ShareToolSubmitButton: Component<ShareToolSubmitButtonProps> =
  createComponent((props) => {
    const [{ sharing }] = useShareTool()
    return createElement('button', {
      ...props,
      type: 'submit',
      disabled: sharing,
    })
  })

export type ShareToolErrorOptions<T extends As = 'div'> = Options<T>
export type ShareToolErrorProps<T extends As = 'div'> = Props<
  ShareToolErrorOptions<T>
>

/**
 * Error message component for the headless ShareTool.
 *
 * A `div` that displays error messages.
 */
export const ShareToolError: Component<ShareToolErrorProps> =
  createComponent((props) => {
    const [{ error }] = useShareTool()

    if (!error) {
      return createElement('div', { ...props, style: { display: 'none' } })
    }

    return createElement('div', {
      ...props,
      role: 'alert',
      children: error,
    })
  })

export type ShareToolSuccessOptions<T extends As = 'div'> = Options<T>
export type ShareToolSuccessProps<T extends As = 'div'> = Props<
  ShareToolSuccessOptions<T>
>

/**
 * Success message component for the headless ShareTool.
 *
 * A `div` that displays success messages.
 */
export const ShareToolSuccess: Component<ShareToolSuccessProps> =
  createComponent((props) => {
    const [{ successMessage }] = useShareTool()

    if (!successMessage) {
      return createElement('div', { ...props, style: { display: 'none' } })
    }

    return createElement('div', {
      ...props,
      role: 'status',
      children: successMessage,
    })
  })

/**
 * Use the scoped share tool context state from a parent `ShareTool`.
 */
export function useShareTool(): ShareToolContextValue {
  return useContext(ShareToolContext)
}

/**
 * Custom hook for space sharing logic without UI.
 * 
 * Useful for programmatic sharing outside of the ShareTool component,
 * such as in custom workflows or automated sharing scenarios.
 * 
 * @example
 * ```tsx
 * const { shareSpace } = useShareSpace(space)
 * await shareSpace('user@example.com') // Email sharing
 * await shareSpace('did:key:...') // DID sharing (returns download info)
 * ```
 */
export function useShareSpace(space: Space) {
  const [{ client }] = useW3()

  const shareSpace = useCallback(
    async (
      recipient: string
    ): Promise<void | { url: string; filename: string }> => {
      if (!client || !space) {
        throw new Error('Client or space not initialized')
      }

      if (!recipient) {
        throw new Error('Please enter a valid email or DID')
      }

      // Ensure the space is the current space
      if (client.currentSpace()?.did() !== space.did()) {
        await client.setCurrentSpace(space.did())
      }

      // Handle email sharing
      if (isEmail(recipient)) {
        await shareViaEmail(client, space, recipient)
        return
      }

      // Handle DID sharing
      if (isDID(recipient)) {
        return await shareViaDID(client, space, recipient)
      }

      throw new Error('Invalid recipient. Please enter a valid email address or DID.')
    },
    [client, space]
  )

  return { shareSpace }
}

export const ShareTool = Object.assign(ShareToolRoot, {
  Form: ShareToolForm,
  RecipientInput: ShareToolRecipientInput,
  SubmitButton: ShareToolSubmitButton,
  Error: ShareToolError,
  Success: ShareToolSuccess,
})


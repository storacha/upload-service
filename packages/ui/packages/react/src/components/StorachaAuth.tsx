import type { As, Props, Options } from 'ariakit-react-utils'
import type { ChangeEvent, ReactNode } from 'react'

import React, {
  useState,
  createContext,
  useContext,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from 'react'
import { createElement } from 'ariakit-react-utils'
import { useW3, ContextState, ContextActions } from '../providers/Provider.js'
import { EmailAddress, AppName } from '@storacha/ui-core'

// Types for the enhanced authentication context
export type StorachaAuthContextState = ContextState & {
  /**
   * email to be used to "log in"
   */
  email?: string
  /**
   * has the authentication form been submitted?
   */
  submitted: boolean
  /**
   * A callback that can be passed to an `onSubmit` handler to
   * register a new space or log in using `email`
   */
  handleRegisterSubmit?: (e: React.FormEvent<HTMLFormElement>) => Promise<void>
  /**
   * Whether the user is currently authenticated
   */
  isAuthenticated: boolean
  /**
   * Whether we're in an iframe context
   */
  isIframe: boolean
}

export type StorachaAuthContextActions = ContextActions & {
  /**
   * Set an email to be used to log in or register.
   */
  setEmail: React.Dispatch<React.SetStateAction<string>>
  /**
   * Cancel a pending login.
   */
  cancelLogin: () => void
  /**
   * Track authentication events (for analytics)
   */
  trackAuthEvent: (event: string, properties?: Record<string, any>) => void
}

export type StorachaAuthContextValue = [
  state: StorachaAuthContextState,
  actions: StorachaAuthContextActions
]

export const StorachaAuthContextDefaultValue: StorachaAuthContextValue = [
  {
    accounts: [],
    spaces: [],
    submitted: false,
    isAuthenticated: false,
    isIframe: false,
  },
  {
    setEmail: () => {
      throw new Error('missing set email function')
    },
    cancelLogin: () => {
      throw new Error('missing cancel login function')
    },
    logout: () => {
      throw new Error('missing logout function')
    },
    trackAuthEvent: () => {
      // No-op by default
    },
  },
]

export const StorachaAuthContext = createContext<StorachaAuthContextValue>(
  StorachaAuthContextDefaultValue
)

// Props for the main StorachaAuth component
export interface StorachaAuthProps {
  children?: ReactNode
  appName?: AppName
  /**
   * Whether to enable iframe detection and handling
   */
  enableIframeSupport?: boolean
  /**
   * Custom analytics tracking function
   */
  onAuthEvent?: (event: string, properties?: Record<string, any>) => void
  /**
   * Custom terms of service URL
   */
  termsUrl?: string
  /**
   * Custom service name for branding
   */
  serviceName?: string
}

/**
 * Main StorachaAuth component that provides authentication context
 * and handles the complete authentication flow
 */
export const StorachaAuthProvider = ({ children, ...props }: StorachaAuthProps) => {
  const [state, actions] = useW3()
  const { client } = state
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loginAbortController, setLoginAbortController] = useState<AbortController>()
  const previousAuth = useRef<boolean>(false)

  // Detect iframe context
  const isIframe = useMemo(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.self !== window.top
    } catch {
      return true
    }
  }, [])

  // Track authentication state changes
  const isAuthenticated = !!state.accounts.length
  useEffect(() => {
    if (!previousAuth.current && isAuthenticated) {
      props.onAuthEvent?.('Login Successful')
    }
    previousAuth.current = isAuthenticated
  }, [isAuthenticated, props.onAuthEvent])

  const handleRegisterSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      const controller = new AbortController()
      setLoginAbortController(controller)
      setSubmitted(true)
      
      props.onAuthEvent?.('Login Authorization Requested')
      
      try {
        if (client === undefined) throw new Error('missing client')
        await client.login(email as EmailAddress, {
          signal: controller?.signal,
          appName: props.appName
        })
      } catch (error: any) {
        if (!controller.signal.aborted) {
          console.error('failed to register:', error)
          props.onAuthEvent?.('Login Failed', { error: error.message })
          throw new Error('failed to register', { cause: error })
        }
      } finally {
        setSubmitted(false)
      }
    },
    [client, email, props.appName, props.onAuthEvent]
  )

  const trackAuthEvent = useCallback((event: string, properties?: Record<string, any>) => {
    props.onAuthEvent?.(event, properties)
  }, [props.onAuthEvent])

  const value = useMemo<StorachaAuthContextValue>(
    () => [
      { 
        ...state, 
        email, 
        submitted, 
        handleRegisterSubmit,
        isAuthenticated,
        isIframe
      },
      {
        ...actions,
        setEmail,
        cancelLogin: () => {
          loginAbortController?.abort()
          props.onAuthEvent?.('Login Authorization Cancelled')
        },
        trackAuthEvent,
      },
    ],
    [state, actions, email, submitted, handleRegisterSubmit, isAuthenticated, isIframe, trackAuthEvent]
  )

  return (
    <StorachaAuthContext.Provider value={value}>
      {children}
    </StorachaAuthContext.Provider>
  )
}

// Form component with console-style styling
export type StorachaAuthFormOptions<T extends As = 'form'> = Options<T>
export type StorachaAuthFormProps<T extends As = 'form'> = Props<
  StorachaAuthFormOptions<T>
>

export const StorachaAuthForm = ({ ...formProps }: StorachaAuthFormProps) => {
  const [{ handleRegisterSubmit, submitted }] = useStorachaAuth()

  return (
    <div className='authenticator'>
      <form 
        {...formProps} 
        onSubmit={handleRegisterSubmit}
        className='storacha-auth-form'
      >
        <div className='storacha-auth-logo-container'>
          <img src="/storacha-logo.svg" alt="Storacha" className='storacha-auth-logo' />
        </div>
        <div>
          <label className='storacha-auth-label' htmlFor='storacha-auth-email'>
            Email
          </label>
          <StorachaAuthEmailInput 
            className='storacha-auth-input' 
            id='storacha-auth-email' 
            required 
          />
        </div>
        <div className='storacha-auth-button-container'>
          <button
            className='storacha-auth-button'
            type='submit'
            disabled={submitted}
          >
            Authorize
          </button>
        </div>
      </form>
      <p className='storacha-auth-terms'>
        By registering with storacha.network, you agree to the storacha.network <a href='https://docs.storacha.network/terms/'>Terms of Service</a>.
      </p>
    </div>
  )
}

// Email input component
export type StorachaAuthEmailInputOptions<T extends As = 'input'> = Options<T>
export type StorachaAuthEmailInputProps<T extends As = 'input'> = Props<
  StorachaAuthEmailInputOptions<T>
>

export const StorachaAuthEmailInput = (props: StorachaAuthEmailInputProps) => {
  const [{ email }, { setEmail }] = useStorachaAuth()
  const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
  }, [setEmail])
  
  return createElement('input', {
    ...props,
    type: 'email',
    value: email,
    onChange,
  })
}

// Cancel button component
export type StorachaAuthCancelButtonOptions<T extends As = 'button'> = Options<T>
export type StorachaAuthCancelButtonProps<T extends As = 'button'> = Props<
  StorachaAuthCancelButtonOptions<T>
>

export const StorachaAuthCancelButton = (props: StorachaAuthCancelButtonProps) => {
  const [, { cancelLogin }] = useStorachaAuth()
  return createElement('button', { ...props, onClick: cancelLogin })
}

// Submitted state component
export type StorachaAuthSubmittedOptions<T extends As = 'div'> = Options<T>
export type StorachaAuthSubmittedProps<T extends As = 'div'> = Props<
  StorachaAuthSubmittedOptions<T>
> & {
}

export const StorachaAuthSubmitted = ({ ...divProps }: StorachaAuthSubmittedProps) => {
  const [{ email }] = useStorachaAuth()

  return (
    <div className='authenticator'>
      <div 
        {...divProps}
        className='storacha-auth-submitted-container'
      >
        <div className='storacha-auth-logo-container'>
          <img src="/storacha-logo.svg" alt="Storacha" className='storacha-auth-logo' />
        </div>
        <h1 className='storacha-auth-submitted-title'>Verify your email address!</h1>
        <p className='storacha-auth-submitted-text'>
          Click the link in the email we sent to <span className='storacha-auth-submitted-email'>{email}</span> to authorize this agent.
          <br />
          Don&apos;t forget to check your spam folder!
        </p>
        <StorachaAuthCancelButton className='storacha-auth-button'>
          Cancel
        </StorachaAuthCancelButton>
      </div>
    </div>
  )
}

// Ensurer component that handles the authentication flow
export interface StorachaAuthEnsurerProps {
  children: ReactNode
  /**
   * Custom loader component
   */
  loader?: ReactNode
}

export const StorachaAuthEnsurer = ({ children, loader }: StorachaAuthEnsurerProps) => {
  const [{ submitted, client, isAuthenticated, isIframe }] = useStorachaAuth()

  // Iframe handling - simplified for now
  if (isIframe) {
    return (
      <>
        {isAuthenticated ? (
          <>{children}</>
        ) : (
          loader || <div className="storacha-auth-loader">
            <div className="storacha-auth-spinner-container">
              <div className="storacha-auth-spinner" />
            </div>
            <h3 className="storacha-auth-loader-title">
              Authentication
            </h3>
            <p className="storacha-auth-loader-text">
              Loading...
            </p>
          </div>
        )}
      </>
    )
  }

  // Standard authentication flow
  if (isAuthenticated) {
    return <>{children}</>
  }
  
  if (submitted) {
    return <StorachaAuthSubmitted />
  }
  
  if (client) {
    return <StorachaAuthForm />
  }
  
  return loader || <div className="storacha-auth-loader">
    <div className="storacha-auth-spinner-container">
      <div className="storacha-auth-spinner" />
    </div>
    <h3 className="storacha-auth-loader-title">
      Initializing
    </h3>
    <p className="storacha-auth-loader-text">
      Setting up authentication...
    </p>
  </div>
}

/**
 * Use the scoped StorachaAuth context state from a parent `StorachaAuth`.
 */
export function useStorachaAuth(): StorachaAuthContextValue {
  return useContext(StorachaAuthContext)
}

// Export the complete component suite
export const StorachaAuth = Object.assign(StorachaAuthProvider, {
  Form: StorachaAuthForm,
  EmailInput: StorachaAuthEmailInput,
  CancelButton: StorachaAuthCancelButton,
  Submitted: StorachaAuthSubmitted,
  Ensurer: StorachaAuthEnsurer,
})

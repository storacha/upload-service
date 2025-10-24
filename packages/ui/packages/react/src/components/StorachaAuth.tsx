import type { As, Props, Options } from 'ariakit-react-utils'
import type { ChangeEvent, ReactNode, CSSProperties } from 'react'

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
   * Email for login
   */
  email?: string
  /**
   * has the authentication form been submitted?
   */
  submitted: boolean
  /**
   * Form submit handler
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
        trackAuthEvent: (event: string, properties?: Record<string, any>) => {
          props.onAuthEvent?.(event, properties)
        },
      },
    ],
    [state, actions, email, submitted, handleRegisterSubmit, isAuthenticated, isIframe, props.onAuthEvent]
  )

  return (
    <StorachaAuthContext.Provider value={value}>
      {children}
    </StorachaAuthContext.Provider>
  )
}

// Headless form component
export type StorachaAuthFormOptions<T extends As = 'form'> = Options<T> & {
  /**
   * Additional CSS class names
   */
  className?: string
  /**
   * Inline styles
   */
  style?: CSSProperties
  /**
   * Render prop for the form container wrapper
   */
  renderContainer?: (children: ReactNode) => ReactNode
  /**
   * Render prop for the logo
   */
  renderLogo?: () => ReactNode
  /**
   * Render prop for the email label
   */
  renderEmailLabel?: () => ReactNode
  /**
   * Render prop for the submit button
   */
  renderSubmitButton?: (disabled: boolean) => ReactNode
  /**
   * Render prop for terms text
   */
  renderTerms?: () => ReactNode
}

export type StorachaAuthFormProps<T extends As = 'form'> = Props<
  StorachaAuthFormOptions<T>
>

export const StorachaAuthForm = ({ 
  className,
  style,
  renderContainer,
  renderLogo,
  renderEmailLabel,
  renderSubmitButton,
  renderTerms,
  ...formProps 
}: StorachaAuthFormProps) => {
  const [{ handleRegisterSubmit, submitted }] = useStorachaAuth()

  const formContent = (
    <form 
      {...formProps} 
      onSubmit={handleRegisterSubmit}
      className={className}
      style={style}
    >
      {renderLogo?.()}
      <div>
        {renderEmailLabel?.()}
        <StorachaAuthEmailInput 
          id='storacha-auth-email' 
          required 
        />
      </div>
      <div>
        {renderSubmitButton?.(submitted)}
      </div>
    </form>
  )

  const content = (
    <>
      {renderContainer ? renderContainer(formContent) : formContent}
      {renderTerms?.()}
    </>
  )

  return content
}

// Headless email input component
export type StorachaAuthEmailInputOptions<T extends As = 'input'> = Options<T> & {
  /**
   * Additional CSS class names
   */
  className?: string
  /**
   * Inline styles
   */
  style?: CSSProperties
}

export type StorachaAuthEmailInputProps<T extends As = 'input'> = Props<
  StorachaAuthEmailInputOptions<T>
>

export const StorachaAuthEmailInput = ({ className, style, ...props }: StorachaAuthEmailInputProps) => {
  const [{ email }, { setEmail }] = useStorachaAuth()
  const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
  }, [setEmail])
  
  return createElement('input', {
    ...props,
    type: 'email',
    value: email,
    onChange,
    className,
    style,
  })
}

// Headless cancel button component
export type StorachaAuthCancelButtonOptions<T extends As = 'button'> = Options<T> & {
  /**
   * Additional CSS class names
   */
  className?: string
  /**
   * Inline styles
   */
  style?: CSSProperties
}

export type StorachaAuthCancelButtonProps<T extends As = 'button'> = Props<
  StorachaAuthCancelButtonOptions<T>
>

export const StorachaAuthCancelButton = ({ className, style, ...props }: StorachaAuthCancelButtonProps) => {
  const [, { cancelLogin }] = useStorachaAuth()
  return createElement('button', { ...props, onClick: cancelLogin, className, style })
}

// Headless submitted state component
export type StorachaAuthSubmittedOptions<T extends As = 'div'> = Options<T> & {
  /**
   * Additional CSS class names
   */
  className?: string
  /**
   * Inline styles
   */
  style?: CSSProperties
  /**
   * Render prop for the container wrapper
   */
  renderContainer?: (children: ReactNode) => ReactNode
  /**
   * Render prop for the logo
   */
  renderLogo?: () => ReactNode
  /**
   * Render prop for the title
   */
  renderTitle?: () => ReactNode
  /**
   * Render prop for the message
   */
  renderMessage?: (email: string) => ReactNode
  /**
   * Render prop for the cancel button
   */
  renderCancelButton?: () => ReactNode
}

export type StorachaAuthSubmittedProps<T extends As = 'div'> = Props<
  StorachaAuthSubmittedOptions<T>
>

export const StorachaAuthSubmitted = ({ 
  className,
  style,
  renderContainer,
  renderLogo,
  renderTitle,
  renderMessage,
  renderCancelButton,
  ...divProps 
}: StorachaAuthSubmittedProps) => {
  const [{ email }] = useStorachaAuth()

  const content = (
    <div 
      {...divProps}
      className={className}
      style={style}
    >
      {renderLogo?.()}
      {renderTitle?.()}
      {renderMessage?.(email || '')}
      {renderCancelButton?.()}
    </div>
  )

  return renderContainer ? renderContainer(content) : content
}

// Headless ensurer component that handles the authentication flow
export interface StorachaAuthEnsurerProps {
  children: ReactNode
  /**
   * Custom loader component
   */
  loader?: ReactNode
  /**
   * Render prop for custom loader
   */
  renderLoader?: (type: 'initializing' | 'authenticating') => ReactNode
  /**
   * Render prop for custom form
   */
  renderForm?: () => ReactNode
  /**
   * Render prop for custom submitted state
   */
  renderSubmitted?: () => ReactNode
}

export const StorachaAuthEnsurer = ({ 
  children, 
  loader,
  renderLoader,
  renderForm,
  renderSubmitted
}: StorachaAuthEnsurerProps) => {
  const [{ submitted, client, isAuthenticated, isIframe }] = useStorachaAuth()

  // Iframe handling
  if (isIframe) {
    return (
      <>
        {isAuthenticated ? (
          <>{children}</>
        ) : (
          loader || renderLoader?.('authenticating') || <div>Loading...</div>
        )}
      </>
    )
  }

  // Standard authentication flow
  if (isAuthenticated) {
    return <>{children}</>
  }
  
  if (submitted) {
    return renderSubmitted ? <>{renderSubmitted()}</> : <StorachaAuthSubmitted />
  }
  
  if (client) {
    return renderForm ? <>{renderForm()}</> : <StorachaAuthForm />
  }
  
  return loader || renderLoader?.('initializing') || <div>Initializing...</div>
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

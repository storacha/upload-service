import type { Props, Options } from 'ariakit-react-utils'
import type { ReactNode, FormEvent, JSX } from 'react'

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef
} from 'react'
import { 
  AuthenticatorRoot,
  AuthenticatorForm,
  AuthenticatorEmailInput,
  AuthenticatorCancelButton,
  useAuthenticator,
  AuthenticatorContextValue
} from './Authenticator.js'
import { AppName } from '@storacha/ui-core'


export interface AnalyticsTracker {
  track: (event: string, properties?: Record<string, any>) => void
}

export interface EnhancedAuthenticatorContextState {
  analytics?: AnalyticsTracker
  onAuthenticationStart?: () => void
  onAuthenticationSuccess?: (email: string) => void
  onAuthenticationCancel?: () => void
  onAuthenticationError?: (error: Error) => void
}

export type EnhancedAuthenticatorContextValue = [
  state: EnhancedAuthenticatorContextState,
  baseContext: AuthenticatorContextValue
]

const EnhancedAuthenticatorContext = createContext<EnhancedAuthenticatorContextValue | null>(null)

export function useEnhancedAuthenticator(): EnhancedAuthenticatorContextValue {
  const context = useContext(EnhancedAuthenticatorContext)
  if (!context) {
    throw new Error('useEnhancedAuthenticator must be used within EnhancedAuthenticatorRoot')
  }
  return context
}

export interface EnhancedAuthenticatorRootProps {
  children: ReactNode
  appName?: AppName
  analytics?: AnalyticsTracker
  onAuthenticationStart?: () => void
  onAuthenticationSuccess?: (email: string) => void
  onAuthenticationCancel?: () => void
  onAuthenticationError?: (error: Error) => void

  brandingComponent?: ReactNode

  termsComponent?: ReactNode

  trackAuthChanges?: boolean
}


export function EnhancedAuthenticatorRoot({
  children,
  appName,
  analytics,
  onAuthenticationStart,
  onAuthenticationSuccess,
  onAuthenticationCancel,
  onAuthenticationError,
  brandingComponent,
  termsComponent,
  trackAuthChanges = true
}: EnhancedAuthenticatorRootProps): JSX.Element {
  const baseAuthContext = useAuthenticator()
  const [{ accounts }] = baseAuthContext
  const authenticated = !!accounts.length
  const previousAuth = useRef<boolean>(authenticated)

  useEffect(() => {
    if (trackAuthChanges && analytics) {
      if (!previousAuth.current && authenticated) {
        analytics.track('Login Successful')
        if (onAuthenticationSuccess && accounts[0]) {
          const email = accounts[0].toEmail?.() || ''
          onAuthenticationSuccess(email)
        }
      }
      previousAuth.current = authenticated
    }
  }, [authenticated, analytics, trackAuthChanges, onAuthenticationSuccess, accounts])

  const enhancedState: EnhancedAuthenticatorContextState = {
    analytics,
    onAuthenticationStart,
    onAuthenticationSuccess,
    onAuthenticationCancel,
    onAuthenticationError
  }

  const value: EnhancedAuthenticatorContextValue = [enhancedState, baseAuthContext]

  return (
    <AuthenticatorRoot appName={appName}>
      <EnhancedAuthenticatorContext.Provider value={value}>
        {children}
      </EnhancedAuthenticatorContext.Provider>
    </AuthenticatorRoot>
  )
}

export interface EnhancedAuthenticatorFormProps extends Props<Options<'form'>> {
  brandingComponent?: ReactNode
  submitButtonText?: string
  submitButtonClassName?: string
  emailLabelText?: string
  emailInputClassName?: string
}

export function EnhancedAuthenticatorForm({
  brandingComponent,
  submitButtonText = 'Authorize',
  submitButtonClassName,
  emailLabelText = 'Email',
  emailInputClassName,
  className,
  onSubmit,
  ...props
}: EnhancedAuthenticatorFormProps): JSX.Element {
  const [enhancedState, [{ submitted, handleRegisterSubmit }]] = useEnhancedAuthenticator()
  const { analytics, onAuthenticationStart } = enhancedState

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      
      if (analytics) {
        analytics.track('Login Authorization Requested')
      }
      
      if (onAuthenticationStart) {
        onAuthenticationStart()
      }
      
      if (onSubmit) {
        onSubmit(e)
      }
      
      if (handleRegisterSubmit) {
        await handleRegisterSubmit(e)
      }
    },
    [analytics, onAuthenticationStart, onSubmit, handleRegisterSubmit]
  )

  return (
    <AuthenticatorForm className={className} onSubmit={handleSubmit} {...props}>
      {brandingComponent && <div>{brandingComponent}</div>}
      <div>
        <label htmlFor='authenticator-email'>{emailLabelText}</label>
        <AuthenticatorEmailInput 
          className={emailInputClassName}
          id='authenticator-email' 
          required 
        />
      </div>
      <div>
        <button
          className={submitButtonClassName}
          type='submit'
          disabled={submitted}
        >
          {submitButtonText}
        </button>
      </div>
    </AuthenticatorForm>
  )
}

export interface EnhancedAuthenticatorCancelButtonProps extends Props<Options<'button'>> {
  buttonText?: string
}

export function EnhancedAuthenticatorCancelButton({
  buttonText = 'Cancel',
  onClick,
  ...props
}: EnhancedAuthenticatorCancelButtonProps): JSX.Element {
  const [enhancedState, [, { cancelLogin }]] = useEnhancedAuthenticator()
  const { analytics, onAuthenticationCancel } = enhancedState

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (analytics) {
        analytics.track('Login Authorization Cancelled')
      }
      
      if (onAuthenticationCancel) {
        onAuthenticationCancel()
      }
      
      if (onClick) {
        onClick(e)
      }
      
      cancelLogin()
    },
    [analytics, onAuthenticationCancel, onClick, cancelLogin]
  )

  return (
    <AuthenticatorCancelButton onClick={handleClick} {...props}>
      {buttonText}
    </AuthenticatorCancelButton>
  )
}


export interface AuthenticationGuardProps {
  children: ReactNode
  loadingComponent?: ReactNode
  unauthenticatedComponent?: ReactNode
  submittedComponent?: ReactNode
}

export function AuthenticationGuard({
  children,
  loadingComponent,
  unauthenticatedComponent,
  submittedComponent
}: AuthenticationGuardProps): JSX.Element {
  const [{ accounts, client, submitted }] = useAuthenticator()
  const authenticated = !!accounts.length

  if (!client) {
    return <>{loadingComponent || <div>Loading...</div>}</>
  }

  if (authenticated) {
    return <>{children}</>
  }

  if (submitted) {
    return <>{submittedComponent || <div>Check your email for verification</div>}</>
  }

  return <>{unauthenticatedComponent || <div>Please log in</div>}</>
}

export interface UsePostSubmissionOptions {
  onSubmitted?: () => void
  trackReferral?: boolean
}

export function usePostSubmission(options: UsePostSubmissionOptions = {}) {
  const [{ submitted }] = useAuthenticator()
  const hasTracked = useRef(false)

  useEffect(() => {
    if (submitted && !hasTracked.current) {
      if (options.onSubmitted) {
        options.onSubmitted()
      }
      hasTracked.current = true
    } else if (!submitted) {
      hasTracked.current = false
    }
  }, [submitted, options])
}

export const EnhancedAuthenticator = {
  Root: EnhancedAuthenticatorRoot,
  Form: EnhancedAuthenticatorForm,
  CancelButton: EnhancedAuthenticatorCancelButton,
  Guard: AuthenticationGuard,
  usePostSubmission,
  useEnhancedAuthenticator
}

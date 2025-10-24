import React, { ReactNode } from 'react'
import {
  StorachaAuth as HeadlessStorachaAuth,
  StorachaAuthProps as HeadlessStorachaAuthProps,
} from '@storacha/ui-react'

/**
 * Styled StorachaAuth component - wraps headless components with console-exact UI
 */
export interface StorachaAuthProps extends HeadlessStorachaAuthProps {}

export const StorachaAuthProvider = (props: StorachaAuthProps) => {
  return <HeadlessStorachaAuth {...props} />
}

/**
 * Styled form component with console-exact design
 */
export const StorachaAuthForm = () => {
  return (
    <div className='authenticator'>
      <HeadlessStorachaAuth.Form className='storacha-auth-form'>
        <div className='storacha-auth-logo-container'>
          <img src="/storacha-logo.svg" alt="Storacha" className='storacha-auth-logo' />
        </div>
        <div>
          <label className='storacha-auth-label' htmlFor='storacha-auth-email'>
            Email
          </label>
          <HeadlessStorachaAuth.EmailInput
            className='storacha-auth-input'
            id='storacha-auth-email'
            required
          />
        </div>
        <div className='storacha-auth-button-container'>
          <button
            className='storacha-auth-button'
            type='submit'
          >
            Authorize
          </button>
        </div>
      </HeadlessStorachaAuth.Form>
      <p className='storacha-auth-terms'>
        By registering with storacha.network, you agree to the storacha.network{' '}
        <a href='https://docs.storacha.network/terms/'>Terms of Service</a>.
      </p>
    </div>
  )
}

/**
 * Styled email input with console-exact design
 */
export const StorachaAuthEmailInput = () => {
  return (
    <HeadlessStorachaAuth.EmailInput
      className='storacha-auth-input'
      id='storacha-auth-email'
    />
  )
}

/**
 * Styled cancel button with console-exact design
 */
export const StorachaAuthCancelButton = () => {
  return (
    <HeadlessStorachaAuth.CancelButton className='storacha-auth-button'>
      Cancel
    </HeadlessStorachaAuth.CancelButton>
  )
}

/**
 * Styled submitted state with console-exact design
 */
export const StorachaAuthSubmitted = () => {
  return (
    <HeadlessStorachaAuth.Submitted
      renderContainer={(children) => (
        <div className='authenticator'>
          {children}
        </div>
      )}
      renderLogo={() => (
        <div className='storacha-auth-logo-container'>
          <img src="/storacha-logo.svg" alt="Storacha" className='storacha-auth-logo' />
        </div>
      )}
      renderTitle={() => (
        <h1 className='storacha-auth-submitted-title'>Verify your email address!</h1>
      )}
      renderMessage={(email) => (
        <p className='storacha-auth-submitted-text'>
          Click the link in the email we sent to{' '}
          <span className='storacha-auth-submitted-email'>{email}</span> to authorize this agent.
          <br />
          Don&apos;t forget to check your spam folder!
        </p>
      )}
      renderCancelButton={() => <StorachaAuthCancelButton />}
      className='storacha-auth-submitted-container'
    />
  )
}

/**
 * Styled ensurer with console-exact loading states
 */
export const StorachaAuthEnsurer = ({ children }: { children: ReactNode }) => {
  return (
    <HeadlessStorachaAuth.Ensurer
      renderLoader={(type) => (
        <div className="storacha-auth-loader">
          <div className="storacha-auth-spinner" />
          <h3 className="storacha-auth-loader-title">
            {type === 'initializing' ? 'Initializing' : 'Authentication'}
          </h3>
          <p className="storacha-auth-loader-text">
            {type === 'initializing' ? 'Setting up authentication...' : 'Loading...'}
          </p>
        </div>
      )}
      renderForm={() => <StorachaAuthForm />}
      renderSubmitted={() => <StorachaAuthSubmitted />}
    >
      {children}
    </HeadlessStorachaAuth.Ensurer>
  )
}

/**
 * Complete styled StorachaAuth component suite with console-exact UI
 */
export const StorachaAuth = Object.assign(StorachaAuthProvider, {
  Form: StorachaAuthForm,
  EmailInput: StorachaAuthEmailInput,
  CancelButton: StorachaAuthCancelButton,
  Submitted: StorachaAuthSubmitted,
  Ensurer: StorachaAuthEnsurer,
})

// Re-export the hook
export { useStorachaAuth } from '@storacha/ui-react'


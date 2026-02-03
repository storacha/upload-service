'use client'
import { useEffect, useRef, type JSX, type ReactNode } from 'react'
import {
  useAuthenticator,
  AuthenticatorRoot,
  AuthenticatorForm,
  AuthenticatorEmailInput,
  AuthenticatorCancelButton,
  AppName
} from '@storacha/ui-react'
import { Logo } from '../brand'
import { TopLevelLoader } from './Loader'
import { useIframe } from '@/contexts/IframeContext'
import { useRecordRefcode } from '@/lib/referrals/hooks'
import { usePlausible } from 'next-plausible'


export function EnhancedAuthenticatorRoot({ children }: { children: ReactNode }): JSX.Element {
  return (
    <AuthenticatorRoot appName={AppName.Console}>
      {children}
    </AuthenticatorRoot>
  )
}

export function AuthenticationForm(): JSX.Element {
  const plausible = usePlausible()
  const [{ submitted }] = useAuthenticator()
  
  const handleSubmitClick = () => {
    plausible('Login Authorization Requested')
  }

  return (
    <div className='authenticator'>
      <AuthenticatorForm 
        className='text-hot-red bg-white border border-hot-red rounded-2xl shadow-md px-10 pt-8 pb-8'
        onSubmit={(e) => {
          handleSubmitClick()
        }}
      >
        <div className='flex flex-row gap-4 mb-8 justify-center'>
          <Logo className='w-36' />
        </div>
        <div>
          <label 
            className='block mb-2 uppercase text-xs font-epilogue m-1' 
            htmlFor='authenticator-email'
          >
            Email
          </label>
          <AuthenticatorEmailInput 
            className='text-black py-2 px-2 rounded-xl block mb-4 border border-hot-red w-80' 
            id='authenticator-email' 
            required 
          />
        </div>
        <div className='text-center mt-4'>
          <button
            className='inline-block bg-hot-red border border-hot-red hover:bg-white hover:text-hot-red font-epilogue text-white uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap'
            type='submit'
            disabled={submitted}
          >
            Authorize
          </button>
        </div>
      </AuthenticatorForm>
      <p className='text-xs text-black/80 italic max-w-xs text-center mt-6'>
        By registering with storacha.network, you agree to the storacha.network{' '}
        <a className='underline' href='https://docs.storacha.network/terms/'>
          Terms of Service
        </a>
        .
      </p>
    </div>
  )
}


export function AuthenticationSubmitted(): JSX.Element {
  const plausible = usePlausible()
  const [{ email }] = useAuthenticator()

  useRecordRefcode()

  const handleCancelClick = () => {
    plausible('Login Authorization Cancelled')
  }

  return (
    <div className='authenticator'>
      <div className='text-hot-red bg-white border border-hot-red rounded-2xl shadow-md px-10 pt-8 pb-8'>
        <div className='flex flex-row gap-4 mb-8 justify-center'>
          <Logo className='w-36' />
        </div>
        <h1 className='text-xl font-epilogue'>Verify your email address!</h1>
        <p className='pt-2 pb-4'>
          Click the link in the email we sent to{' '}
          <span className='font-semibold tracking-wide'>{email}</span> to authorize this agent.
          <br />
          Don&apos;t forget to check your spam folder!
        </p>
        <AuthenticatorCancelButton 
          className='inline-block bg-hot-red border border-hot-red hover:bg-white hover:text-hot-red font-epilogue text-white uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap'
          onClick={handleCancelClick}
        >
          Cancel
        </AuthenticatorCancelButton>
      </div>
    </div>
  )
}


export function AuthenticationEnsurer({
  children
}: {
  children: JSX.Element | JSX.Element[]
}): JSX.Element {
  const [{ submitted, accounts, client }] = useAuthenticator()
  const plausible = usePlausible()
  const { isIframe } = useIframe()

  const authenticated = !!accounts.length
  const previousAuth = useRef<boolean>(authenticated)

  useEffect(() => {
    console.debug('auth changed:', {
      was: previousAuth.current,
      now: authenticated
    })
    if (!previousAuth.current && authenticated) {
      plausible('Login Successful')
    }
    previousAuth.current = authenticated
  }, [authenticated, plausible])

  if (isIframe) {
    return (
      <>
        {authenticated ? (
          <>{children}</>
        ) : (
          <TopLevelLoader />
        )}
      </>
    )
  }

  if (authenticated) {
    return <>{children}</>
  }
  if (submitted) {
    return <AuthenticationSubmitted />
  }
  if (client) {
    return <AuthenticationForm />
  }
  return <TopLevelLoader />
}

export const Authenticator = Object.assign(EnhancedAuthenticatorRoot, {
  Form: AuthenticationForm,
  Submitted: AuthenticationSubmitted,
  Ensurer: AuthenticationEnsurer
})

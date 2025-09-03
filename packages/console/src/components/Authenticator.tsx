'use client'

import {
  Authenticator as AuthCore,
  useAuthenticator
} from '@storacha/ui-react'
import { Logo } from '../brand'
import { TopLevelLoader } from './Loader'
import { useIframe } from '@/contexts/IframeContext'
import IframeAuthenticator from './IframeAuthenticator'

import { useRecordRefcode } from '@/lib/referrals/hooks'

export function AuthenticationForm (): JSX.Element {
  const [{ submitted }] = useAuthenticator()
  return (
    <div className='min-h-screen bg-professional-branded flex items-center justify-center p-4'>
      <div className='w-full max-w-md'>
        <AuthCore.Form className='text-hot-red bg-white border border-hot-red rounded-2xl shadow-lg px-8 md:px-10 pt-8 pb-8'>
          <div className='flex flex-row gap-4 mb-8 justify-center'>
            <Logo className='w-32 md:w-36' />
          </div>
          <div className='mb-6'>
            <h1 className='text-xl md:text-2xl font-bold text-center mb-2'>Welcome to Storacha</h1>
            <p className='text-sm text-gray-600 text-center'>Enter your email to get started</p>
          </div>
          <div>
            <label className='block mb-2 uppercase text-xs font-epilogue font-semibold text-hot-red' htmlFor='authenticator-email'>Email Address</label>
            <AuthCore.EmailInput className='text-black py-3 px-4 rounded-xl block mb-6 border border-hot-red w-full focus:ring-2 focus:ring-hot-red focus:border-hot-red outline-none transition-all' id='authenticator-email' required placeholder='your@email.com' />
          </div>
          <div className='text-center'>
            <button
              className='inline-block bg-white border border-hot-red hover:bg-hot-red hover:text-white font-epilogue text-hot-red uppercase text-sm px-8 py-3 rounded-lg whitespace-nowrap w-full transition-all duration-200 font-semibold'
              type='submit'
              disabled={submitted}
            >
            Authorize
            </button>
          </div>
        </AuthCore.Form>
        <p className='text-xs text-white/80 italic max-w-sm text-center mt-6 mx-auto leading-relaxed'>
          By registering with storacha.network, you agree to the storacha.network <a className='underline hover:text-white transition-colors' href='https://docs.storacha.network/terms/'>Terms of Service</a>.
        </p>
      </div>
    </div>
  )
}

export function AuthenticationSubmitted (): JSX.Element {
  const [{ email }] = useAuthenticator()

  // ensure the referral of this user is tracked if necessary.
  // we might use the result of this hook in the future to tell
  // people that they get special pricing on the next page after
  // they verify their email.
  useRecordRefcode()

  return (
    <div className='min-h-screen bg-professional-branded flex items-center justify-center p-4'>
      <div className='w-full max-w-md'>
        <div className='text-hot-red bg-white border border-hot-red rounded-2xl shadow-lg px-8 md:px-10 pt-8 pb-8'>
          <div className='flex flex-row gap-4 mb-8 justify-center'>
            <Logo className='w-32 md:w-36' />
          </div>
          <div className='text-center mb-6'>
            <h1 className='text-xl md:text-2xl font-bold mb-2'>Check Your Email</h1>
            <div className='w-16 h-16 mx-auto mb-4 bg-hot-red/10 rounded-full flex items-center justify-center'>
              <svg className='w-8 h-8 text-hot-red' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' />
              </svg>
            </div>
          </div>
          <p className='text-center text-gray-600 mb-2'>
            We've sent a verification link to:
          </p>
          <p className='text-center font-semibold text-hot-red mb-6 break-all'>
            {email}
          </p>
          <p className='text-center text-sm text-gray-500 mb-8'>
            Click the link in the email to complete your authentication and access your Storacha console.
          </p>
          <div className='text-center'>
            <AuthCore.CancelButton className='inline-block bg-white border border-hot-red hover:bg-hot-red hover:text-white font-epilogue text-hot-red uppercase text-sm px-8 py-3 rounded-lg whitespace-nowrap transition-all duration-200 font-semibold'>
              Use Different Email
            </AuthCore.CancelButton>
          </div>
        </div>
        <p className='text-xs text-white/60 text-center mt-6'>
          Didn't receive the email? Check your spam folder or try again.
        </p>
      </div>
    </div>
  )
}

export function AuthenticationEnsurer ({
  children
}: {
  children: JSX.Element | JSX.Element[]
}): JSX.Element {
  const [{ submitted, accounts, client }] = useAuthenticator()
  const { isIframe } = useIframe()
  
  const authenticated = !!accounts.length
  
  // If in iframe, use iframe-specific SSO authentication flow
  if (isIframe) {
    return (
      <IframeAuthenticator>
        {/* Standard authentication ensurer for iframe context */}
        {authenticated ? (
          <>{children}</>
        ) : (
          <div /> // IframeAuthenticator will handle the UI
        )}
      </IframeAuthenticator>
    )
  }
  
  // Standard authentication flow for non-iframe context
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



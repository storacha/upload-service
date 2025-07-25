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
    <div className='authenticator'>
      <AuthCore.Form className='text-hot-red bg-white border border-hot-red rounded-2xl shadow-md px-10 pt-8 pb-8'>
        <div className='flex flex-row gap-4 mb-8 justify-center'>
          <Logo className='w-36' />
        </div>
        <div>
          <label className='block mb-2 uppercase text-xs font-epilogue m-1' htmlFor='authenticator-email'>Email</label>
          <AuthCore.EmailInput className='text-black py-2 px-2 rounded-xl block mb-4 border border-hot-red w-80' id='authenticator-email' required />
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
      </AuthCore.Form>
      <p className='text-xs text-black/80 italic max-w-xs text-center mt-6'>
        By registering with storacha.network, you agree to the storacha.network <a className='underline' href='https://docs.storacha.network/terms/'>Terms of Service</a>.
      </p>
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
    <div className='authenticator'>
      <div className='text-hot-red bg-white border border-hot-red rounded-2xl shadow-md px-10 pt-8 pb-8'>
        <div className='flex flex-row gap-4 mb-8 justify-center'>
          <Logo className='w-36' />
        </div>
        <h1 className='text-xl font-epilogue'>Verify your email address!</h1>
        <p className='pt-2 pb-4'>
          Click the link in the email we sent to <span className='font-semibold tracking-wide'>{email}</span> to authorize this agent.
        </p>
        <AuthCore.CancelButton className='inline-block bg-hot-red border border-hot-red hover:bg-white hover:text-hot-red font-epilogue text-white uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap' >
          Cancel
        </AuthCore.CancelButton>
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



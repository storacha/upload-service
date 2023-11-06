'use client'

import {
  Authenticator as AuthCore,
  useAuthenticator
} from '@w3ui/react-keyring'
import { serviceName, tosUrl, Logo } from '../brand'
import Loader from './Loader'

export function AuthenticationForm (): JSX.Element {
  const [{ submitted }] = useAuthenticator()
  return (
    <div className='authenticator'>
      <AuthCore.Form className='text-zinc-950 bg-grad rounded-xl shadow-md px-10 pt-8 pb-8'>
        <div className='flex flex-row gap-4 mb-8 flex justify-center gap-4'>
          <Logo className='w-36' />
        </div>
        <div>
          <label className='block mb-2 uppercase text-xs font-semibold tracking-wider m-1 font-mono' htmlFor='authenticator-email'>Email</label>
          <AuthCore.EmailInput className='text-black py-2 px-2 rounded block mb-4 border border-gray-800 w-80 shadow-md' id='authenticator-email' required />
        </div>
        <div className='text-center mt-4'>
          <button
            className='inline-block bg-zinc-950 hover:outline text-white font-bold text-sm px-6 py-2 rounded-full whitespace-nowrap'
            type='submit'
            disabled={submitted}
          >
            Authorize
          </button>
        </div>
      </AuthCore.Form>
      <p className='text-xs text-white/80 italic max-w-xs text-left mt-6'>
        By registering with {serviceName} w3up beta, you agree to the <a className='underline' href={tosUrl}>Terms of Service</a>.
        If you have an existing non-w3up beta account with {serviceName} and register for
        the w3up beta version of {serviceName} using the same email, then at the end of the
        beta period, these accounts will be combined. Until the beta period is over and this
        migration occurs, uploads to w3up will not appear in your {serviceName} account
        (and vice versa), even if you register with the same email.
      </p>
    </div >
  )
}

export function AuthenticationSubmitted (): JSX.Element {
  const [{ email }] = useAuthenticator()

  return (
    <div className='authenticator'>
      <div className='text-zinc-950 bg-grad rounded-xl shadow-md px-10 pt-8 pb-8'>
        <div className='flex flex-row gap-4 mb-8 justify-center'>
          <Logo className='w-36' />
        </div>
        <h1 className='text-xl font-semibold'>Verify your email address!</h1>
        <p className='pt-2 pb-4'>
          Click the link in the email we sent to <span className='font-semibold tracking-wide'>{email}</span> to authorize this agent.
        </p>
        <AuthCore.CancelButton className='inline-block bg-zinc-950 hover:outline text-white font-bold text-sm px-6 py-2 rounded-full whitespace-nowrap' >
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
  const [{ submitted, account, agent }] = useAuthenticator()
  const authenticated = !!account
  if (authenticated) {
    return <>{children}</>
  }
  if (submitted) {
    return <AuthenticationSubmitted />
  }
  if (agent) {
    return <AuthenticationForm />
  }
  return <Loader className='w-12 h-12 w-full mt-12' />
}



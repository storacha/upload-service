'use client'

import {
  Authenticator as AuthCore,
  useAuthenticator
} from '@storacha/ui-react'
import { Logo } from '../brand'
import { TopLevelLoader } from './Loader'
import { useRecordRefcode } from '@/lib/referrals/hooks'
import { useState, useEffect, useCallback } from 'react'
import { logAndCaptureError } from '@/sentry'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function AuthenticationForm (): JSX.Element {
  const [{ submitted }] = useAuthenticator()
  const [error, setError] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isMounted, setIsMounted] = useState(true)

  useEffect(() => {
    return () => {
      setIsMounted(false)
    }
  }, [])

  const validateEmail = useCallback((email: string): boolean => {
    return EMAIL_REGEX.test(email)
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!isMounted) return

    setError(null)
    setIsValidating(true)

    try {
      const formData = new FormData(e.currentTarget)
      const email = formData.get('email') as string

      if (!email || !validateEmail(email)) {
        throw new Error('Please enter a valid email address')
      }

      // Submit form
      await e.currentTarget.submit()
    } catch (err) {
      if (!isMounted) return
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(errorMessage)
      logAndCaptureError(err)
    } finally {
      if (isMounted) {
        setIsValidating(false)
      }
    }
  }, [isMounted, validateEmail])

  return (
    <div className='authenticator'>
      <AuthCore.Form onSubmit={handleSubmit} className='text-hot-red bg-white border border-hot-red rounded-2xl shadow-md px-10 pt-8 pb-8'>
        <div className='flex flex-row gap-4 mb-8 justify-center'>
          <Logo className='w-36' />
        </div>
        <div>
          <label className='block mb-2 uppercase text-xs font-epilogue m-1' htmlFor='authenticator-email'>Email</label>
          <AuthCore.EmailInput 
            className='text-black py-2 px-2 rounded-xl block mb-4 border border-hot-red w-80' 
            id='authenticator-email'
            name='email'
            required
            pattern={EMAIL_REGEX.source}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? 'email-error' : undefined}
            disabled={isValidating || submitted}
          />
          {error && (
            <div id="email-error" className="text-red-500 text-sm mb-4" role="alert">
              {error}
            </div>
          )}
        </div>
        <div className='text-center mt-4'>
          <button
            className='inline-block bg-hot-red border border-hot-red hover:bg-white hover:text-hot-red font-epilogue text-white uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap'
            type='submit'
            disabled={submitted || isValidating}
            aria-busy={isValidating}
          >
            {isValidating ? 'Validating...' : submitted ? 'Authorizing...' : 'Authorize'}
          </button>
        </div>
      </AuthCore.Form>
      <p className='text-xs text-black/80 italic max-w-xs text-center mt-6'>
        By registering with storacha.network, you agree to the storacha.network{' '}
        <a 
          className='underline' 
          href='https://docs.storacha.network/terms/'
          target="_blank"
          rel="noopener noreferrer"
        >
          Terms of Service
        </a>.
      </p>
    </div>
  )
}

export function AuthenticationSubmitted (): JSX.Element {
  const [{ email }] = useAuthenticator()
  const [isMounted, setIsMounted] = useState(true)

  useEffect(() => {
    return () => {
      setIsMounted(false)
    }
  }, [])

  // ensure the referral of this user is tracked if necessary.
  useRecordRefcode()

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
        </p>
        <AuthCore.CancelButton 
          className='inline-block bg-hot-red border border-hot-red hover:bg-white hover:text-hot-red font-epilogue text-white uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap'
          disabled={!isMounted}
        >
          Cancel
        </AuthCore.CancelButton>
      </div>
    </div>
  )
}

interface AuthenticationEnsurerProps {
  children: JSX.Element | JSX.Element[]
}

export function AuthenticationEnsurer ({
  children
}: AuthenticationEnsurerProps): JSX.Element {
  const [{ submitted, accounts, client }] = useAuthenticator()
  const authenticated = !!accounts.length

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



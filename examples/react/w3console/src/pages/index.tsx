import type { ChangeEvent } from 'react'
import type { Space } from '@w3ui/keyring-core'

import { useEffect, useState } from 'react'
import { DIDKey } from '@ucanto/interface'
import { useKeyring } from '@w3ui/react-keyring'
import { useUploadsList } from '@w3ui/react-uploads-list'
import { ShareIcon } from '@heroicons/react/20/solid'
import md5 from 'blueimp-md5'

import { SpaceShare } from '../share'
import { Uploader } from '../components/Uploader'
import { UploadsList } from '../components/UploadsList'
import { SpaceFinder } from '../components/SpaceFinder'
import { SpaceCreatorForm, SpaceCreator } from '../components/SpaceCreator'
import { AuthenticationEnsurer } from '../components/Authenticator'
import { tosUrl, LogoIcon } from '../brand'

function SpaceRegistrar (): JSX.Element {
  const [, { registerSpace }] = useKeyring()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  function resetForm (): void {
    setEmail('')
  }
  async function onSubmit (e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setSubmitted(true)
    try {
      await registerSpace(email)
    } catch (err) {
      console.log(err)
      throw new Error('failed to register', { cause: err })
    } finally {
      resetForm()
      setSubmitted(false)
    }
  }
  return (
    <div className='flex flex-col items-center space-y-24 pt-12'>
      <div className='flex flex-col items-center space-y-2'>
        <h3 className='text-lg'>Verify your email address!</h3>
        <p>
          Click the link in the email we sent to start uploading to this space.
        </p>
      </div>
      <div className='flex flex-col items-center space-y-4'>
        <h5>Need a new verification email?</h5>
        <form
          className='flex flex-col items-center space-y-2'
          onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
            void onSubmit(e)
          }}
        >
          <input
            className='text-black px-2 py-1 rounded'
            type='email'
            placeholder='Email'
            value={email}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setEmail(e.target.value)
            }}
          />
          <input
            type='submit'
            className='w3ui-button'
            value='Re-send Verification Email'
            disabled={email === ''}
          />
        </form>
        {submitted && (
          <p>
            Verification re-sent, please check your email for a verification
            email.
          </p>
        )}
      </div>
    </div>
  )
}

interface SpaceSectionProps {
  viewSpace: (did: string) => void
  setShare: (share: boolean) => void
  share: boolean
}

function SpaceSection (props: SpaceSectionProps): JSX.Element {
  const { viewSpace, share, setShare } = props
  const [{ space }] = useKeyring()
  const [, { reload }] = useUploadsList()
  // reload the uploads list when the space changes
  // TODO: this currently does a network request - we'd like to just reset
  // to the latest state we have and revalidate in the background (SWR)
  // but it's not clear how all that state should work yet - perhaps
  // we need some sort of state management primitive in the uploads list?
  useEffect(() => {
    void reload()
  }, [space])
  const registered = Boolean(space?.registered())
  return (
    <div>
      <header className='py-3'>
        {space !== undefined && (
          <div className='flex flex-row items-start gap-2'>
            <img
              title={space.did()}
              src={`https://www.gravatar.com/avatar/${md5(
                space.did()
              )}?d=identicon`}
              className='w-10 hover:saturate-200 saturate-0 invert border-solid border-gray-500 border'
            />
            <div className='grow'>
              <h1 className='text-xl font-semibold leading-5'>
                {space.name() ?? 'Untitled'}
              </h1>
              <label className='font-mono text-xs text-gray-500'>
                {space.did()}
              </label>
            </div>
            <button
              className='h-6 w-6 text-gray-500 hover:text-gray-100'
              onClick={() => setShare(!share)}
            >
              <ShareIcon />
            </button>
          </div>
        )}
      </header>
      <div className='container mx-auto'>
        {share && <SpaceShare viewSpace={viewSpace} />}
        {registered && !share && (
          <>
            <Uploader
              onUploadComplete={() => {
                void reload()
              }}
            />
            <div className='mt-8'>
              <UploadsList />
            </div>
          </>
        )}
        {(space && !registered) && !share && <SpaceRegistrar />}
        {!space && (
          <div className="text-center">
            <h1 className="text-xl">Select a space from the dropdown on the left to get started.</h1>
          </div>
        )}
      </div>
    </div>
  )
}

function SpaceSelector (props: any): JSX.Element {
  const { selected, setSelected, spaces } = props
  return (
    <div>
      <h3 className='text-xs tracking-wider uppercase font-bold my-2 text-gray-400 font-mono'>
        Spaces
      </h3>
      <SpaceFinder
        spaces={spaces}
        selected={selected}
        setSelected={(space: Space) => {
          void setSelected(space.did())
        }}
      />
    </div>
  )
}

export function Logo (): JSX.Element {
  return (
    <h1 className='font-bold flex flex-row justify-center items-center gap-2'>
      <LogoIcon />
      console
    </h1>
  )
}

export function SpaceEnsurer ({
  children
}: {
  children: JSX.Element | JSX.Element[]
}): JSX.Element {
  const [{ spaces, account }] = useKeyring()
  if (spaces && spaces.length > 0) {
    return <>{children}</>
  }
  return (
    <div className="flex flex-col justify-center items-center h-screen">
      <div className="text-gray-200 text-center">
        <h1 className="my-4 text-lg">Welcome {account}!</h1>
        <p>
          To get started with w3up you'll need to create a space.
        </p>
        <p>
          Give it a name and hit create!
        </p>
        <SpaceCreatorForm className='mt-4' />
      </div>
    </div>
  )
}


export default function Home (): JSX.Element {
  const [share, setShare] = useState(false)
  const [{ space, spaces }, { setCurrentSpace }] = useKeyring()

  function viewSpace (did: DIDKey): void {
    setShare(false)
    void setCurrentSpace(did)
  }

  return (
    <AuthenticationEnsurer>
      <SpaceEnsurer>
        <div className='flex min-h-full w-full'>
          <nav className='flex-none w-64 bg-gray-900 text-white px-4 pb-4 border-r border-gray-800'>
            <div className='flex flex-col justify-between min-h-full'>
              <div class='flex-none'>
                <SpaceSelector
                  selected={space}
                  setSelected={viewSpace}
                  spaces={spaces}
                />
              </div>
              <div>
                <SpaceCreator className='mb-8' />
                <Logo />
                <a className='text-xs block text-center mt-2' href={tosUrl}>Terms</a>
              </div>
            </div>
          </nav>
          <main className='grow bg-gray-dark text-white p-4'>
            <SpaceSection viewSpace={viewSpace} share={share} setShare={setShare} />
          </main>
        </div>
      </SpaceEnsurer>
    </AuthenticationEnsurer>
  )
}


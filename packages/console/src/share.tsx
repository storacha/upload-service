import { ChangeEvent, useState } from 'react'
import { useW3 } from '@w3ui/react'
import * as DID from '@ipld/dag-ucan/did'
import { extract } from '@ucanto/core/delegation'
import type { PropsWithChildren } from 'react'
import type { Delegation } from '@ucanto/interface'
import { SpacePreview } from './components/SpaceCreator'
import { H2 } from '@/components/Text'
import CopyButton from './components/CopyButton'
import { ArrowDownOnSquareStackIcon, CloudArrowDownIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline'

function Header(props: PropsWithChildren): JSX.Element {
  return (
    <H2 as='h3'>
      {props.children}
    </H2>
  )
}

export function ShareSpace (): JSX.Element {
  const [{ client }] = useW3()
  const [value, setValue] = useState('')
  const [downloadUrl, setDownloadUrl] = useState('')

  async function makeDownloadLink(input: string): Promise<void> {
    if (!client) return

    let audience
    try {
      audience = DID.parse(input.trim())
    } catch (err) {
      setDownloadUrl('')
      return
    }

    try {
      const delegation = await client.createDelegation(audience, ['*'], {
        expiration: Infinity,
      })
      const archiveRes = await delegation.archive()
      if (archiveRes.error) {
        throw new Error('failed to archive delegation', { cause: archiveRes.error })
      }
      const blob = new Blob([archiveRes.ok])
      const url = URL.createObjectURL(blob)
      setDownloadUrl(url)
    } catch (err: any) {
      throw new Error(err.message ?? err, { cause: err })
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    void makeDownloadLink(value)
  }

  function onChange(e: ChangeEvent<HTMLInputElement>): void {
    const input = e.target.value
    void makeDownloadLink(input)
    setValue(input)
  }

  function downloadName(ready: boolean, inputDid: string): string {
    if (!ready || inputDid === '') return ''
    const [, method = '', id = ''] = inputDid.split(':')
    return `did-${method}-${id?.substring(0, 10)}.ucan`
  }

  return (
    <div className='max-w-4xl'>
      <Header>Share your space</Header>
      <div className='bg-white rounded-2xl border border-hot-red p-5 font-epilogue'>
        <p className='mb-4'>
          Ask your friend for their Decentralized Identifier (DID) and paste it
          below:
        </p>
        <form
          onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
            void onSubmit(e)
          }}
        >
          <input
            className='text-black py-2 px-2 rounded-xl block mb-4 border border-hot-red w-11/12'
            type='pattern'
            pattern='did:.+'
            placeholder='did:'
            value={value}
            onChange={onChange}
            required={true}
          />
          <a
            className={`inline-block bg-hot-red border border-hot-red ${downloadUrl ? 'hover:bg-white hover:text-hot-red' : 'opacity-20'} font-epilogue text-white uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap`}
            href={downloadUrl ?? ''}
            download={downloadName(downloadUrl !== '', value)}
            onClick={e => downloadUrl === '' && e.preventDefault()}
          >
            <CloudArrowDownIcon className='h-5 w-5 inline-block mr-1 align-middle' style={{marginTop: -4}} /> Download UCAN
          </a>
        </form>
      </div>
    </div>
  )
}

export function ImportSpace () {
  const [{ client }] = useW3()
  const [proof, setProof] = useState<Delegation>()

  async function onImport(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const input = e.target.files?.[0]
    if (!client || input === undefined) return
    let delegation
    try {
      const res = await extract(new Uint8Array(await input.arrayBuffer()))
      if (res.error) {
        throw new Error('failed to extract delegation', { cause: res.error })
      }
      delegation = res.ok
    } catch (err) {
      console.log(err)
      return
    }
    try {
      await client.addSpace(delegation)
      setProof(delegation)
    } catch (err) {
      console.log(err)
    }
  }

  const body = `Please send me a UCAN delegation to access to your space. My agent DID is:\n\n${client?.did()}`
    .replace(/ /g, '%20')
    .replace(/\n/g, '%0A')

  return (
    <div className='border border-hot-red rounded-2xl bg-white p-5 max-w-4xl'>
      <ol className='list-decimal ml-4 text-hot-red'>
        <li className='mt-4 mb-8'>
          Send your DID to your friend.
          <div className='font-mono text-sm text-black break-words my-4'>
            {client?.did()}
          </div>
          <CopyButton text={client?.did() ?? ''}>Copy DID</CopyButton>
          <a href={`mailto:?subject=Space%20Access%20Request&body=${body}`} className={`inline-block bg-hot-red border border-hot-red hover:bg-white hover:text-hot-red font-epilogue text-white uppercase text-sm ml-2 px-6 py-2 rounded-full whitespace-nowrap`}>
            <PaperAirplaneIcon className='h-5 w-5 inline-block mr-1 align-middle' style={{marginTop: -4}} /> Email DID
          </a>
        </li>
        <li className='mt-4 my-8'>
          Import the UCAN they send you.
          <p className='text-black my-2'>Instruct your friend to use the web console or CLI to create a UCAN, delegating your DID acces to their space.</p>
          <div className='mt-4'>
            <label className='inline-block bg-hot-red border border-hot-red hover:bg-white hover:text-hot-red font-epilogue text-white uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap cursor-pointer'>
              <ArrowDownOnSquareStackIcon className='h-5 w-5 inline-block mr-1 align-middle' style={{marginTop: -4}} />
              Import UCAN
              <input
                type='file'
                accept='.ucan,.car,application/vnd.ipfs.car'
                className='hidden'
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  void onImport(e)
                }}
              />
            </label>
          </div>
        </li>
      </ol>
      {proof && (
        <div className='mt-4 pt-4'>
          <Header>Added</Header>
          <div className='max-w-3xl border border-hot-red rounded-2xl'>
            {proof.capabilities.map((cap, i) => (
              <SpacePreview did={cap.with} name={proof.facts.at(i)?.space.name} key={cap.with} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

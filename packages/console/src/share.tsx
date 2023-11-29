import { ChangeEvent, useState } from 'react'
import { useW3 } from '@w3ui/react'
import * as DID from '@ipld/dag-ucan/did'
import { CarWriter } from '@ipld/car/writer'
import { CarReader } from '@ipld/car/reader'
import { importDAG } from '@ucanto/core/delegation'
import type { PropsWithChildren } from 'react'
import type { Delegation } from '@ucanto/interface'
import { SpacePreview } from './components/SpaceCreator'
import { H2 } from '@/components/Text'

function Header(props: PropsWithChildren): JSX.Element {
  return (
    <H2 as='h3'>
      {props.children}
    </H2>
  )
}

export async function toCarBlob(delegation: Delegation): Promise<Blob> {
  const { writer, out } = CarWriter.create()
  for (const block of delegation.export()) {
    void writer.put(block)
  }
  void writer.close()

  const carParts = []
  for await (const chunk of out) {
    carParts.push(chunk)
  }
  const car = new Blob(carParts, {
    type: 'application/vnd.ipld.car',
  })
  return car
}

export async function toDelegation(car: Blob): Promise<Delegation> {
  const blocks = []
  const bytes = new Uint8Array(await car.arrayBuffer())
  const reader = await CarReader.fromBytes(bytes)
  for await (const block of reader.blocks()) {
    blocks.push(block)
  }
  return importDAG(blocks)
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
      const blob = await toCarBlob(delegation)
      const url = URL.createObjectURL(blob)
      setDownloadUrl(url)
    } catch (err) {
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
    <div className='pt-4'>
      <div className='max-w-xl'>
        <Header>Share your space</Header>
        <p className='mb-4'>
          Ask your friend for their Decentralized Identifier (DID) and paste it
          in below
        </p>
        <form
          onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
            void onSubmit(e)
          }}
        >
          <input
            className='text-black py-2 px-2 rounded block w-full mb-4 border border-gray-800'
            type='pattern'
            pattern='did:.+'
            placeholder='did:'
            value={value}
            onChange={onChange}
            required={true}
          />
          <a
            className='inline-block bg-zinc-950 hover:outline text-white font-bold text-sm px-6 py-2 rounded-full whitespace-nowrap'
            style={{ opacity: downloadUrl !== '' ? '1' : '0.2' }}
            href={downloadUrl ?? ''}
            download={downloadName(downloadUrl !== '', value)}
          >
            Download UCAN
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
      delegation = await toDelegation(input)
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

  return (
    <>
    <p className='mt-4 mb-8'>Send your DID to your friend, and click import to use the UCAN they send you.</p>
    <div className='bg-opacity-50 bg-white font-mono text-sm py-5 px-5 rounded break-words max-w-4xl shadow-inner'>
      {client?.did()}
    </div>
    <div className='mt-8'>
      <label className='inline-block bg-zinc-950 hover:outline text-white font-bold text-sm px-6 py-2 rounded-full whitespace-nowrap cursor-pointer'>
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
    {proof !== undefined && (
      <div className='mt-4 pt-4'>
        <Header>Added</Header>
        <div className='max-w-3xl border border-gray-700 shadow-xl'>
          {proof.capabilities.map((cap, i) => (
            <SpacePreview did={cap.with} name={proof.facts.at(i)?.space.name} key={cap.with} />
          ))}
        </div>
      </div>
    )}
  </>
  )
}

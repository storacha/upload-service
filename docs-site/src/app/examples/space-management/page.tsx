import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'
import { Playground } from '@/components/Playground'

export default function SpaceManagementExamplePage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Space Management Example</h1>

        <p>
          Ensure a space exists, display current space details, and allow users to switch or create spaces.
          This example composes simple utilities into a usable flow.
        </p>

        <h2>Live Demo</h2>
        <Playground initialCode={`import React, { useState } from 'react'
import { Provider, Authenticator, useW3 } from '@storacha/ui-react'

function SpaceEnsurer({ children }) {
  const [{ client, spaces }] = useW3()
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    async function ensure() {
      if (!client) return
      let space = client.currentSpace()
      if (!space) {
        const existing = client.spaces()
        space = existing[0] || await client.createSpace('My App Space')
        await client.setCurrentSpace(space.did())
      }
      setReady(true)
    }
    ensure()
  }, [client])

  if (!ready) return <p>Setting up space…</p>
  return children
}

function SpaceInfo() {
  const [{ client }] = useW3()
  const [info, setInfo] = React.useState(null)
  React.useEffect(() => {
    if (client) {
      const s = client.currentSpace()
      if (s) {
        setInfo({ did: s.did(), name: s.name(), isPrivate: s.meta()?.access?.type === 'private' })
      }
    }
  }, [client])
  if (!info) return <p>No space selected</p>
  return (
    <div className="p-4 bg-gray-50 rounded-lg text-sm">
      <p><strong>Name:</strong> {info.name}</p>
      <p><strong>DID:</strong> {info.did}</p>
      <p><strong>Type:</strong> {info.isPrivate ? 'Private' : 'Public'}</p>
    </div>
  )
}

function SpaceSwitcher() {
  const [{ client, spaces }] = useW3()
  const [current, setCurrent] = useState<string>('')
  React.useEffect(() => {
    if (client) setCurrent(client.currentSpace()?.did() || '')
  }, [client])
  const onChange = async (did: string) => {
    if (!client) return
    await client.setCurrentSpace(did)
    setCurrent(did)
  }
  if (spaces.length === 0) return null
  return (
    <select value={current} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 border rounded-md">
      {spaces.map((s) => (
        <option key={s.did()} value={s.did()}>{s.name()} ({s.meta()?.access?.type || 'public'})</option>
      ))}
    </select>
  )
}

function SpaceCreator() {
  const [{ client }] = useW3()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const create = async (e) => {
    e.preventDefault()
    if (!client || !name.trim()) return
    setBusy(true)
    try {
      const s = await client.createSpace(name.trim())
      await client.setCurrentSpace(s.did())
      setName('')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={create} className="flex gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New space name" className="flex-1 px-3 py-2 border rounded-md" />
      <button type="submit" disabled={busy || !name.trim()} className="bg-hot-blue text-white px-4 py-2 rounded-md disabled:opacity-50">{busy ? 'Creating…' : 'Create'}</button>
    </form>
  )
}

function App() {
  return (
    <Provider>
      <Authenticator>
        <SpaceEnsurer>
          <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-xl font-semibold">Manage Spaces</h2>
            <SpaceInfo />
            <SpaceSwitcher />
            <SpaceCreator />
          </div>
        </SpaceEnsurer>
      </Authenticator>
    </Provider>
  )
}`}
        />

        <h2>Notes</h2>
        <ul>
          <li>Always ensure a space before enabling uploads.</li>
          <li>Show current space context to reduce user confusion.</li>
        </ul>
      </MDXContent>
    </Layout>
  )
}



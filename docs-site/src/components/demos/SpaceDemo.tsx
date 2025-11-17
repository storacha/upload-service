"use client"

import { useState } from 'react'

type Space = { did: string; name: string; access: 'public' | 'private' }

export default function SpaceDemo() {
  const [spaces, setSpaces] = useState<Space[]>([
    { did: 'did:space:alpha', name: 'Alpha', access: 'public' },
    { did: 'did:space:beta', name: 'Beta', access: 'private' },
  ])
  const [current, setCurrent] = useState<string>('did:space:alpha')
  const [name, setName] = useState('')

  function createSpace(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const did = `did:space:${name.toLowerCase().replace(/\s+/g, '-')}`
    const space = { did, name: name.trim(), access: 'public' as const }
    setSpaces((s) => [...s, space])
    setCurrent(did)
    setName('')
  }

  return (
    <div className="space-y-4">
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
        <div className="text-sm">Current space:</div>
        <div className="font-semibold">{spaces.find((s) => s.did === current)?.name}</div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Switch space</label>
        <select
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        >
          {spaces.map((s) => (
            <option key={s.did} value={s.did}>
              {s.name} ({s.access})
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={createSpace} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New space name"
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
        />
        <button className="px-4 py-2 bg-hot-blue text-white rounded-md disabled:opacity-50" disabled={!name.trim()}>
          Create
        </button>
      </form>
    </div>
  )
}



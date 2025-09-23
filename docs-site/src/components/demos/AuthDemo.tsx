"use client"

import { useState } from 'react'

export default function AuthDemo() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [account, setAccount] = useState<{ email: string; did: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitted(true)
    try {
      // Simulate auth delay
      await new Promise((r) => setTimeout(r, 600))
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        throw new Error('Please enter a valid email address')
      }
      const fakeDid = `did:example:${btoa(email).slice(0, 16)}`
      setAccount({ email, did: fakeDid })
    } catch (err: any) {
      setError(err.message || 'Authentication failed')
    } finally {
      setSubmitted(false)
    }
  }

  function reset() {
    setAccount(null)
    setEmail('')
    setError(null)
  }

  if (account) {
    return (
      <div className="p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <h3 className="text-green-800 dark:text-green-200 font-semibold mb-2">Authentication Successful!</h3>
        <div className="space-y-1 text-sm">
          <p><strong>Email:</strong> {account.email}</p>
          <p><strong>Account ID:</strong> {account.did}</p>
        </div>
        <button onClick={reset} className="mt-4 text-sm text-hot-blue dark:text-hot-blue-light underline">
          Sign out
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
          Sign In to Web3.Storage (Demo)
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-hot-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitted}
            className="w-full bg-hot-blue hover:bg-hot-blue/90 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitted ? 'Signing in…' : 'Sign In / Sign Up'}
          </button>
        </form>
      </div>
    </div>
  )
}



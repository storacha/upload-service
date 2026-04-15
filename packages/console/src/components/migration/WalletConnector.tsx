'use client'

import { useState, useCallback } from 'react'
import type { WalletClient } from 'viem'

interface WalletConnectorProps {
  onConnected: (client: WalletClient) => void
}

export function WalletConnector({ onConnected }: WalletConnectorProps) {
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connectWallet = useCallback(async () => {
    setIsConnecting(true)
    setError(null)

    try {
      // Check if MetaMask or another injected wallet is available
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('No wallet detected. Please install MetaMask or another Web3 wallet.')
      }

      const { createWalletClient, custom } = await import('viem')
      const { filecoin } = await import('viem/chains')

      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      }) as string[]

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please connect your wallet.')
      }

      // Create wallet client
      const walletClient = createWalletClient({
        chain: filecoin,
        transport: custom(window.ethereum),
        account: accounts[0] as `0x${string}`,
      })

      onConnected(walletClient)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet')
    } finally {
      setIsConnecting(false)
    }
  }, [onConnected])

  return (
    <div className="text-center py-8">
      <div className="mb-6">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Connect Your Wallet</h3>
        <p className="text-gray-600 text-sm max-w-md mx-auto">
          Connect your wallet to calculate migration costs and sign transactions.
          You&apos;ll need USDFC for storage payments and FIL for gas fees.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg max-w-md mx-auto">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <button
        onClick={connectWallet}
        disabled={isConnecting}
        className={`
          px-6 py-3 rounded-lg font-medium text-white
          ${isConnecting
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-hot-red hover:bg-red-700'
          }
        `}
      >
        {isConnecting ? (
          <span className="flex items-center gap-2">
            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            Connecting...
          </span>
        ) : (
          'Connect Wallet'
        )}
      </button>

      <p className="mt-4 text-xs text-gray-500">
        Supported: MetaMask, WalletConnect, and other Web3 wallets
      </p>
    </div>
  )
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      on: (event: string, callback: (...args: unknown[]) => void) => void
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void
    }
  }
}

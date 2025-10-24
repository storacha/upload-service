import React, { useEffect, useState } from 'react'
import { useStorachaAuth } from '@storacha/ui-react'

interface Web3MailAuthProps {
  onAuthSuccess: (address: string, ensName?: string) => void
  onAuthError: (error: Error) => void
}

export function Web3MailAuth({ onAuthSuccess, onAuthError }: Web3MailAuthProps) {
  const [{ accounts, submitted, error }] = useStorachaAuth()
  const [isWalletConnected, setIsWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')
  const [ensName, setEnsName] = useState<string>()

  useEffect(() => {
    if (accounts.length > 0) {
      const address = accounts[0].toEmail() // This would be the wallet address in real implementation
      setWalletAddress(address)
      setIsWalletConnected(true)
      
      // Simulate ENS resolution
      if (address.startsWith('0x')) {
        setEnsName(`user.eth`)
      }
    }
  }, [accounts])

  useEffect(() => {
    if (error) {
      onAuthError(error)
    }
  }, [error, onAuthError])

  const handleConnectWallet = async () => {
    try {
      // Simulate wallet connection
      const mockAddress = '0x' + Math.random().toString(16).substr(2, 40)
      setWalletAddress(mockAddress)
      setIsWalletConnected(true)
      setEnsName(`user${Math.floor(Math.random() * 1000)}.eth`)
    } catch (error) {
      onAuthError(error as Error)
    }
  }

  const handleDisconnect = () => {
    setIsWalletConnected(false)
    setWalletAddress('')
    setEnsName(undefined)
  }

  const handleAuthenticate = async () => {
    if (walletAddress) {
      onAuthSuccess(walletAddress, ensName)
    }
  }

  return (
    <div className="web3mail-auth">
      <div className="auth-header">
        <div className="web3mail-logo">🌐</div>
        <h2>Connect with Web3Mail</h2>
        <p>Use your Web3 wallet to authenticate and access decentralized storage</p>
      </div>

      {!isWalletConnected ? (
        <div className="wallet-connection">
          <div className="wallet-options">
            <button
              onClick={handleConnectWallet}
              className="connect-wallet-button"
            >
              <span className="wallet-icon">🦊</span>
              Connect MetaMask
            </button>
            
            <button
              onClick={handleConnectWallet}
              className="connect-wallet-button"
            >
              <span className="wallet-icon">🔗</span>
              Connect WalletConnect
            </button>
          </div>

          <div className="wallet-info">
            <h3>Supported Wallets</h3>
            <ul>
              <li>MetaMask</li>
              <li>WalletConnect</li>
              <li>Coinbase Wallet</li>
              <li>Rainbow</li>
            </ul>
          </div>
        </div>
      ) : (
        <StorachaAuth.Form className="web3mail-auth-form">
          <div className="connected-wallet">
            <div className="wallet-address">
              {ensName || `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`}
            </div>
            <button
              onClick={handleDisconnect}
              className="disconnect-button"
            >
              Disconnect
            </button>
          </div>

          <button
            type="submit"
            onClick={handleAuthenticate}
            disabled={submitted}
            className="web3mail-auth-button"
          >
            {submitted ? 'Authenticating...' : 'Authenticate with Web3Mail'}
          </button>
        </StorachaAuth.Form>
      )}

      <div className="web3mail-features">
        <h3>Web3Mail Integration Features</h3>
        <ul>
          <li>🔐 Decentralized wallet authentication</li>
          <li>📧 End-to-end encrypted messaging</li>
          <li>📁 Decentralized file storage</li>
          <li>🌐 No central authority</li>
          <li>🔒 Privacy-first approach</li>
          <li>⚡ Fast and secure</li>
        </ul>
      </div>
    </div>
  )
}

# Web3Mail Integration Example

This example demonstrates how to integrate Storacha Console Toolkit with Web3Mail for decentralized email communication and file sharing.

## Overview

Web3Mail integration provides:
- **Decentralized Authentication**: Web3 wallet-based authentication
- **Encrypted Communication**: End-to-end encrypted email via Web3Mail
- **File Sharing**: Secure file storage with Web3Mail integration
- **Privacy-First**: No central authority, fully decentralized

## Quick Start

```bash
# Clone the example
git clone https://github.com/storacha/upload-service
cd packages/ui/examples/react/web3mail-integration

# Install dependencies
npm install

# Start development server
npm run dev
```

## Implementations Features

### 1. Web3Mail Authentication Setup

### 2. Web3Mail File Upload Component

### 3. Web3Mail Share Component


## API Integration

### Web3Mail API Endpoints [Proposed code below : Needs to be modified as implementations continues]

```typescript
// src/api/web3mail.ts
export interface Web3MailNotification {
  to: string
  from: string
  subject: string
  message: string
  fileCid: string
  encryptedMessageId: string
}

export interface Web3MailFileShare {
  to: string
  from: string
  subject: string
  message: string
  fileCid: string
  fileName: string
  encryptionEnabled: boolean
}

export async function sendWeb3MailNotification(notification: Web3MailNotification): Promise<void> {
  const response = await fetch('/api/web3mail/send-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(notification)
  })

  if (!response.ok) {
    throw new Error('Failed to send Web3Mail notification')
  }
}

export async function sendWeb3MailFile(share: Web3MailFileShare): Promise<void> {
  const response = await fetch('/api/web3mail/send-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(share)
  })

  if (!response.ok) {
    throw new Error('Failed to send file via Web3Mail')
  }
}

export async function resolveENSName(address: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/ens/resolve?address=${address}`)
    const data = await response.json()
    return data.ensName || null
  } catch (error) {
    console.error('ENS resolution failed:', error)
    return null
  }
}
```

## Deployment


### Environment Variables [open to changes]

```bash
# .env.local
REACT_APP_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
STORACHA_SERVICE_URL=https://api.storacha.network
STORACHA_SERVICE_PRINCIPAL=did:web:storacha.network
WEB3MAIL_API_URL=https://api.web3mail.app
```

## Testing [Open to changes]

### Unit Tests

```tsx
// src/components/__tests__/Web3MailAuth.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Web3MailAuth } from '../Web3MailAuth'
import { WagmiConfig, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { publicProvider } from 'wagmi/providers/public'

const config = createConfig({
  chains: [mainnet],
  connectors: [],
  publicClient: publicProvider()(mainnet),
})

test('renders Web3Mail authentication form', () => {
  const mockOnAuthSuccess = jest.fn()
  const mockOnAuthError = jest.fn()

  render(
    <WagmiConfig config={config}>
      <Web3MailAuth
        onAuthSuccess={mockOnAuthSuccess}
        onAuthError={mockOnAuthError}
      />
    </WagmiConfig>
  )

  expect(screen.getByText('Connect with Web3Mail')).toBeInTheDocument()
  expect(screen.getByText('Connect MetaMask')).toBeInTheDocument()
  expect(screen.getByText('Connect WalletConnect')).toBeInTheDocument()
})

test('validates wallet address format', async () => {
  const mockOnAuthError = jest.fn()
  
  render(
    <WagmiConfig config={config}>
      <Web3MailAuth
        onAuthSuccess={jest.fn()}
        onAuthError={mockOnAuthError}
      />
    </WagmiConfig>
  )

  // Test wallet connection
  const connectButton = screen.getByText('Connect MetaMask')
  fireEvent.click(connectButton)
  
  // Mock wallet connection
  // Test address validation
})
```

## Features[Change as implemented]

### ✅ Implemented Features

- **Web3 Wallet Authentication**: MetaMask, WalletConnect, and other wallet support
- **ENS Name Resolution**: Display ENS names when available
- **Decentralized File Upload**: Upload files to Storacha with Web3Mail integration
- **End-to-End Encryption**: Optional encryption for file sharing
- **Progress Tracking**: Real-time upload progress display

## Contributing

- contributions are highly encouraged.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/web3mail-enhancement`
3. Commit changes: `git commit -am 'Add Web3Mail enhancement'`
4. Push to branch: `git push origin feature/web3mail-enhancement`
5. Submit a pull request

## License

This example is part of the Storacha Console Integration Toolkit and is licensed under [MIT + Apache 2.0](https://github.com/storacha/upload-service/blob/main/license.md).

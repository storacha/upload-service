# Dmail Integration Example

This example demonstrates how to integrate Storacha Console Toolkit with Dmail for email-based authentication and file sharing.

## Overview

Dmail integration provides:
- **Email Authentication**: Seamless login using Dmail email addresses
- **File Sharing**: Send files via Dmail with Storacha storage
- **Encrypted Storage**: Secure file storage with Dmail integration
- **Zero Navigation**: Embedded iframe experience

## Live Demo

--

## Quick Start

```bash
# Clone the example
git clone https://github.com/storacha/upload-service
cd packages/ui/examples/react/dmail-integration

# Install dependencies
npm install

# Start development server
npm run dev
```

## Implementation

### 1. Dmail Authentication Setup
### 2. File Upload with Dmail Integration
### 3. Dmail Share Component

## API Integration[Modify as exposed]

### Dmail API Endpoints

```typescript
// src/api/dmail.ts
export interface DmailNotification {
  to: string
  subject: string
  body: string
  fileCid: string
}

export interface DmailFileShare {
  to: string
  from: string
  subject: string
  message: string
  fileCid: string
  fileName: string
}

export async function sendDmailNotification(notification: DmailNotification): Promise<void> {
  const response = await fetch('/api/dmail/send-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(notification)
  })

  if (!response.ok) {
    throw new Error('Failed to send Dmail notification')
  }
}

export async function sendDmailFile(share: DmailFileShare): Promise<void> {
  const response = await fetch('/api/dmail/send-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(share)
  })

  if (!response.ok) {
    throw new Error('Failed to send file via Dmail')
  }
}
```


### Environment Variables[modify as required]

```bash
# .env.local
DMail_API_KEY=your_dmail_api_key
STORACHA_SERVICE_URL=https://api.storacha.network
STORACHA_SERVICE_PRINCIPAL=did:web:storacha.network
```

## Testing[to change as implemented later]

### Unit Tests

```tsx
// src/components/__tests__/DmailAuth.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DmailAuth } from '../DmailAuth'

test('renders Dmail authentication form', () => {
  const mockOnAuthSuccess = jest.fn()
  const mockOnAuthError = jest.fn()

  render(
    <DmailAuth
      onAuthSuccess={mockOnAuthSuccess}
      onAuthError={mockOnAuthError}
    />
  )

  expect(screen.getByText('Connect with Dmail')).toBeInTheDocument()
  expect(screen.getByPlaceholderText('yourname@dmail.ai')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /connect with dmail/i })).toBeInTheDocument()
})

test('validates Dmail email format', async () => {
  const mockOnAuthError = jest.fn()
  
  render(
    <DmailAuth
      onAuthSuccess={jest.fn()}
      onAuthError={mockOnAuthError}
    />
  )

  const emailInput = screen.getByPlaceholderText('yourname@dmail.ai')
  const submitButton = screen.getByRole('button', { name: /connect with dmail/i })

  fireEvent.change(emailInput, { target: { value: 'test@gmail.com' } })
  
  expect(submitButton).toBeDisabled()
})
```

### Integration Tests

```tsx
// src/__tests__/dmail-integration.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

test('complete Dmail integration flow', async () => {
  const user = userEvent.setup()
  
  render(<App />)

  // Authentication
  const emailInput = screen.getByPlaceholderText('yourname@dmail.ai')
  await user.type(emailInput, 'test@dmail.ai')
  
  const authButton = screen.getByRole('button', { name: /connect with dmail/i })
  await user.click(authButton)

  await waitFor(() => {
    expect(screen.getByText('Connected as: test@dmail.ai')).toBeInTheDocument()
  })

  // File upload
  const file = new File(['hello'], 'hello.txt', { type: 'text/plain' })
  const dropzone = screen.getByText('Drag & Drop Files')
  
  await user.upload(dropzone, file)
  await user.click(screen.getByRole('button', { name: /upload & share via dmail/i }))

  await waitFor(() => {
    expect(screen.getByText('File Shared Successfully!')).toBeInTheDocument()
  })
})
```

## Features

### ✅ Implemented Features

- **Dmail Authentication**: Email-based login with Dmail validation
- **File Upload**: Drag & drop file upload with Storacha storage
- **Dmail Integration**: Send files via Dmail with share URLs
- **Progress Tracking**: Real-time upload progress display

### 🚀 Coming Soon

- **Batch File Sharing**: Share multiple files at once
- **Dmail Templates**: Customizable email templates
- **File Preview**: Preview files before sharing
- **Advanced Encryption**: Enhanced security options
- **Analytics**: Upload and sharing analytics

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/dmail-enhancement`
3. Commit changes: `git commit -am 'Add Dmail enhancement'`
4. Push to branch: `git push origin feature/dmail-enhancement`
5. Submit a pull request

## License

This example is part of the Storacha Console Integration Toolkit and is licensed under [MIT + Apache 2.0](https://github.com/storacha/upload-service/blob/main/license.md).

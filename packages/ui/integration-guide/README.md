# Integration Guide

This guide provides comprehensive instructions for integrating the Storacha Console Integration Toolkit into various platforms and applications.
Live integrations demo examples avaialable for:-
- Dmail
- web3
- more coming soon...

## 🚀 Quick Integration

### Basic Setup

1. **Install the package:**
```bash
npm install @storacha/ui-react
```

2. **Wrap your app with providers:**
```tsx
import { Provider, Authenticator, Uploader } from '@storacha/ui-react'

function App() {
  return (
    <Provider>
      <Authenticator>
        <Uploader>
          {/* Your application */}
        </Uploader>
      </Authenticator>
    </Provider>
  )
}
```

3. **Add authentication and upload components:**
```tsx
import { useAuthenticator, useUploader } from '@storacha/ui-react'

function MyComponent() {
  const [{ accounts }] = useAuthenticator()
  const [{ status, file }] = useUploader()
  
  // Your component logic
}
```

## 🎯 Platform-Specific Integrations

### React Applications

#### Next.js Integration

**1. Install dependencies:**
```bash
npm install @storacha/ui-react
```

**2. Create a provider wrapper:**
```tsx
// app/providers.tsx
'use client'

import { Provider } from '@storacha/ui-react'

export function StorachaProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider
      servicePrincipal="did:web:storacha.network"
      connection={{ url: "https://api.storacha.network" }}
    >
      {children}
    </Provider>
  )
}
```

**3. Add to your layout:**
```tsx
// app/layout.tsx
import { StorachaProvider } from './providers'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <StorachaProvider>
          {children}
        </StorachaProvider>
      </body>
    </html>
  )
}
```

**4. Use in your pages:**
```tsx
// app/upload/page.tsx
'use client'

import { Authenticator, Uploader } from '@storacha/ui-react'

export default function UploadPage() {
  return (
    <Authenticator>
      <Uploader>
        <div>
          <h1>Upload Files</h1>
          {/* Your upload UI */}
        </div>
      </Uploader>
    </Authenticator>
  )
}
```

#### Create React App Integration

**1. Install dependencies:**
```bash
npm install @storacha/ui-react
```

**2. Update your main App component:**
```tsx
// src/App.tsx
import React from 'react'
import { Provider, Authenticator, Uploader } from '@storacha/ui-react'
import './App.css'

function App() {
  return (
    <Provider>
      <Authenticator>
        <Uploader>
          <div className="App">
            <header className="App-header">
              <h1>My Storacha App</h1>
              {/* Your app content */}
            </header>
          </div>
        </Uploader>
      </Authenticator>
    </Provider>
  )
}

export default App
```

### Vue.js Integration

**1. Install dependencies:**
```bash
npm install @storacha/ui-react
```

**2. Create a Vue wrapper component:**

```vue
<!-- StorachaWrapper.vue -->
<template>
  <div ref="storachaContainer"></div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { createRoot } from 'react-dom/client'
import { Provider, Authenticator, Uploader } from '@storacha/ui-react'

const storachaContainer = ref(null)

onMounted(() => {
  if (storachaContainer.value) {
    const root = createRoot(storachaContainer.value)
    root.render(
      React.createElement(Provider, null,
        React.createElement(Authenticator, null,
          React.createElement(Uploader, null,
            React.createElement('div', null, 'Storacha Components')
          )
        )
      )
    )
  }
})
</script>
```

### Angular Integration

**1. Install dependencies:**
```bash
npm install @storacha/ui-react
```

**2. Create an Angular wrapper component:**
```typescript
// storacha-wrapper.component.ts
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { createRoot } from 'react-dom/client'
import { Provider, Authenticator, Uploader } from '@storacha/ui-react'

@Component({
  selector: 'app-storacha-wrapper',
  template: '<div #storachaContainer></div>'
})
export class StorachaWrapperComponent implements OnInit {
  @ViewChild('storachaContainer', { static: true }) container!: ElementRef

  ngOnInit() {
    const root = createRoot(this.container.nativeElement)
    root.render(
      React.createElement(Provider, null,
        React.createElement(Authenticator, null,
          React.createElement(Uploader, null,
            React.createElement('div', null, 'Storacha Components')
          )
        )
      )
    )
  }
}
```

## 🔧 Configuration

### Environment Variables[change as required]

Set up environment variables for different environments:

```bash
# .env.local
NEXT_PUBLIC_SERVICE_URL=https://api.storacha.network
NEXT_PUBLIC_SERVICE_PRINCIPAL=did:web:storacha.network
NEXT_PUBLIC_UCAN_KMS_URL=https://kms.storacha.network
NEXT_PUBLIC_UCAN_KMS_DID=did:web:kms.storacha.network
```


## 🖼 Iframe Integration

### Basic Iframe Setup

**1. Create an iframe page:**
```tsx
// iframe-page.tsx
import { Provider, Authenticator, Uploader } from '@storacha/ui-react'

export default function IframePage() {
  return (
    <Provider>
      <Authenticator>
        <Uploader>
          <div style={{ padding: '20px' }}>
            <h1>Storacha Integration</h1>
            {/* Your components */}
          </div>
        </Uploader>
      </Authenticator>
    </Provider>
  )
}
```

**2. Embed in parent application:**
```html
<iframe 
  src="https://your-app.com/storacha-iframe"
  width="100%"
  height="600"
  frameborder="0"
  allow="camera; microphone; geolocation">
</iframe>
```

### PostMessage Communication

**1. Set up communication in iframe:**
```tsx
// iframe-page.tsx
import { useEffect } from 'react'
import { useAuthenticator, useUploader } from '@storacha/ui-react'

export default function IframePage() {
  const [{ accounts }] = useAuthenticator()
  const [{ status, dataCID }] = useUploader()

  useEffect(() => {
    // Send authentication status to parent
    window.parent.postMessage({
      type: 'AUTH_STATUS',
      authenticated: accounts.length > 0,
      email: accounts[0]?.toEmail()
    }, '*')
  }, [accounts])

  useEffect(() => {
    // Send upload status to parent
    window.parent.postMessage({
      type: 'UPLOAD_STATUS',
      status,
      cid: dataCID?.toString()
    }, '*')
  }, [status, dataCID])

  return (
    <div>
      {/* Your components */}
    </div>
  )
}
```

**2. Listen for messages in parent:**
```tsx
// parent-app.tsx
import { useEffect, useState } from 'react'

export default function ParentApp() {
  const [authStatus, setAuthStatus] = useState(null)
  const [uploadStatus, setUploadStatus] = useState(null)

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data.type === 'AUTH_STATUS') {
        setAuthStatus(event.data)
      } else if (event.data.type === 'UPLOAD_STATUS') {
        setUploadStatus(event.data)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  return (
    <div>
      <h1>Parent Application</h1>
      {authStatus?.authenticated && (
        <p>User: {authStatus.email}</p>
      )}
      {uploadStatus?.status === 'succeeded' && (
        <p>Upload complete: {uploadStatus.cid}</p>
      )}
      <iframe 
        src="/storacha-iframe"
        width="100%"
        height="600"
        frameborder="0"
      />
    </div>
  )
}
```

## 🧪 Testing[modify as implemented]

### Unit Testing

```tsx
// auth.test.tsx
import { render, screen } from '@testing-library/react'
import { Provider, Authenticator } from '@storacha/ui-react'

test('renders authentication form', () => {
  render(
    <Provider>
      <Authenticator>
        <Authenticator.Form>
          <Authenticator.EmailInput />
        </Authenticator.Form>
      </Authenticator>
    </Provider>
  )
  
  expect(screen.getByRole('form')).toBeInTheDocument()
  expect(screen.getByRole('textbox')).toBeInTheDocument()
})
```

### Integration Testing

```tsx
// integration.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider, Authenticator, Uploader } from '@storacha/ui-react'

test('complete upload flow', async () => {
  const user = userEvent.setup()
  
  render(
    <Provider>
      <Authenticator>
        <Uploader>
          <Uploader.Form>
            <Uploader.Input />
            <button type="submit">Upload</button>
          </Uploader.Form>
        </Uploader>
      </Authenticator>
    </Provider>
  )
  
  const fileInput = screen.getByRole('textbox', { name: /file/i })
  const file = new File(['hello'], 'hello.txt', { type: 'text/plain' })
  
  await user.upload(fileInput, file)
  await user.click(screen.getByRole('button', { name: /upload/i }))
  
  await waitFor(() => {
    expect(screen.getByText(/upload complete/i)).toBeInTheDocument()
  })
})
```

## 🔍 Troubleshooting

### Common Issues

**1. Provider not found error:**
```tsx
// Make sure to wrap components with Provider
<Provider>
  <Authenticator>
    {/* Your components */}
  </Authenticator>
</Provider>
```

**2. Authentication not working:**
```tsx
// Check service configuration
<Provider
  servicePrincipal="did:web:storacha.network"
  connection={{ url: "https://api.storacha.network" }}
>
  {/* Your components */}
</Provider>
```

**3. Upload failing:**
```tsx
// Check space and account state
const [{ accounts, spaces }] = useW3()
const [{ status, error }] = useUploader()

if (accounts.length === 0) {
  return <div>Please authenticate first</div>
}

if (spaces.length === 0) {
  return <div>No spaces available</div>
}
```

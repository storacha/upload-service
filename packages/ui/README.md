<h1 align="center">
  <a href="https://beta.ui.web3.storage"><img width="250" src="https://bafybeianokbu4dgpfd2mq3za3wejtpscsy25ad6vocmmtxskcq6zig4cuq.ipfs.w3s.link/w3ui-logo-stroke.png" alt="Storacha UI logo" /></a>
</h1>

<h3 align="center">Headless, type-safe, UI components for the Storacha Console Integration Toolkit.</h3>

<p align="center">
  <a href="https://github.com/storacha/upload-service/actions/workflows/test.yaml"><img alt="GitHub Workflow Status" src="https://img.shields.io/github/actions/workflow/status/storacha/upload-service/test.yaml?branch=main&style=for-the-badge" /></a>
  <a href="https://discord.com/channels/806902334369824788/864892166470893588"><img src="https://img.shields.io/badge/chat-discord?style=for-the-badge&logo=discord&label=discord&logoColor=ffffff&color=7389D8" /></a>
  <a href="https://github.com/storacha/upload-service/blob/main/license.md"><img alt="License: Apache-2.0 OR MIT" src="https://img.shields.io/badge/LICENSE-Apache--2.0%20OR%20MIT-yellow?style=for-the-badge" /></a>
</p>

Welcome to the documentation for the Storacha Console Integration Toolkit. This documentation provides everything you need to integrate Storacha's authentication, space(account) and upload-file management capabilities into your applications.

This package contains reusable UI modules for the Storacha service in React and JavaScript, designed to transform `@storacha/ui` from a low-level SDK into a plug-and-play UI toolkit for various applications like DMail, web3mail and DMA-style integrations.

## 🚀 Quick Start

```bash
npm install @storacha/ui-react
```

```tsx
import { Provider, Authenticator, Uploader } from '@storacha/ui-react'

function App() {
  return (
    <Provider>
      <Authenticator>
        <Uploader>
          {/* Your app components */}
        </Uploader>
      </Authenticator>
    </Provider>
  )
}
```

## 📚 Component Suites

### 🔐 Authentication Suite
Complete authentication flow with headless components and hooks.

**Components:**
- `Authenticator` - Root authentication context
- `Authenticator.Form` - Authentication form wrapper
- `Authenticator.EmailInput` - Email input field
- `Authenticator.CancelButton` - Cancel login button

**Hooks:**
- `useAuthenticator()` - Access authentication state and actions
- `useW3()` - Access core Web3 context

### 📁 Upload Suite
File upload components with encryption support and progress tracking.

**Coming soon - [Upload Tool](https://github.com/storacha/upload-service/issues/402)**


### 🏠 Space Management Suite
*Coming soon - [Space creation, management, and access control](https://github.com/storacha/upload-service/issues/401)*

## 📖 Documentation

### Previous Simple Examples

- **Sign up / Sign in** [React](https://github.com/storacha/upload-service/tree/packages/ui/examples/react/sign-up-in)

  Demonstrates email authentication flow for the service, including private key creation and email validation.

- **Single File Upload** [React](https://github.com/storacha/upload-service/tree/packages/ui/examples/react/file-upload)

  The simplest file upload using a file input. Includes the auth flow from "Sign up / Sign in".

- **Multiple File Upload** [React](https://github.com/storacha/upload-service/tree/packages/ui/examples/react/multi-file-upload)

  Slightly more complicated file and directory upload. Includes the auth flow from "Sign up / Sign in".

- **Uploads List** [React](https://github.com/storacha/upload-service/tree/packages/ui/examples/react/uploads-list)

  A demo of the list of uploads that have been made to an account.

## 🔧 Integration Examples

### Dmail Integration
*Coming soon - Email-based authentication with Dmail*

### Web3Mail Integration  
*Coming soon - Web3Mail integration patterns*

### DMA-style Integration
*Coming soon - Decentralized Media App integration examples*

## 🎯 Zero Navigation Context Switch

The toolkit is designed to work seamlessly in both iframe and native contexts:

- **Iframe Support**: Built-in iframe detection and handling
- **Native Integration**: Direct embedding without navigation friction
- **Context Awareness**: Automatic adaptation to hosting environment

## 📦 Packages

- `@storacha/ui-react` - React components and hooks
- `@storacha/ui-core` - Core functionality and types
- `@storacha/ui-example-react-components` - Example styled components

## 🔍 Troubleshooting

### Common Issues

**1. Provider not found error:**
```tsx
// Make sure to wrap components with Provider
<Provider>
  <StorachaAuth>
    {/* Your components */}
  </StorachaAuth>
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

## 📚 Additional Resources

- [GitHub Repository](https://github.com/storacha/upload-service)
- [Issue Tracker](https://github.com/storacha/upload-service/issues)
- [Contributing Guide](https://github.com/storacha/upload-service/blob/main/CONTRIBUTING.md)
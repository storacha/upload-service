<h1 align="center">
  <a href="https://beta.ui.web3.storage"><img width="250" src="https://bafybeianokbu4dgpfd2mq3za3wejtpscsy25ad6vocmmtxskcq6zig4cuq.ipfs.w3s.link/w3ui-logo-stroke.png" alt="Web3.Storage UI logo" /></a>
</h1>

<h3 align="center">Headless, type-safe, UI components for the next generation Web3.Storage APIs.</h3>

<p align="center">
  <a href="https://github.com/web3-storage/w3ui/actions/workflows/test.yaml"><img alt="GitHub Workflow Status" src="https://img.shields.io/github/actions/workflow/status/web3-storage/w3ui/test.yaml?branch=main&style=for-the-badge" /></a>
  <a href="https://discord.com/channels/806902334369824788/864892166470893588"><img src="https://img.shields.io/badge/chat-discord?style=for-the-badge&logo=discord&label=discord&logoColor=ffffff&color=7389D8" /></a>
  <a href="https://github.com/storacha/upload-service/blob/main/license.md"><img alt="License: Apache-2.0 OR MIT" src="https://img.shields.io/badge/LICENSE-Apache--2.0%20OR%20MIT-yellow?style=for-the-badge" /></a>
</p>

This category contains reusable UI modules for the Storacha service with modular architecture supporting framework-agnostic utilities and React components.

## 🚀 Quick Start

```bash
npm install @storacha/ui
```

```tsx
import { Authenticator, Uploader } from '@storacha/ui'

function App() {
  return (
    <div>
      <Authenticator />
      <Uploader />
    </div>
  )
}
```

## 📦 Package Structure

- **`@storacha/ui`** - Meta-package with unified exports
- **`@storacha/ui-core`** - Framework-agnostic utilities, hooks, and services  
- **`@storacha/ui-react`** - React components and bindings
- **`@storacha/ui-tailwind`** - Tailwind CSS plugin with design tokens
- **`@storacha/ui-theme`** - Theme utilities and CSS variables

## 🎨 Features

- **Modular Architecture**: Import only what you need
- **Tree-Shakeable**: Component-level imports supported
- **Type-Safe**: Full TypeScript support with proper exports
- **Themeable**: Built-in dark/light mode with CSS variables
- **Framework Agnostic Core**: Use utilities in any framework
- **Tailwind Integration**: Pre-built design system

## 📖 Documentation

See [USAGE.md](./USAGE.md) for detailed usage instructions and examples.

### Examples

- **Sign up / Sign in** [React](https://github.com/storacha/upload-service/tree/packages/ui/examples/react/sign-up-in)

  Demonstrates email authentication flow for the service, including private key creation and email validation.

- **Single File Upload** [React](https://github.com/storacha/upload-service/tree/packages/ui/examples/react/file-upload)

  The simplest file upload using a file input. Includes the auth flow from "Sign up / Sign in".

- **Multiple File Upload** coming soon! [React](https://github.com/storacha/upload-service/tree/packages/ui/examples/react/multi-file-upload)

  Slightly more complicated file and directory upload. Includes the auth flow from "Sign up / Sign in".

- **Uploads List** coming soon! [React](https://github.com/storacha/upload-service/tree/packages/ui/examples/react/uploads-list)

  A demo of the list of uploads that have been made to an account.

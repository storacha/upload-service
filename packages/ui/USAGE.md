# Storacha UI Usage Guide

## Installation

### Meta Package (Recommended)
```bash
npm install @storacha/ui
```

### Individual Packages
```bash
# Core utilities only
npm install @storacha/ui-core

# React components only
npm install @storacha/ui-react

# Tailwind plugin
npm install @storacha/ui-tailwind

# Theme utilities
npm install @storacha/ui-theme
```

## Usage

### Basic Usage with Meta Package

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

### Component-Level Imports (Tree-Shakeable)

```tsx
// Import specific components
import { Authenticator } from '@storacha/ui/react/components/Authenticator'
import { Uploader } from '@storacha/ui/react/components/Uploader'

// Or import from subpaths
import { Authenticator } from '@storacha/ui-react/components/Authenticator'
```

### Core Utilities Only

```ts
import { useAuthenticator, useUploader } from '@storacha/ui-core'

// Framework-agnostic usage
const auth = useAuthenticator()
const uploader = useUploader()
```

### Tailwind Integration

```js
// tailwind.config.js
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  plugins: [
    require('@storacha/ui-tailwind'),
  ],
}
```

### Theme Usage

```tsx
import { applyTheme, useAutoTheme } from '@storacha/ui-theme'

// Apply theme manually
applyTheme('dark')

// Auto theme based on system preference
useAutoTheme()

// In React component
function ThemeToggle() {
  const [theme, setTheme] = useState('light')
  
  useEffect(() => {
    applyTheme(theme)
  }, [theme])
  
  return (
    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      Toggle Theme
    </button>
  )
}
```

## Package Structure

```
@storacha/ui/
├── core/           # Framework-agnostic utilities
├── react/          # React components and hooks
├── tailwind/       # Tailwind CSS plugin
└── theme/          # Theme utilities and tokens
```

## Subpath Exports

- `@storacha/ui` - Meta package with all exports
- `@storacha/ui/core` - Core utilities
- `@storacha/ui/react` - React components
- `@storacha/ui/react/components/*` - Individual components
- `@storacha/ui/tailwind` - Tailwind plugin
- `@storacha/ui/theme` - Theme utilities

## TypeScript Support

All packages include full TypeScript definitions with proper tree-shaking support.

```tsx
import type { AuthenticatorProps } from '@storacha/ui'
import type { UploaderContextState } from '@storacha/ui-core'
```
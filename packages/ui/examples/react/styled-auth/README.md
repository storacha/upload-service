# Styled Auth Example

This example demonstrates **plug-and-play authentication** using `@storacha/ui-react-styled` with console-exact UI.

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Run Development Server

```bash
pnpm dev
```

That's it! Open your browser to see the console-exact authentication flow.

## Implementation

### Minimal Setup

```tsx
import { Provider } from '@storacha/ui-react'
import { StorachaAuth } from '@storacha/ui-react-styled'
import '@storacha/ui-react-styled/styles.css'

function App() {
  return (
    <Provider>
      <StorachaAuth>
        <StorachaAuth.Ensurer>
          <YourApp />
        </StorachaAuth.Ensurer>
      </StorachaAuth>
    </Provider>
  )
}
```

## Features

### Built-in Features

- 📧 **Email-based authentication**
- ✅ **Email verification flow**
- 🔄 **Session persistence**
- 🪟 **Iframe support**
- 📊 **Analytics events**
- 🎨 **Console-exact styling**

### What's Included

- Pre-styled form components
- Loading states
- Email verification screen
- Error handling
- Mobile responsive
- Accessibility features

## Available Props

### StorachaAuth

```tsx
interface StorachaAuthProps {
  children?: ReactNode
  appName?: string
  enableIframeSupport?: boolean
  onAuthEvent?: (event: string, properties?: any) => void
  termsUrl?: string
  serviceName?: string
}
```

### Event Tracking

Track authentication events for analytics:

```tsx
<StorachaAuth
  onAuthEvent={(event, properties) => {
    // Send to your analytics service
    analytics.track(event, properties)
  }}
>
```

Events emitted:
- `Login Authorization Requested`
- `Login Successful`
- `Login Failed`
- `Login Authorization Cancelled`

## Assets Required

The styled components expect these assets in your `/public` folder:

- `storacha-logo.svg` - Storacha logo
- `racha-fire.jpg` - Background image

These are included in this example's `public/` folder.

## Learn More

- [Storacha Documentation](https://docs.storacha.network)
- [GitHub Repository](https://github.com/storacha/upload-service)

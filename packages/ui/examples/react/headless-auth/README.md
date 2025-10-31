# Headless Auth Example

This example demonstrates how to use `@storacha/ui-react` **headless components** with completely custom styling.

## What is Headless?

Headless components provide all the authentication logic, state management, and event handling **without any built-in styling**. This gives you complete control over the appearance while leveraging Storacha's authentication functionality.

## Features Demonstrated

- 🎨 **Custom Styling**: Chakra UI-inspired design system
- 🎯 **Render Props**: Full control over component rendering
- 🔧 **Headless Components**: No CSS dependencies from Storacha
- ⚡ **Full Functionality**: Complete auth flow with custom UI

## Key Concepts

### Using Headless Components

```tsx
import { StorachaAuth } from '@storacha/ui-react'

// Provide your own className and styles
<StorachaAuth.Form
  className="my-custom-form"
  renderLogo={() => <YourLogo />}
  renderSubmitButton={(disabled) => (
    <button disabled={disabled}>Sign In</button>
  )}
/>
```

### Component Composition

All components accept:
- `className` - Custom CSS classes
- `style` - Inline styles
- `render*` props - Custom render functions

### Available Components

- `StorachaAuth.Form` - Main authentication form
- `StorachaAuth.EmailInput` - Email input field
- `StorachaAuth.Submitted` - Post-submission state
- `StorachaAuth.CancelButton` - Cancel button
- `StorachaAuth.Ensurer` - Authentication flow controller

## Running This Example

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

## Styling Approaches

This example uses vanilla CSS, but you can use any styling solution:

- ✅ Tailwind CSS
- ✅ Emotion / styled-components
- ✅ CSS Modules
- ✅ Chakra UI / MUI
- ✅ Your own CSS

## Learn More

- [Storacha Documentation](https://docs.storacha.network)
- [API Reference](https://github.com/storacha/upload-service)



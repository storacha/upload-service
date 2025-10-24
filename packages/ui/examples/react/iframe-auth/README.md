# Iframe Auth Example

This example demonstrates **iframe integration** for Storacha authentication in partner applications.

## What This Shows

🔗 **Iframe Embedding** - How to embed Storacha auth in your app  
🔍 **Auto Detection** - Automatic iframe context detection  
🔄 **Session Handoff** - Seamless authentication flow  
💬 **Message Passing** - Secure communication between frames

## Running the Example

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Open your browser to see both:
1. **Host Page** - Your application that embeds the iframe
2. **Iframe Content** - Storacha authentication experience

## How It Works

### 1. Iframe Detection

The auth component automatically detects when it's running in an iframe:

```tsx
const isIframe = typeof window !== 'undefined' 
  && window.self !== window.top
```

### 2. Enable Iframe Support

Simply enable iframe support in your StorachaAuth component:

```tsx
<StorachaAuth enableIframeSupport={true}>
  <StorachaAuth.Ensurer>
    <YourApp />
  </StorachaAuth.Ensurer>
</StorachaAuth>
```

### 3. Embed in Your App

In your host application, embed the iframe:

```html
<iframe
  src="https://console.storacha.network/auth"
  width="100%"
  height="600"
  allow="clipboard-write"
  sandbox="allow-same-origin allow-scripts allow-forms"
/>
```

## Features

### Automatic Handling

✅ **Iframe Detection** - Knows when it's embedded  
✅ **Loading States** - Proper loading UI in iframe  
✅ **Session Management** - Persistent across reloads  
✅ **Message Passing** - Secure parent-iframe communication

### Security

- Secure message channel setup
- Origin validation
- Session token handling
- CORS-compliant

## Implementation Details

### Host Application

Your application that embeds Storacha:

```tsx
function HostApp() {
  return (
    <div className="my-app">
      <h1>My Application</h1>
      <iframe
        src="https://your-storacha-auth-url"
        width="500"
        height="600"
      />
    </div>
  )
}
```

### Iframe Content

Storacha authentication running inside:

```tsx
function IframeAuth() {
  return (
    <Provider>
      <StorachaAuth enableIframeSupport={true}>
        <StorachaAuth.Ensurer>
          <AuthenticatedContent />
        </StorachaAuth.Ensurer>
      </StorachaAuth>
    </Provider>
  )
}
```

## Session Persistence

Authentication state persists across:
- Page reloads
- Navigation
- Iframe remounts
- Browser sessions (if enabled)

## Events

Track iframe authentication events:

```tsx
<StorachaAuth
  enableIframeSupport={true}
  onAuthEvent={(event, properties) => {
    // These events can be sent to parent window
    window.parent.postMessage({
      type: 'storacha-auth',
      event,
      properties
    }, '*')
  }}
>
```

## Learn More

- [Storacha Documentation](https://docs.storacha.network)
- [MDN: Using iframes](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe)


# @storacha/ui-react

React adapter for the Storacha Console Integration Toolkit. Provides headless components and hooks for building authentication and file upload functionality.

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

## 📚 Components

### Authentication

- **`Authenticator`** - Root authentication context
- **`Authenticator.Form`** - Authentication form wrapper
- **`Authenticator.EmailInput`** - Email input field
- **`Authenticator.CancelButton`** - Cancel login button

### Upload

- to be included

## 🔐 Authentication Example



## 📁 Upload Example

**Coming soon - [Upload Tool](https://github.com/storacha/upload-service/issues/402)**

## 🖼 Iframe Support

The components work seamlessly in iframe contexts:

```html
<iframe 
  src="https://your-app.com/storacha-auth" 
  width="400" 
  height="600"
  frameborder="0">
</iframe>
```

## 🧪 Testing

--

## 📦 TypeScript Support

Full TypeScript support with comprehensive type definitions:

--

## 🔗 Related Packages

- `@storacha/ui-core` - Core functionality and types
- `@storacha/ui-example-react-components` - Example styled components

## 🤝 Contributing

Feel free to join in. All welcome. Please read our [contributing guidelines](https://github.com/storacha/upload-service/blob/main/CONTRIBUTING.md) and/or [open an issue](https://github.com/storacha/upload-service/issues)!

## 📄 License

Dual-licensed under [MIT + Apache 2.0](https://github.com/storacha/upload-service/blob/main/license.md)

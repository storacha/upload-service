# Upload Tool Example

This example demonstrates how to use the `UploadTool` component from `@storacha/ui-react` to create a complete, production-ready upload interface for your Web3 application.

## Features

The `UploadTool` component provides:

- **Type Selection**: Choose between File, Directory, or CAR uploads
- **Drag & Drop**: Intuitive drag-and-drop interface
- **Upload Progress**: Real-time upload progress display
- **Success State**: Display uploaded CID with "Upload Another" option
- **Options**: Configurable "Wrap In Directory" for single file uploads
- **Information**: Built-in explanations about public/permanent data storage
- **Customizable**: Optional styling overrides and configuration

## Getting Started

### Installation

```bash
npm install @storacha/ui-react
```

### Basic Usage

```tsx
import { Provider, Authenticator, UploadTool } from '@storacha/ui-react'

function App() {
  return (
    <Provider>
      <Authenticator>
        <UploadTool
          onUploadComplete={({ dataCID }) => {
            console.log('Upload complete:', dataCID.toString())
          }}
        />
      </Authenticator>
    </Provider>
  )
}
```

### Advanced Usage

```tsx
import { Provider, Authenticator, UploadTool } from '@storacha/ui-react'

function App() {
  return (
    <Provider>
      <Authenticator>
        <UploadTool
          onUploadComplete={({ dataCID }) => {
            console.log('Upload complete:', dataCID.toString())
          }}
          showTypeSelector={true}
          showOptions={true}
          showExplain={true}
          gatewayUrl="https://w3s.link/ipfs"
          styles={{
            container: { backgroundColor: '#f5f5f5' },
            heading: { color: '#333' },
          }}
        />
      </Authenticator>
    </Provider>
  )
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onUploadComplete` | `(props: OnUploadCompleteProps) => void` | - | Callback fired when upload completes |
| `space` | `any` | - | Space object for private space support |
| `showTypeSelector` | `boolean` | `true` | Show/hide the type selector (File/Directory/CAR) |
| `showOptions` | `boolean` | `true` | Show/hide the options section |
| `showExplain` | `boolean` | `true` | Show/hide the explain section |
| `gatewayUrl` | `string` | `'https://w3s.link/ipfs'` | IPFS gateway URL for viewing uploads |
| `styles` | `object` | - | Custom styles for container, heading, dropZone, button |

## Running This Example

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

## Integration Tips

### 1. **Minimal Setup**

The component works out-of-the-box with sensible defaults:

```tsx
<UploadTool />
```

### 2. **Hide Unnecessary UI**

For simpler use cases, hide the type selector or options:

```tsx
<UploadTool
  showTypeSelector={false}
  showOptions={false}
  showExplain={false}
/>
```

### 3. **Custom Styling**

Override default styles to match your brand:

```tsx
<UploadTool
  styles={{
    container: { 
      border: '2px solid #yourColor',
      backgroundColor: '#yourBg'
    },
    heading: { color: '#yourColor' },
  }}
/>
```

### 4. **Track Uploads**

Use `onUploadComplete` to track successful uploads:

```tsx
const [uploads, setUploads] = useState([])

<UploadTool
  onUploadComplete={({ dataCID, file }) => {
    setUploads(prev => [...prev, { cid: dataCID, filename: file?.name }])
  }}
/>
```

## Learn More

- [Storacha Documentation](https://docs.storacha.network)
- [@storacha/ui-react Package](../../packages/react)
- [More Examples](../)


import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'

export default function ThemingPage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Theming System</h1>
        
        <p>
          Console Toolkit features a powerful theming system that allows you to customize the look 
          and feel of your application while maintaining consistency with Storacha's design language.
        </p>

        <h2>Color System</h2>

        <p>
          The toolkit uses Storacha's signature color palette, which includes vibrant accent colors 
          and a carefully crafted neutral scale for optimal readability and accessibility.
        </p>

        <h3>Primary Colors</h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 not-prose my-6">
          <div className="text-center">
            <div className="w-full h-16 bg-hot-red rounded-lg mb-2"></div>
            <div className="text-sm font-medium">Hot Red</div>
            <div className="text-xs text-gray-500">#E91315</div>
          </div>
          <div className="text-center">
            <div className="w-full h-16 bg-hot-yellow rounded-lg mb-2"></div>
            <div className="text-sm font-medium">Hot Yellow</div>
            <div className="text-xs text-gray-500">#FFC83F</div>
          </div>
          <div className="text-center">
            <div className="w-full h-16 bg-hot-blue rounded-lg mb-2"></div>
            <div className="text-sm font-medium">Hot Blue</div>
            <div className="text-xs text-gray-500">#0176CE</div>
          </div>
          <div className="text-center">
            <div className="w-full h-16 bg-gray-dark rounded-lg mb-2"></div>
            <div className="text-sm font-medium">Gray Dark</div>
            <div className="text-xs text-gray-500">#1d2027</div>
          </div>
        </div>

        <h2>Dark Mode Support</h2>

        <p>
          Console Toolkit comes with built-in dark mode support. The theme automatically adapts 
          colors, shadows, and other visual elements for optimal viewing in low-light conditions.
        </p>

        <pre><code>{`import { ThemeProvider } from '@storacha/console-toolkit'

function App() {
  return (
    <ThemeProvider defaultTheme="dark" enableSystem>
      {/* Your app content */}
    </ThemeProvider>
  )
}`}</code></pre>

        <h3>Theme Toggle Component</h3>

        <p>
          You can easily add a theme toggle button to allow users to switch between light and dark modes:
        </p>

        <pre><code>{`import { ThemeToggle } from '@storacha/console-toolkit'

function Header() {
  return (
    <header className="flex justify-between items-center p-4">
      <h1>My App</h1>
      <ThemeToggle />
    </header>
  )
}`}</code></pre>

        <h2>Custom Themes</h2>

        <p>
          You can create custom themes by extending the default theme configuration. This allows you 
          to maintain brand consistency while leveraging the toolkit's component library.
        </p>

        <pre><code>{`// theme.config.js
const customTheme = {
  colors: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      // ... rest of color scale
      900: '#1e3a8a',
    },
    // Override default colors
    'hot-red': '#dc2626',
    'hot-blue': '#2563eb',
  },
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'monospace'],
  },
  spacing: {
    '18': '4.5rem',
    '88': '22rem',
  }
}

export default customTheme`}</code></pre>

        <h2>CSS Custom Properties</h2>

        <p>
          The theming system uses CSS custom properties (variables) for dynamic theming. This enables 
          smooth transitions between themes and runtime theme switching.
        </p>

        <pre><code>{`:root {
  --color-primary: 14 165 233;
  --color-primary-foreground: 255 255 255;
  --color-background: 255 255 255;
  --color-foreground: 15 23 42;
}

[data-theme="dark"] {
  --color-primary: 59 130 246;
  --color-primary-foreground: 15 23 42;
  --color-background: 15 23 42;
  --color-foreground: 248 250 252;
}`}</code></pre>

        <h2>Component Customization</h2>

        <p>
          Individual components can be customized using the <code>className</code> prop or by 
          creating custom variants:
        </p>

        <pre><code>{`// Custom button variant
<Button 
  variant="custom"
  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
>
  Gradient Button
</Button>

// Using CSS-in-JS
const StyledButton = styled(Button)\`
  background: linear-gradient(45deg, #fe6b8b 30%, #ff8e53 90%);
  border-radius: 3px;
  border: 0;
  color: white;
  height: 48px;
  padding: 0 30px;
\``}</code></pre>

        <blockquote>
          <p>
            <strong>Design Token Tip:</strong> Use the design tokens provided by the theme system 
            to maintain consistency across your custom components. This ensures your customizations 
            work well with both light and dark modes.
          </p>
        </blockquote>
      </MDXContent>
    </Layout>
  )
}

import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'

export default function QuickStartPage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Quick Start Guide</h1>
        
        <p>
          Get up and running with Console Toolkit in just a few minutes. This guide will walk you through 
          the installation process and help you create your first console application.
        </p>

        <h2>Installation</h2>
        
        <p>Install Console Toolkit using your preferred package manager:</p>

        <pre><code>npm install @storacha/console-toolkit</code></pre>

        <p>Or with yarn:</p>

        <pre><code>yarn add @storacha/console-toolkit</code></pre>

        <p>Or with pnpm:</p>

        <pre><code>pnpm add @storacha/console-toolkit</code></pre>

        <h2>Basic Setup</h2>

        <p>
          Once installed, you can start using Console Toolkit components in your React application. 
          Here's a simple example to get you started:
        </p>

        <pre><code>{`import React from 'react'
import { Layout, Button, Card } from '@storacha/console-toolkit'

function App() {
  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">
          Welcome to Console Toolkit
        </h1>
        
        <Card className="mb-6">
          <h2 className="text-lg font-semibold mb-2">
            Your First Card
          </h2>
          <p className="text-gray-600 mb-4">
            This is a simple card component styled with 
            Console Toolkit's design system.
          </p>
          <Button variant="primary">
            Get Started
          </Button>
        </Card>
      </div>
    </Layout>
  )
}

export default App`}</code></pre>

        <h2>Theme Configuration</h2>

        <p>
          Console Toolkit comes with built-in dark mode support. To enable theme switching, 
          wrap your application with the <code>ThemeProvider</code>:
        </p>

        <pre><code>{`import { ThemeProvider } from '@storacha/console-toolkit'

function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      {/* Your app content */}
    </ThemeProvider>
  )
}`}</code></pre>

        <h2>Next Steps</h2>

        <p>Now that you have Console Toolkit installed and configured, you can:</p>

        <ul>
          <li><a href="/components">Explore the component library</a></li>
          <li><a href="/styling/theming">Learn about theming and customization</a></li>
          <li><a href="/api/core">Check out the API reference</a></li>
          <li><a href="/advanced/performance">Optimize for performance</a></li>
        </ul>

        <blockquote>
          <p>
            <strong>Tip:</strong> Console Toolkit is designed to work seamlessly with existing React applications. 
            You can gradually adopt components as needed without requiring a complete rewrite.
          </p>
        </blockquote>
      </MDXContent>
    </Layout>
  )
}

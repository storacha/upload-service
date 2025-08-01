/**
 * Test Iframe Layout - Simulates Partner Environment
 * 
 * This layout is intentionally minimal and does NOT include W3UIProvider
 * because it simulates how partners would integrate the iframe into their
 * own applications (which won't have our providers).
 * 
 * NOTE: This layout will be nested within the root app/layout.tsx.
 * It should NOT define its own <html>, <head>, or <body> tags.
 */

import { ReactNode } from 'react'

export default function TestIframeLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div style={{ 
      fontFamily: 'system-ui, sans-serif',
      padding: '20px',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      <header style={{ marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
        <h1 style={{ margin: 0, color: '#333' }}>Partner Integration Test Environment</h1>
        <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '14px' }}>
          This simulates how partners would integrate the Storacha iframe into their applications
        </p>
      </header>
      {children}
    </div>
  )
}
import { NextRequest, NextResponse } from 'next/server'

const getFrameAncestorsHeader = (() => {
  let cachedHeader: string | null = null
  
  return (): string => {
    if (cachedHeader !== null) {
      return cachedHeader
    }

    // Get allowed origins from environment variable (same logic as IframeAuthenticator)
    const envOrigins = process.env.NEXT_PUBLIC_SSO_ALLOWED_ORIGINS
    
    // Start with default origins for development, staging, and production
    let allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000', 
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'https://console.storacha.network',
      'https://staging.console.storacha.network'
    ]
    
    if (envOrigins) {
      // Parse comma-separated origins from environment variable and add unique ones
      const envOriginsList = envOrigins
        .split(',')
        .map(origin => origin.trim())
        .filter(origin => origin && !allowedOrigins.includes(origin))
      
      allowedOrigins = [...allowedOrigins, ...envOriginsList]
    }

    // Convert origins to CSP frame-ancestors format and cache it
    const frameAncestors = ["'self'", ...allowedOrigins].join(' ')
    cachedHeader = frameAncestors
    
    // Log once when first computed
    console.log(`CSP frame-ancestors initialized: ${frameAncestors}`)
    
    return cachedHeader
  }
})()

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Get the cached frame-ancestors header
  const frameAncestors = getFrameAncestorsHeader()
  
  // Set Content-Security-Policy header with frame-ancestors directive
  response.headers.set(
    'Content-Security-Policy',
    `frame-ancestors ${frameAncestors}`
  )

  return response
}

// Configure which routes to run middleware on
export const config = {
  // Run on all routes except static files and API routes
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
} 
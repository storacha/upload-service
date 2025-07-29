import { NextRequest, NextResponse } from 'next/server'
import { getAllowedOrigins, isOriginAllowed } from './src/lib/sso-origins'

const getFrameAncestorsHeader = (() => {
  let cachedHeader: string | null = null
  
  return (): string => {
    if (cachedHeader !== null) {
      return cachedHeader
    }

    // Get allowed origins from shared utility
    const allowedOrigins = getAllowedOrigins()

    // Convert origins to CSP frame-ancestors format and cache it
    const frameAncestors = ["'self'", ...allowedOrigins].join(' ')
    cachedHeader = frameAncestors
    
    // Log once when first computed
    console.log(`CSP frame-ancestors initialized: ${frameAncestors}`)
    
    return cachedHeader
  }
})()

export function middleware(request: NextRequest) {
  // Log iframe embedding requests for monitoring
  const referer = request.headers.get('referer')
  const secFetchDest = request.headers.get('sec-fetch-dest')
  
  // Monitor iframe embedding attempts (for logging/analytics, not blocking)
  if (secFetchDest === 'iframe' && referer) {
    try {
      const refererUrl = new URL(referer)
      const refererOrigin = refererUrl.origin
      
      if (!isOriginAllowed(refererOrigin)) {
        // Log unauthorized embedding attempts but let CSP handle the blocking
        console.warn(`Iframe embedding attempt from unauthorized origin: ${refererOrigin}`)
      } else {
        console.log(`Iframe embedding from authorized origin: ${refererOrigin}`)
      }
    } catch (error) {
      console.debug('Could not parse referer URL:', error)
    }
  }

  const response = NextResponse.next()

  // Get the cached frame-ancestors header
  const frameAncestors = getFrameAncestorsHeader()
  
  // Set Content-Security-Policy header with frame-ancestors directive
  // This is the primary security mechanism - browser will enforce the policy
  response.headers.set(
    'Content-Security-Policy',
    `frame-ancestors ${frameAncestors}`
  )
  
  // Add additional security headers
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // For SSO iframe routes, add specific headers
  if (request.nextUrl.pathname.includes('sso') || request.nextUrl.searchParams.has('sso')) {
    response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  }

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
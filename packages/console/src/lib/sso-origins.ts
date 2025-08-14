/**
 * Shared utility for managing SSO allowed origins
 * Used by both IframeAuthenticator and middleware for consistency
 */

/**
 * Get the list of allowed origins for SSO embedding
 * Combines default origins with environment variable overrides
 */
export function getAllowedOrigins(): string[] {
  const envOrigins = process.env.NEXT_PUBLIC_SSO_ALLOWED_ORIGINS
  
  // Start with default origins for development, staging, and production
  let origins = [
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
      .filter(origin => origin && !origins.includes(origin))
    
    origins = [...origins, ...envOriginsList]
  }
  
  return origins
}

/**
 * Check if an origin is allowed for SSO embedding
 * Supports exact matches and wildcard subdomain matches
 */
export function isOriginAllowed(origin: string, allowedOrigins?: string[]): boolean {
  const origins = allowedOrigins || getAllowedOrigins()
  
  return origins.some(allowedOrigin => {
    // Exact match or wildcard subdomain match
    if (allowedOrigin === origin) return true
    if (allowedOrigin.startsWith('*.')) {
      const domain = allowedOrigin.slice(2)
      return origin.endsWith('.' + domain) || origin.endsWith('://' + domain)
    }
    return false
  })
} 
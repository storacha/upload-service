
import * as Sentry from '@sentry/nextjs'

/**
 * Log to the error console and capture the error in Sentry.
 * 
 * @param err the error - typed as unknown to match catch(err)
 */
export function logAndCaptureError (err: unknown) {
  console.error(err)
  Sentry.captureException(err)
}
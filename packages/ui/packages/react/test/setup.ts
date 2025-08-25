// Mock Sentry to prevent test failures
import { vi } from 'vitest'

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  init: vi.fn(),
  configureScope: vi.fn(),
  withScope: vi.fn(),
}))

// Mock Next.js error component
vi.mock('next/error', () => ({
  default: ({ statusCode }: { statusCode: number }) => `<div>Error ${statusCode}</div>`,
}))

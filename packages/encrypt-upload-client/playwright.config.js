import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './test',
  testMatch: '**/*.playwright.spec.js',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false, // Disable parallel execution for secure server tests
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Use single worker to avoid port conflicts
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    // Enable Web Crypto API by using secure context
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        // Firefox configuration for HTTPS and Web Crypto API
        launchOptions: {
          firefoxUserPrefs: {
            'dom.security.https_first': false,
            'security.tls.insecure_fallback_hosts': 'localhost',
          },
        },
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        // Safari/WebKit configuration for HTTPS and Web Crypto API
      },
    },
  ],
})

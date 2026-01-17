import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './test',
  testMatch: '**/*.playwright.spec.js',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  // Use global setup/teardown for server lifecycle management
  globalSetup: './test/mocks/playwright/global-setup.js',
  globalTeardown: './test/mocks/playwright/global-teardown.js',
  fullyParallel: false, // Disable parallel execution for secure server tests
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Use single worker to avoid port conflicts
  reporter: process.env.CI ? 'list' : 'html',
  // Global timeout to prevent infinite hangs in CI
  globalTimeout: process.env.CI ? 5 * 60 * 1000 : undefined, // 5 minutes max
  use: {
    // Disable trace in CI to avoid keeping file handles open
    trace: process.env.CI ? 'off' : 'on-first-retry',
    // Enable Web Crypto API by using secure context
    ignoreHTTPSErrors: true,
    // Set navigation timeout
    navigationTimeout: 10000,
    // Set action timeout
    actionTimeout: 10000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Force browser to close quickly
        launchOptions: {
          args: process.env.CI
            ? ['--disable-dev-shm-usage', '--no-sandbox']
            : [],
        },
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

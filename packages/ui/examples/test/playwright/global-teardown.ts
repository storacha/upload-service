import type { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  if (process.env.CI) {
    console.log('[Global Teardown] CI detected. Forcing process exit to prevent hangs.');
    // Force exit to ensure no lingering processes (like webServer) keep the CI job alive
    process.exit();
  }
}

export default globalTeardown;

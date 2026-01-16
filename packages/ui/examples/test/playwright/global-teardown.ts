import type { FullConfig } from '@playwright/test';
import { execSync } from 'node:child_process';

async function globalTeardown(config: FullConfig) {
  if (process.env.CI) {
    console.log('[Global Teardown] CI detected. Cleanup started.');
    
    try {
      console.log('Attempting to kill process on port 1337...');
      // fuser -k 1337/tcp kills the process listening on port 1337 (TCP)
      // Standard tool available on Ubuntu CI runners
      execSync('fuser -k 1337/tcp');
      console.log('Successfully killed process on port 1337.');
    } catch (error) {
      // fuser returns non-zero if no process was found/killed, which is fine
      console.log('No process found on port 1337 or failed to kill.');
    }

    console.log('Forcing process exit to prevent hangs.');
    // Force exit to ensure no lingering processes (like webServer) keep the CI job alive
    process.exit();
  }
}

export default globalTeardown;

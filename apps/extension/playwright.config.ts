import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  globalSetup: './tests/global-playwright-setup.js',
  testDir: './tests',
  // The cat21-chain/ chain-truth specs need a live regtest stack (bitcoind +
  // electrs + cat21-ord) and run via playwright.chain.config.ts, NOT here. The
  // CI caps lane invokes `playwright test tests/specs/cat21`, whose path filter
  // also prefix-matches `tests/specs/cat21-chain/`; ignore them so that lane
  // never tries to run them without the stack.
  testIgnore: ['**/cat21-chain/**'],
  timeout: 30 * 1000,
  expect: { timeout: 5000 },
  // Extensions live cross-worker meaning `chrome.storage` is shared. Disabling
  // `fullyParallel` means fewer tests run at the same time, but ensures a
  // truely new context is used each time
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    [process.env.CI ? 'github' : 'list'],
    [process.env.CI ? 'blob' : 'html', { open: 'never' }],
  ],
  use: {
    // Traces are heavy so we want to use them sparingly, but having full trace
    // to reference of the latest dev build is useful to inspect.
    trace: process.env.BRANCH_NAME === 'dev' ? 'on' : 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev:test-app',
    port: 3000,
    timeout: 15000,
  },
});

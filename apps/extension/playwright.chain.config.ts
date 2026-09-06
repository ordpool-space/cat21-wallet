import { defineConfig, devices } from '@playwright/test';

/**
 * Chain-truth E2E config: drives the real wallet UI against a live regtest
 * chain (bitcoind + electrs + cat21-ord from ordpool-sdk/e2e/docker-compose.regtest.yml).
 *
 * Differs from `playwright.config.ts` in two ways:
 *   - NO `webServer`. The default config starts `dev:test-app` on :3000 to
 *     serve a dapp for the window-provider RPC specs. The chain specs never
 *     touch a dapp — they click the wallet's own popup UI — and :3000 is
 *     owned by electrs here, so a webServer would collide.
 *   - Scoped to `tests/specs/cat21-chain/`. Real fund → build → sign →
 *     broadcast → mine → index round-trips are minutes-long, so the timeout
 *     is generous and these never run in the fast unit/integration lane.
 *
 * Run locally (the regtest stack must be up first — see the spec header):
 *   PW_CHROMIUM_EXE=~/Library/Caches/ms-playwright/chromium-1234/chrome-mac/Chromium.app/Contents/MacOS/Chromium \
 *     pnpm --filter @leather.io/extension exec playwright test --config playwright.chain.config.ts
 */
export default defineConfig({
  globalSetup: './tests/global-playwright-setup.js',
  testDir: './tests/specs/cat21-chain',
  // Real on-chain round-trips (fund, mine, electrs sync, cat21-ord index)
  // are slow; give each test room without inviting hangs.
  timeout: 180 * 1000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [[process.env.CI ? 'github' : 'list']],
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

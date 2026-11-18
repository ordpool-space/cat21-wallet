import { BrowserContext, Page, test as base, chromium } from '@playwright/test';
import { GlobalPage } from '@tests/page-object-models/global.page';
import { HomePage } from '@tests/page-object-models/home.page';
import { NetworkPage } from '@tests/page-object-models/network.page';
import { OnboardingPage } from '@tests/page-object-models/onboarding.page';
import { SendPage } from '@tests/page-object-models/send.page';
import { SettingsPage } from '@tests/page-object-models/settings.page';
import { SwapPage } from '@tests/page-object-models/swap.page';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { installLiveNetStubs, liveNetKey } from './live-net-stubs';

interface TestFixtures {
  context: BrowserContext;
  page: Page;
  extensionId: string;
  globalPage: GlobalPage;
  homePage: HomePage;
  onboardingPage: OnboardingPage;
  sendPage: SendPage;
  swapPage: SwapPage;
  networkPage: NetworkPage;
  settingsPage: SettingsPage;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Loads the extension into the browser context. Use this test function with
 * Playwright to avoid having to manually load the extension into the browser
 * context in each test. Created by following,
 * https://playwright.dev/docs/chrome-extensions
 */
export const test = base.extend<TestFixtures>({
  // Playwright always needs object destructuring for fixtures https://github.com/microsoft/playwright/issues/14590
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use, testInfo) => {
    const pathToExtension = path.join(__dirname, '../../dist');
    /* HACK -- Cat21: PW_CHROMIUM_EXE lets a local run point at an
       already-installed Chrome-for-Testing binary (e.g. a newer revision
       than the one @playwright/test bundles) so the real-extension suite
       runs without re-downloading the pinned build. Unset in CI, where the
       bundled browser is provisioned fresh, so CI behaviour is unchanged.
       On macOS the Linux-only `--use-gl=egl` crashes the GPU process, so it
       is dropped when an override binary is supplied (local dev). */
    const overrideExe = process.env.PW_CHROMIUM_EXE || undefined;
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      permissions: ['clipboard-read'],
      ...(overrideExe ? { executablePath: overrideExe } : {}),
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        ...(overrideExe ? [] : ['--use-gl=egl']),
      ],
    });
    /* HACK -- Cat21: live-network guard (audit T11). HQ: no test talks to a
       real system. `installLiveNetStubs` answers every non-local request no
       spec route handled, from captured fixtures, and reports the ones it has
       no fixture for. Independently, every finished request whose RESPONSE
       came from a non-loopback peer is live: a route-fulfilled response has no
       server address, so a stub or a spec's rewrite to a local service is not
       live, and only traffic that bypassed every route is. Either kind fails
       the test at teardown, with no allowance for "expected" hosts. Each
       test also gets the list attached and prints one LIVE-NET line. */
    const liveRequests = new Set<string>();
    const unstubbedRequests = new Set<string>();
    const pending: Promise<void>[] = [];
    await installLiveNetStubs(context, key => unstubbedRequests.add(key));
    context.on('requestfinished', request => {
      const url = new URL(request.url());
      if (!url.protocol.startsWith('http')) return;
      const key = liveNetKey(request.method(), url);
      pending.push(
        (async () => {
          const response = await request.response();
          const peer = response ? await response.serverAddr() : null;
          if (peer == null) return; // fulfilled by a route, never left the box
          if (peer.ipAddress === '127.0.0.1' || peer.ipAddress === '::1') return;
          liveRequests.add(key);
        })().catch(() => {
          // The response could not be read (e.g. its page closed): keep the
          // entry, marked, rather than lose a request that may have been live.
          liveRequests.add(`${key} (unresolved)`);
        })
      );
    });
    await use(context);
    await Promise.all(pending);
    const live = [...liveRequests].sort();
    const unstubbed = [...unstubbedRequests].sort();
    await testInfo.attach('live-network-requests', {
      body: JSON.stringify({ live, unstubbed }, null, 2),
      contentType: 'application/json',
    });
    // eslint-disable-next-line no-console
    console.log(
      `LIVE-NET ${testInfo.titlePath.join(' > ')} :: ${JSON.stringify({ live, unstubbed })}`
    );
    await context.close();
    await context.browser()?.close();
    if (live.length > 0 || unstubbed.length > 0) {
      throw new Error(
        `This test reached the network outside the stubs (tests/fixtures/live-net-stubs.ts). ` +
          `Live: ${JSON.stringify(live)}. Unstubbed (aborted): ${JSON.stringify(unstubbed)}.`
      );
    }
  },
  page: async ({ context }, use) => {
    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `,
    });
    await use(page);
  },
  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background) background = await context.waitForEvent('serviceworker');
    const extensionId = background.url().split('/')[2];
    await use(extensionId);
  },
  globalPage: async ({ page }, use) => {
    await use(new GlobalPage(page));
  },
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  onboardingPage: async ({ page }, use) => {
    await use(new OnboardingPage(page));
  },
  sendPage: async ({ page }, use) => {
    await use(new SendPage(page));
  },
  swapPage: async ({ page }, use) => {
    await use(new SwapPage(page));
  },
  networkPage: async ({ page }, use) => {
    await use(new NetworkPage(page));
  },
  settingsPage: async ({ page }, use) => {
    await use(new SettingsPage(page));
  },
});

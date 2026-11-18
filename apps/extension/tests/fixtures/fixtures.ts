import { BrowserContext, Page, test as base, chromium } from '@playwright/test';
import { GlobalPage } from '@tests/page-object-models/global.page';
import { HomePage } from '@tests/page-object-models/home.page';
import { NetworkPage } from '@tests/page-object-models/network.page';
import { OnboardingPage } from '@tests/page-object-models/onboarding.page';
import { SendPage } from '@tests/page-object-models/send.page';
import { SettingsPage } from '@tests/page-object-models/settings.page';
import { SwapPage } from '@tests/page-object-models/swap.page';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

/* HACK -- Cat21: live-response capture (audit T11, step 2a). HQ allows a
   stubbed response only from a captured real one under version control, with
   source and capture date. With CAT21_LIVE_NET_CAPTURE set, every live response
   the recorder sees is written to apps/extension/live-net-capture/ (one JSON
   file per method + URL: capture time, status, content type, body as utf8 or
   base64, or omitted above the size cap) for CI to upload; the stubs are built
   from those files. Off by default. */
const LIVE_NET_CAPTURE_DIR = process.env.CAT21_LIVE_NET_CAPTURE
  ? path.join(__dirname, '../../live-net-capture')
  : null;
const MAX_CAPTURED_BODY_BYTES = 256 * 1024;

async function captureLiveResponse(
  dir: string,
  method: string,
  url: URL,
  response: { status(): number; headers(): Record<string, string>; body(): Promise<Buffer> }
): Promise<void> {
  const contentType = response.headers()['content-type'] ?? '';
  let record: Record<string, unknown>;
  try {
    const body = await response.body();
    const encoding = /json|text|javascript|xml/u.test(contentType) ? 'utf8' : 'base64';
    const tooLarge = body.byteLength > MAX_CAPTURED_BODY_BYTES;
    record = {
      capturedAt: new Date().toISOString(),
      method,
      url: url.href,
      status: response.status(),
      contentType,
      bodyBytes: body.byteLength,
      bodyEncoding: tooLarge ? 'omitted' : encoding,
      body: tooLarge ? null : body.toString(encoding),
    };
  } catch (error) {
    // Keep the failure in the capture rather than lose the entry silently.
    record = {
      capturedAt: new Date().toISOString(),
      method,
      url: url.href,
      captureError: error instanceof Error ? error.message : String(error),
    };
  }
  const name = createHash('sha256').update(`${method} ${url.href}`).digest('hex').slice(0, 16);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, `${url.hostname}-${method}-${name}.json`),
    JSON.stringify(record, null, 2)
  );
}

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
    /* HACK -- Cat21: live-network recorder (audit T11, step 1). HQ: no test
       talks to a real system. Before stubbing or blocking anything, record
       which non-local hosts each spec actually reaches, on green runs, so the
       inventory comes from observation, not from a guess. Records method,
       host and the first path segment (no query, no address-bearing tail),
       attaches the list to the test, and prints one `LIVE-NET` line to grep in
       CI. It fails nothing; the guard that does comes once every entry is
       stubbed from captured data or blocked.
       A request counts as live by where its RESPONSE came from, not by its
       URL: a request a spec's route rewrote to a local service keeps its
       original URL but is fulfilled with no server address, so it is not
       live. Only a response from a non-loopback peer is. */
    const liveRequests = new Set<string>();
    const pending: Promise<void>[] = [];
    context.on('requestfinished', request => {
      const url = new URL(request.url());
      if (!url.protocol.startsWith('http')) return;
      const firstSegment = url.pathname.split('/').filter(Boolean)[0] ?? '';
      const key = `${request.method()} ${url.hostname} /${firstSegment}`;
      pending.push(
        (async () => {
          const response = await request.response();
          const peer = response ? await response.serverAddr() : null;
          if (peer == null) return; // fulfilled by a route, never left the box
          if (peer.ipAddress === '127.0.0.1' || peer.ipAddress === '::1') return;
          liveRequests.add(key);
          if (LIVE_NET_CAPTURE_DIR && response) {
            await captureLiveResponse(LIVE_NET_CAPTURE_DIR, request.method(), url, response);
          }
        })().catch(() => {
          // The response could not be read (e.g. its page closed): keep the
          // entry, marked, rather than lose a request that may have been live.
          liveRequests.add(`${key} (unresolved)`);
        })
      );
    });
    await use(context);
    await Promise.all(pending);
    const inventory = [...liveRequests].sort();
    await testInfo.attach('live-network-requests', {
      body: JSON.stringify(inventory, null, 2),
      contentType: 'application/json',
    });
    // eslint-disable-next-line no-console
    console.log(`LIVE-NET ${testInfo.titlePath.join(' > ')} :: ${JSON.stringify(inventory)}`);
    await context.close();
    await context.browser()?.close();
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

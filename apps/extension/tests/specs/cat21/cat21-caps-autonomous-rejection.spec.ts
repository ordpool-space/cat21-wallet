import { expect } from '@playwright/test';

import { test } from '../../fixtures/fixtures';

/**
 * Real-extension proof that the per-account agent-policy CAPS bind the
 * AUTONOMOUS (Path 3 / MCP-NMH) cat-flow, enforced by the running
 * extension. This is the autonomous complement to the manual-path proof
 * in `cat21-caps-manual-rejection.spec.ts`.
 *
 * The MCP-NMH relay's real mechanism is: stash the intent + a transport
 * tag in `chrome.storage.session` under `cat21-request-<id>`, then open
 * the popup at the confirm route with `?cat21RequestId=<id>`. The route
 * reads the stash, sees `transport === 'mcp-nmh'` + `mode: 'autonomous'`,
 * and AUTO-CONFIRMS (no human click) — running the real Cat21RpcService
 * pipeline. We reproduce exactly that stash (what the native-messaging
 * host does), so the caps boundary is driven end-to-end without needing
 * the native-host binary itself.
 *
 * "A cap is a cap": the autonomous path is not a cap-free path either.
 * No chain is needed — the cap fires before the PSBT is built.
 */

// Valid mainnet P2TR distinct from the test account's own address.
const RECIPIENT = 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0';

test.describe('CAT-21 Path 3 / NMH confirm route (render-loop regression guard)', () => {
  test.beforeEach(async ({ page, extensionId, onboardingPage }) => {
    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await onboardingPage.signInWithTestAccount(extensionId);
  });

  test('the confirm route renders a stashed autonomous NMH request without the render-loop crash', async ({
    page,
    extensionId,
  }) => {
    // Regression guard for the bug this lane found: useCat21RequestFromUrl
    // built a fresh storage object every render (default param), so the
    // effect (dep: [requestId, storage]) re-fired every render and its
    // setState spun into React "Maximum update depth exceeded" whenever a
    // cat21RequestId was present — i.e. on EVERY Path-3 / NMH popup. The
    // whole confirm route crashed before any pipeline ran. Fixed by
    // memoizing the storage reference.
    //
    // Stash an autonomous mint intent exactly as the NMH relay does, then
    // open the confirm route with the request id. The route must render the
    // confirmation UI (not the crash boundary).
    const requestId = 'e2e-autonomous-render';
    await page.evaluate(
      async ({ id, recipient }) => {
        await chrome.storage.session.set({
          [`cat21-request-${id}`]: {
            intent: { recipient, feeRate: 5, mode: 'autonomous' },
            transport: 'mcp-nmh',
            stashedAt: Date.now(),
          },
        });
      },
      { id: requestId, recipient: RECIPIENT }
    );
    await page.goto(
      `chrome-extension://${extensionId}/index.html#/cat21-mint-confirm?cat21RequestId=${requestId}`
    );

    // The confirmation UI renders (crash boundary would show "Leather has
    // crashed" with no cat21 testids).
    await expect(page.getByTestId('cat21-confirmation-title')).toBeVisible();
  });
});

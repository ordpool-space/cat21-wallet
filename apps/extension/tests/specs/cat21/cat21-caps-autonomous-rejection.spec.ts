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

test.describe('CAT-21 caps bind the real autonomous (Path 3 / NMH) pipeline', () => {
  test.beforeEach(async ({ page, extensionId, onboardingPage }) => {
    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await onboardingPage.signInWithTestAccount(extensionId);
  });

  test('an over-cap AUTONOMOUS (mcp-nmh) mint is rejected by the caps via SILENT auto-confirm', async ({
    page,
    extensionId,
  }) => {
    // Also a regression guard for the render-loop crash this lane found
    // (useCat21RequestFromUrl built a fresh storage object every render, so
    // its effect re-fired endlessly into React "Maximum update depth" on
    // EVERY Path-3 / NMH popup — fixed by memoizing the storage ref). If the
    // route crashed, the pipeline below would never run.

    // 1. Set a per-action cap of 200 sats (below the 546-sat mint postage)
    //    via the real wizard (default enables agent mode). Persists to the
    //    real store across the reload, exactly like the Path-2 lane.
    await page.goto(`chrome-extension://${extensionId}/index.html#/cat21-agent-policy`);
    await page.getByTestId('cat21-agent-policy-form').waitFor();
    await page.locator('[name="maxSpendPerActionSats"]').fill('200');
    await page.getByTestId('cat21-agent-policy-save').click();

    // 2. Stash an AUTONOMOUS mint intent exactly as the NMH relay does, then
    //    open the confirm route with the request id.
    const requestId = 'e2e-autonomous-overcap';
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

    // 3. The route auto-confirms silently (transport 'mcp-nmh' + mode
    //    'autonomous', wallet unlocked) — no human click. The cap gate in
    //    resolveSigningMode runs FIRST (before the autonomous grant), so the
    //    over-cap autonomous mint is rejected, never signed. The running
    //    extension surfaces the cap denial.
    const error = page.getByTestId('cat21-confirmation-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText('spend-above-action-cap');
  });
});

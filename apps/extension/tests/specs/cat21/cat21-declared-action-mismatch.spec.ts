import { expect } from '@playwright/test';

import { test } from '../../fixtures/fixtures';
import { captureCat21Result } from '../cat21-chain/regtest-harness';

/**
 * Real-extension proof that the confirm route executes the action its route
 * DECLARES (HARD RULE #6: the action kind rides in the method name), never the
 * action the payload's shape suggests.
 *
 * The NMH relay opens the confirm route that matches the method name and stashes
 * the agent's payload as-is. We reproduce that stash for a request declared as
 * `cat21_mint` (the mint confirm route) whose payload is shaped like a TRANSFER
 * (it carries a `catId`). The route must refuse it: render the mismatch screen,
 * offer nothing to approve, and answer the agent with a typed denial (captured
 * from the real result bus), rather than running a transfer the agent never
 * declared.
 * No chain is needed: the refusal happens before any service call.
 */

const RECIPIENT = 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0';
const CAT_ID = `${'01'.repeat(32)}i0`;

test.describe('CAT-21 confirm route executes the DECLARED action only', () => {
  test.beforeEach(async ({ page, extensionId, onboardingPage }) => {
    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await onboardingPage.signInWithTestAccount(extensionId);
  });

  test('a transfer-shaped payload on the mint route is refused with a typed denial, never run', async ({
    context,
    page,
    extensionId,
  }) => {
    const requestId = 'e2e-declared-action-mismatch';
    await page.evaluate(
      async ({ id, recipient, catId }) => {
        await chrome.storage.session.set({
          [`cat21-request-${id}`]: {
            intent: { catId, recipient, feeRate: 5, mode: 'autonomous' },
            transport: 'mcp-nmh',
            stashedAt: Date.now(),
          },
        });
      },
      { id: requestId, recipient: RECIPIENT, catId: CAT_ID }
    );
    // Arm the real result-bus listener in the service worker BEFORE opening the
    // route, so the denial the popup posts to the agent is captured.
    const answer = captureCat21Result(context, requestId, { timeoutMs: 30_000 });
    await page.goto(
      `chrome-extension://${extensionId}/index.html#/cat21-mint-confirm?cat21RequestId=${requestId}`
    );

    // The route refuses the request instead of rendering a transfer dialog.
    await expect(page.getByTestId('cat21-confirm-intent-mismatch')).toBeVisible();
    await expect(page.getByTestId('cat21-confirmation-approve')).toHaveCount(0);

    // The agent gets the typed denial naming the declared action.
    const result = await answer;
    expect(result.ok).toBe(false);
    expect(result.value?.reason).toBe('intent-shape-invalid');
    expect(String(result.value?.detail)).toContain('declared-action-mismatch');
    expect(String(result.value?.detail)).toContain('mint');
  });
});

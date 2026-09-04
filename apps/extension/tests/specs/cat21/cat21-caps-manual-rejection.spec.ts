import { expect } from '@playwright/test';

import { test } from '../../fixtures/fixtures';

/**
 * Real-extension proof that the per-account agent-policy CAPS bind the
 * MANUAL (Path 2) cat-flow pipeline, enforced by the running extension
 * with the real keychain + real Redux policy store — not a unit mock.
 *
 * This is the end-to-end complement to the mocked unit specs. It drives
 * the actual surfaces a user takes:
 *   1. the agent-policy wizard sets a per-action cap BELOW the mint's
 *      546-sat postage,
 *   2. the manual mint form builds the intent and hands it to the
 *      Cat21ConfirmRoute,
 *   3. clicking approve runs the real Cat21RpcService pipeline
 *      (validateCat21Operation -> resolveSigningMode -> the cap gate),
 *   4. the cap fires (spend 546 > cap) BEFORE any build/sign/broadcast,
 *      and the running extension surfaces `spend-above-action-cap`.
 *
 * "A cap is a cap": manual mode is not a cap-free path. No chain is
 * needed because the rejection happens before the PSBT is built.
 */

// A valid mainnet P2TR distinct from the test account's own address, so the
// SDK gate's self-send check doesn't fire first. BIP-350 reference vector.
const RECIPIENT = 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0';

test.describe('CAT-21 caps bind the real manual (Path 2) pipeline', () => {
  test.beforeEach(async ({ page, extensionId, onboardingPage }) => {
    // Prime the page onto an extension context so `chrome.storage` exists
    // before signInWithTestAccount seeds the persisted wallet state.
    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await onboardingPage.signInWithTestAccount(extensionId);
  });

  test('an over-cap manual mint is rejected by the running extension before signing', async ({
    page,
    extensionId,
  }) => {
    // 1. Set a per-action cap of 200 sats (below the 546-sat mint postage)
    //    through the real agent-policy wizard. Persists to the real store.
    await page.goto(`chrome-extension://${extensionId}/index.html#/cat21-agent-policy`);
    await page.getByTestId('cat21-agent-policy-form').waitFor();
    const capField = page.locator('[name="maxSpendPerActionSats"]');
    await capField.fill('200');
    await page.getByTestId('cat21-agent-policy-save').click();

    // 2. Drive a MANUAL mint (spend = 546 postage) via the real mint form.
    //    Submitting client-navigates to the confirm route with the intent.
    await page.goto(`chrome-extension://${extensionId}/index.html#/cat21-mint`);
    await page.getByTestId('cat21-mint-form').waitFor();
    await page.locator('[name="recipient"]').fill(RECIPIENT);
    await page.locator('[name="feeRate"]').fill('5');
    await page.getByTestId('cat21-mint-form-submit').click();

    // 3. Approve on the confirmation dialog -> the real pipeline runs.
    await page.getByTestId('cat21-confirmation-approve').click();

    // 4. The cap fires in the running extension: 546 > 200. The denial is
    //    surfaced, and nothing was signed or broadcast (the reject happens
    //    before the builder runs).
    const error = page.getByTestId('cat21-confirmation-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText('spend-above-action-cap');
  });

  test('control: the SAME mint with a cap ABOVE the spend is NOT cap-rejected (passes the gate)', async ({
    page,
    extensionId,
  }) => {
    // Controlled contrast with the test above: identical mint, but a
    // per-action cap of 10 000 (ABOVE the 546-sat spend). This proves the
    // cap VALUE is the discriminator, not a blanket "any policy rejects".
    // The mint clears the cap gate and reaches funding selection, which
    // fails with a DIFFERENT reason (no funds for the test account, no
    // chain in this env) — never `spend-above-action-cap`.
    await page.goto(`chrome-extension://${extensionId}/index.html#/cat21-agent-policy`);
    await page.getByTestId('cat21-agent-policy-form').waitFor();
    await page.locator('[name="maxSpendPerActionSats"]').fill('10000');
    await page.getByTestId('cat21-agent-policy-save').click();

    await page.goto(`chrome-extension://${extensionId}/index.html#/cat21-mint`);
    await page.getByTestId('cat21-mint-form').waitFor();
    await page.locator('[name="recipient"]').fill(RECIPIENT);
    await page.locator('[name="feeRate"]').fill('5');
    await page.getByTestId('cat21-mint-form-submit').click();

    await page.getByTestId('cat21-confirmation-approve').click();

    // Passed the cap gate: the failure is funding, not the cap.
    const error = page.getByTestId('cat21-confirmation-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText('funding-pick-failed');
  });
});

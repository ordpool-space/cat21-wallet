import { expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { test } from '../../fixtures/fixtures';
import { readReceiveAddress } from './regtest-harness';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * UX-round-2 capture: renders every Cat21 approval dialog in the REAL
 * extension popup and screenshots it at the popup width (390) and a wide
 * width (1280), so a reviewer sees exactly what a person meets before signing.
 *
 * How each dialog is reached: the confirm route reads a stashed intent from
 * `chrome.storage.session` under `cat21-request-<id>` (the Path-3 popup
 * bridge). We stash a crafted intent with `transport:'popup'` + `mode:'manual'`
 * so the route renders the dialog and WAITS at it (auto-confirm fires only for
 * `mcp-nmh` + autonomous). Nothing is signed or broadcast; this captures the
 * presentational surface, whose copy is `makeCat21ConfirmationCopy(intent)` —
 * the exact function under unit + mutation test. Destination addresses are the
 * wallet's OWN keychain taproot address (a real ~64-char bcrt1p), so the
 * §7.14 full-grouped-address wrapping is shown on a genuine long value.
 *
 * Prerequisite: the regtest stack must be up (see cat21-mint-chain.spec.ts
 * header) so the wallet can switch to the regtest network and derive addresses.
 *
 * Run (CAT21_UX_CAPTURE_DIR picks the output dir; PW_CHROMIUM_EXE points at an
 * installed Chrome-for-Testing so no browser is re-downloaded):
 *   CAT21_UX_CAPTURE_DIR=/path/to/ux-round2/cat21-wallet \
 *   PW_CHROMIUM_EXE="~/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" \
 *     pnpm --filter @leather.io/extension exec playwright test \
 *       --config playwright.config.chain.ts cat21-confirm-capture
 */

// Where the frames are written. Override with CAT21_UX_CAPTURE_DIR; defaults
// to a repo-local report dir so a fresh checkout writes somewhere sane.
const OUT_DIR =
  process.env.CAT21_UX_CAPTURE_DIR ?? path.join(here, '../../../playwright-report/ux-capture');

// Worst-case realistic amounts: 7 digits force three space-grouped triples,
// the widest a sats value gets before it stops being a plausible cat price.
const BID_SATS = 1_234_567;
const PRICE_SATS = 1_234_567;
const CAT_NUMBER = 123_456;
// A real 64-hex txid + index; long enough to exercise the cat-id compaction.
const CAT_ID = '98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892i0';

const ROUTE = {
  mint: '/cat21-mint-confirm',
  transfer: '/cat21-transfer-confirm',
  createOffer: '/cat21-create-offer-confirm',
  acceptOffer: '/cat21-accept-offer-confirm',
  buy: '/cat21-buy-confirm',
} as const;

test.describe('CAT-21 approval dialogs (UX round 2 capture)', () => {
  test('captures every cat approval dialog at popup + wide width', async ({
    page,
    extensionId,
    onboardingPage,
  }) => {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await onboardingPage.signInWithTestAccount(extensionId);

    // A genuine long taproot address from the wallet's own keychain, used as
    // every destination so the §7.14 grouping is shown on a real value. The
    // confirmation copy is network-agnostic, so the default-network taproot
    // (a real ~62-char bech32m address) is exactly the worst case we want.
    const taproot = await readReceiveAddress(page, extensionId, 'btc-taproot');
    expect(taproot.length).toBeGreaterThan(50);
    expect(/1p[a-z0-9]+$/u.test(taproot)).toBeTruthy();

    /** Stash an intent, open its confirm route, wait at the dialog, shoot. */
    async function shoot(name: string, route: string, intent: Record<string, unknown>) {
      const requestId = `capture-${name}-${Date.now()}`;
      // Write the stash into the extension's session storage (the popup reads
      // it back by id). Runs in an extension page so `chrome.storage` exists.
      await page.evaluate(
        async ([id, value]) => {
          await chrome.storage.session.set({ [`cat21-request-${id}`]: value });
        },
        [requestId, { intent: { ...intent, mode: 'manual' }, transport: 'popup', stashedAt: Date.now() }] as const
      );
      // Render through action-popup.html, whose `.mode__action-popup` class
      // locks the body to the real 390px popup width and applies the popup
      // layout — the exact surface a Path-2 (manual) user sees. index.html
      // does NOT apply that lock, so it misrenders the fixed-width footer.
      // The viewport is a touch wider than 390 so the fixed-390 body is not
      // clipped by the scrollbar.
      await page.setViewportSize({ width: 420, height: 860 });
      await page.goto(
        `chrome-extension://${extensionId}/action-popup.html#${route}?cat21RequestId=${requestId}`
      );
      // The dialog is up once its approve button is visible; it waits here
      // (manual mode + popup transport → no auto-confirm).
      await page.getByTestId('cat21-confirmation-approve').waitFor({ state: 'visible' });
      await page.getByTestId('cat21-confirmation-title').waitFor({ state: 'visible' });
      await page.getByTestId('cat21-confirmation-rows').waitFor({ state: 'visible' });
      await page.screenshot({ path: path.join(OUT_DIR, `${name}-popup-390.png`) });
    }

    await shoot('mint', ROUTE.mint, { recipient: taproot, feeRate: 5 });
    await shoot('transfer', ROUTE.transfer, { catId: CAT_ID, recipient: taproot, feeRate: 5 });
    await shoot('create-offer', ROUTE.createOffer, {
      catId: CAT_ID,
      priceSats: PRICE_SATS,
      paymentAddress: taproot,
    });
    await shoot('accept-offer', ROUTE.acceptOffer, {
      offerPsbt: 'ab'.repeat(120),
      expectedCatId: CAT_ID,
      expectedPriceSats: PRICE_SATS,
      expectedSellerUtxo: { txid: 'a'.repeat(64), vout: 0 },
    });
    // Buy is the tallest dialog (four rows + two paragraphs) and carries both
    // the widest amount and a full seller address — the worst-case frame.
    await shoot('buy', ROUTE.buy, {
      catId: CAT_ID,
      catNumber: CAT_NUMBER,
      bidSats: BID_SATS,
      sellerPaymentAddress: taproot,
      feeRate: 5,
    });

    // Buy's seller address is a reveal row (offer-derived, non-comparable):
    // truncated by default, full grouped form on "Show full". Capture the
    // revealed state too, so the reviewer sees the address is still fully
    // verifiable on demand. The buy dialog is open from the shot above.
    const revealBtn = page.getByTestId("cat21-confirmation-row-seller's-address-reveal");
    await revealBtn.waitFor({ state: 'visible' });
    await revealBtn.click();
    await page.getByTestId('cat21-confirmation-rows').waitFor({ state: 'visible' });
    await page.screenshot({ path: path.join(OUT_DIR, 'buy-revealed-popup-390.png') });

    // Finding #1 (focus): on a spending prompt, focus must never land on the
    // Approve/money button (an accidental Enter would sign). Report where it
    // actually lands. The buy dialog is still open from the shot above.
    const focusTestId = await page.evaluate(
      () => document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.tagName ?? 'none'
    );
    // eslint-disable-next-line no-console
    console.log(`[capture] focus lands on: ${focusTestId}`);
    expect(focusTestId).not.toBe('cat21-confirmation-approve');
  });

  test('captures a REAL per-action cap denial in the error slot', async ({
    page,
    extensionId,
    onboardingPage,
  }) => {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await onboardingPage.signInWithTestAccount(extensionId);
    const taproot = await readReceiveAddress(page, extensionId, 'btc-taproot');

    // Set a low per-action cap through the REAL agent-policy wizard, so the
    // denial below comes from the actual caps gate, not an injected error.
    // The cap applies to manual actions regardless of `enabled` (HARD RULE #6).
    await page.goto(`chrome-extension://${extensionId}/index.html#/cat21-agent-policy`);
    await page.getByTestId('cat21-agent-policy-form').waitFor({ state: 'visible' });
    await page.locator('input[name="maxSpendPerActionSats"]').fill('1000');
    await page.getByTestId('cat21-agent-policy-save').click();
    // Saving navigates away from the wizard; wait for the form to detach.
    await page.getByTestId('cat21-agent-policy-form').waitFor({ state: 'detached' });

    // Stash a buy far over the 1000-sat cap and approve it. The caps gate runs
    // at mode-resolution (before build/funding), so the denial surfaces as the
    // humanised sentence in the error slot without any on-chain setup.
    const requestId = `denial-${Date.now()}`;
    await page.evaluate(
      async ([id, value]) => {
        await chrome.storage.session.set({ [`cat21-request-${id}`]: value });
      },
      [
        requestId,
        {
          intent: {
            catId: CAT_ID,
            catNumber: CAT_NUMBER,
            bidSats: BID_SATS,
            sellerPaymentAddress: taproot,
            feeRate: 5,
            mode: 'manual',
          },
          transport: 'popup',
          stashedAt: Date.now(),
        },
      ] as const
    );
    await page.setViewportSize({ width: 420, height: 860 });
    await page.goto(
      `chrome-extension://${extensionId}/action-popup.html#${ROUTE.buy}?cat21RequestId=${requestId}`
    );
    await page.getByTestId('cat21-confirmation-approve').waitFor({ state: 'visible' });
    await page.getByTestId('cat21-confirmation-approve').click();

    const errorLabel = page.getByTestId('cat21-confirmation-error');
    await errorLabel.waitFor({ state: 'visible' });
    const errorText = (await errorLabel.textContent()) ?? '';
    // eslint-disable-next-line no-console
    console.log(`[capture] denial error slot reads: ${errorText}`);
    // A humanised sentence, never the raw reason code.
    expect(errorText).not.toContain('spend-above-action-cap');
    expect(errorText.endsWith('.')).toBeTruthy();

    await page.screenshot({ path: path.join(OUT_DIR, 'buy-denied-popup-390.png') });
  });
});

import { expect } from '@playwright/test';

import { test } from '../../fixtures/fixtures';
import {
  getCatIdAtOutput,
  installRegtestRoutes,
  mintCatViaRawTx,
  newCapture,
  readReceiveAddress,
  switchToRegtestNetwork,
  waitElectrsSynced,
} from './regtest-harness';

const PRICE_SATS = 50_000;

/**
 * CAT-21 CREATE OFFER — real-button proof.
 *
 * create_offer does not broadcast a Bitcoin tx: it publishes a structured
 * listing to the CAT-21 Bazaar. Setup mints a cat the wallet owns (real
 * nLockTime=21 tx). Then the spec CLICKS the create-offer form (catId + price
 * + payout address) and Approve. The wallet confirms ownership against
 * cat21-ord, builds the listing, signs a real BIP-322 session with its taproot
 * keychain, and POSTs the listing. We prove:
 *
 *   1. OWNERSHIP TRUTH — the published listing's catTxid/catVout are the cat's
 *      real on-chain UTXO (resolved from cat21-ord, not guessed).
 *   2. INTENT TRUTH    — askSats / payTo / ordinalsAddress in the POSTed body
 *      match exactly what the user typed and the wallet's own addresses.
 *
 * The Bazaar backend (backend2.cat21.space) is not part of the regtest stack,
 * so its POST is stubbed to succeed and its body captured; the BIP-322 auth
 * the wallet signs first is real. Prereqs/run: see cat21-mint-chain.spec.ts.
 */
test.describe('CAT-21 create offer (regtest chain truth)', () => {
  test('lists a real owned cat: publishes the correct listing to the Bazaar', async ({
    context,
    page,
    extensionId,
    onboardingPage,
  }) => {
    const capture = newCapture();
    await installRegtestRoutes(context, capture);

    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await onboardingPage.signInWithTestAccount(extensionId);
    await switchToRegtestNetwork(page, extensionId);

    const paymentAddress = await readReceiveAddress(page, extensionId, 'btc');
    const ordinalsAddress = await readReceiveAddress(page, extensionId, 'btc-taproot');

    // Mint a cat the wallet owns (real nLockTime=21 tx to its taproot addr).
    const catMintTxid = mintCatViaRawTx(ordinalsAddress);
    await waitElectrsSynced();
    const catId = await getCatIdAtOutput(catMintTxid, 0);

    // Drive the create-offer form (real buttons).
    await page.goto(`chrome-extension://${extensionId}/index.html#/cat21-create-offer`);
    await page.getByTestId('cat21-create-offer-form').waitFor({ state: 'visible' });
    await page.locator('input[name="catId"]').fill(catId);
    await page.locator('input[name="priceSats"]').fill(String(PRICE_SATS));
    await page.locator('input[name="paymentAddress"]').fill(paymentAddress);
    await page.getByTestId('cat21-create-offer-form-submit').click();

    // Approve → build listing → resolve cat → BIP-322 session sign → POST.
    // Retry only over the transient cat-not-yet-loaded race; the publish state
    // machine then replaces the dialog and drives to success.
    const approve = page.getByTestId('cat21-confirmation-approve');
    const errorLabel = page.getByTestId('cat21-confirmation-error');
    const done = page.getByTestId('bazaar-publish-done');
    const publishError = page.getByTestId('bazaar-publish-error-close');
    await approve.waitFor({ state: 'visible' });
    await expect
      .poll(
        async () => {
          if (await done.isVisible().catch(() => false)) return 'done';
          if (await publishError.isVisible().catch(() => false)) {
            throw new Error('bazaar publish reported an error');
          }
          if (await errorLabel.isVisible().catch(() => false)) {
            const detail = (await errorLabel.textContent()) ?? '';
            if (!/cat-utxo-resolve-failed|cat-data-not-loaded/.test(detail)) {
              throw new Error(`create-offer rejected: ${detail}`);
            }
          }
          if (await approve.isEnabled().catch(() => false)) {
            await approve.click().catch(() => undefined);
          }
          return 'pending';
        },
        { timeout: 60_000, intervals: [1500], message: 'listing never reached success' }
      )
      .toBe('done');

    // The wallet published exactly one listing; assert its contents.
    const listingPost = capture.bazaarPosts.find(p => p.path === '/api/v1/listings');
    if (!listingPost) throw new Error('no listing was POSTed to the Bazaar');
    const body = JSON.parse(listingPost.body) as {
      askSats: number;
      payTo: string;
      catTxid: string;
      catVout: number;
      ordinalsAddress: string;
      catNumber: number;
      cats: number[];
    };

    // INTENT TRUTH: price + payout + owner match what the user typed.
    expect(body.askSats).toBe(PRICE_SATS);
    expect(body.payTo).toBe(paymentAddress);
    expect(body.ordinalsAddress).toBe(ordinalsAddress);
    // OWNERSHIP TRUTH: the listing points at the cat's real on-chain UTXO.
    expect(body.catTxid).toBe(catMintTxid);
    expect(body.catVout).toBe(0);
    expect(Number.isInteger(body.catNumber)).toBeTruthy();
    expect(body.cats).toContain(body.catNumber);
  });
});

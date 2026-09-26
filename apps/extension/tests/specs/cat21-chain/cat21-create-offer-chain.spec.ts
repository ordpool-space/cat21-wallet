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
  waitForBackendListing,
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
 *   1. OWNERSHIP TRUTH — the persisted listing's catTxid/catVout are the cat's
 *      real on-chain UTXO (the backend cross-checked ownership against the
 *      local cat21-ord before storing it).
 *   2. INTENT TRUTH    — askSats / payTo / ordinalsAddress / network read back
 *      from the backend match what the user typed and the wallet's addresses.
 *
 * NO STUB: backend2.cat21.space is forwarded to the REAL cat21-indexer backend
 * running locally against regtest (BACKEND_NETWORK=regtest, ORD_API_URL -> the
 * local cat21-ord, MariaDB). The backend verifies the wallet's real BIP-322
 * session, cross-checks cat ownership against cat21-ord, and persists the
 * listing; the test reads it back from the backend's own API. Prereqs: bring up
 * the regtest stack AND the backend (see cat21-mint-chain.spec.ts + the harness
 * header). Run: see cat21-mint-chain.spec.ts.
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

    // The wallet POSTed to the REAL backend. Read the persisted listing back
    // from the backend's database (not the request we sent) to prove it landed.
    const listingPost = capture.bazaarPosts.find(p => p.path === '/api/v1/listings');
    if (!listingPost) throw new Error('no listing was POSTed to the Bazaar backend');
    const catNumber = (JSON.parse(listingPost.body) as { catNumber: number }).catNumber;

    const listing = await waitForBackendListing(catNumber);
    // The backend independently verified the BIP-322 session AND cross-checked
    // cat ownership against the local cat21-ord before persisting; these assert
    // exactly what it stored.
    // INTENT TRUTH: price + payout + owner match what the user typed.
    expect(listing.network).toBe('regtest');
    expect(listing.askSats).toBe(PRICE_SATS);
    expect(listing.payTo).toBe(paymentAddress);
    expect(listing.ordinalsAddress).toBe(ordinalsAddress);
    // OWNERSHIP TRUTH: the persisted listing points at the cat's real on-chain UTXO.
    expect(listing.catTxid).toBe(catMintTxid);
    expect(listing.catVout).toBe(0);
  });
});

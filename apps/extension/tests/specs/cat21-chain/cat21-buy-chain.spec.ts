import { expect } from '@playwright/test';

import { test } from '../../fixtures/fixtures';
import {
  fundAddress,
  getCatIdAtOutput,
  getCatNumber,
  getEsploraTx,
  installRegtestRoutes,
  mintCatViaRawTx,
  newCapture,
  newRegtestAddress,
  readReceiveAddress,
  switchToRegtestNetwork,
  waitElectrsSynced,
  waitForBackendBids,
  waitOutputIndexed,
} from './regtest-harness';

const BID_SATS = 50_000;

/**
 * CAT-21 BUY — real-button proof (the buyer side of the Bazaar).
 *
 * cat21_buy does not broadcast: the wallet builds an ord-style buy-offer PSBT,
 * signs ONLY its own funding inputs (input 0, the seller's cat, stays unsigned
 * for the seller to accept), and POSTs it as a bid. Setup mints a cat owned by
 * a SELLER (a non-wallet address), then the spec drives the buy form via an ask
 * link (which carries the seller's payment address, per the "never derive a
 * payment address from an on-chain lookup" rule) and clicks Approve. We prove:
 *
 *   1. OWNERSHIP TRUTH — the persisted bid points at the seller cat's real
 *      on-chain UTXO (the wallet reconstructed the seller input from cat21-ord).
 *   2. INTENT TRUTH    — bidSats / sellerPaymentAddress / network read back from
 *      the REAL backend match the ask + the wallet's addresses; the buy-offer
 *      PSBT is present.
 *
 * NO STUB: backend2.cat21.space is forwarded to the real cat21-indexer backend
 * running against regtest (the backend validates the bid's buyer inputs against
 * electrs + the cat against cat21-ord, then persists it). Prereqs: the regtest
 * stack AND the backend up (see cat21-create-offer-chain.spec.ts).
 */
test.describe('CAT-21 buy (regtest chain truth)', () => {
  test('bids on a listed cat: posts a real buy-offer to the Bazaar backend', async ({
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

    const buyerFundingAddress = await readReceiveAddress(page, extensionId, 'btc');

    // Fund the buyer (the wallet). Mint a cat owned by a SELLER (non-wallet),
    // with a separate seller payment address.
    const fundingTxid = fundAddress(buyerFundingAddress, 0.001);
    const sellerCatAddress = newRegtestAddress('bech32m');
    const sellerPaymentAddress = newRegtestAddress('bech32');
    const catMintTxid = mintCatViaRawTx(sellerCatAddress);

    await waitElectrsSynced();
    const fundingTx = await getEsploraTx(fundingTxid);
    const fundingVout = fundingTx.vout.findIndex(
      o => o.scriptpubkey_address === buyerFundingAddress
    );
    expect(fundingVout).toBeGreaterThanOrEqual(0);
    await waitOutputIndexed(fundingTxid, fundingVout);
    const catId = await getCatIdAtOutput(catMintTxid, 0);
    const catNumber = await getCatNumber(catId);

    // Drive the buy form. The ask link carries the seller's payment address, so
    // the buyer never derives it from a chain lookup.
    const askLink = `catNumber=${catNumber}&askPrice=${BID_SATS}&payTo=${sellerPaymentAddress}`;
    await page.goto(`chrome-extension://${extensionId}/index.html#/cat21-buy`);
    await page.locator('input[name="buyTarget"]').fill(askLink);
    await page.getByTestId('cat21-buy-lookup').click();
    await page.getByTestId('cat21-buy-target-ready').waitFor({ state: 'visible' });
    await page.getByTestId('cat21-buy-form').waitFor({ state: 'visible' });
    await page.locator('input[name="bidSats"]').fill(String(BID_SATS));
    await page.locator('input[name="feeRate"]').fill('5');
    await page.getByTestId('cat21-buy-form-submit').click();

    // Approve → build buy-offer + sign buyer inputs + POST the bid (no
    // broadcast). Retry over the async funding-pick race until the bid-posted
    // acknowledgement appears.
    const approve = page.getByTestId('cat21-confirmation-approve');
    const errorLabel = page.getByTestId('cat21-confirmation-error');
    const bidPosted = page.getByTestId('cat21-bid-posted');
    await approve.waitFor({ state: 'visible' });
    await expect
      .poll(
        async () => {
          if (await bidPosted.isVisible().catch(() => false)) return true;
          if (await errorLabel.isVisible().catch(() => false)) {
            const detail = (await errorLabel.textContent()) ?? '';
            if (
              !/funding-pick-failed|Insufficient funds|cat-utxo-resolve-failed|cat-data-not-loaded/.test(
                detail
              )
            ) {
              throw new Error(`buy rejected: ${detail}`);
            }
          }
          if (await approve.isEnabled().catch(() => false)) {
            await approve.click().catch(() => undefined);
          }
          return false;
        },
        { timeout: 90_000, intervals: [1500], message: 'buy never posted a bid' }
      )
      .toBe(true);

    // Read the bid back from the REAL backend and assert what it stored.
    const bids = await waitForBackendBids(catMintTxid, 0);
    const myBid = bids.find(b => b.sellerPaymentAddress === sellerPaymentAddress);
    if (!myBid) throw new Error('backend has no bid with our seller payment address');
    expect(myBid.network).toBe('regtest');
    expect(myBid.bidSats).toBe(BID_SATS);
    expect(myBid.catTxid).toBe(catMintTxid);
    expect(myBid.catVout).toBe(0);
    expect(myBid.psbtBase64.length).toBeGreaterThan(0);
  });
});

import { expect } from '@playwright/test';

import { test } from '../../fixtures/fixtures';
import {
  captureCat21Result,
  fundAddress,
  getCatIdAtOutput,
  getCatNumber,
  getEsploraTx,
  installRegtestRoutes,
  mintCatViaRawTx,
  newCapture,
  newRegtestAddress,
  readReceiveAddress,
  stashCat21Request,
  switchToRegtestNetwork,
  waitElectrsSynced,
  waitForBackendBids,
  waitOutputIndexed,
} from './regtest-harness';

// An autonomous buy commits bidSats, so — unlike accept-offer, where the seller
// spends nothing — the bid is bound by the per-action cap. Kept within the
// default policy's per-action cap (10 000 sats) and above the backend's
// marketplace spam floor (1 000 sats), so the default permissive policy applies
// unchanged. The over-cap rejection is proven separately by
// cat21-caps-autonomous-rejection.
const BID_SATS = 8_000;

/**
 * CAT-21 PATH-3 AUTONOMOUS BUY — real-button-FREE proof (buyer side of the Bazaar).
 *
 * cat21_buy does not broadcast: the wallet builds an ord-style buy-offer PSBT,
 * signs ONLY its own funding inputs (input 0, the seller's cat, stays unsigned),
 * and POSTs it as a bid to the Bazaar backend. This proves the AUTONOMOUS path
 * does the same with no human click — the combination the manual buy spec and
 * autonomous-mint spec each leave unproven.
 *
 * Setup mints a cat owned by a SELLER (non-wallet). Agent mode on, an AUTONOMOUS
 * buy intent stashed as the NMH host does (the seller payout address is carried
 * in the intent, per "never derive a payment address from an on-chain lookup").
 * Open the confirm route + reload, NO click. NO STUB: backend2.cat21.space is
 * forwarded to the real cat21-indexer backend on regtest, which validates the
 * bid's buyer inputs against electrs + the cat against cat21-ord before
 * persisting. We prove:
 *
 *   1. SILENT      — the wallet posts a bid with zero clicks (autoconfirm).
 *   2. OWNERSHIP    — the persisted bid points at the seller cat's real on-chain
 *      UTXO (the wallet reconstructed the seller input from cat21-ord).
 *   3. INTENT TRUTH — bidSats / sellerPaymentAddress / network read back from the
 *      REAL backend match; the buy-offer PSBT is present.
 *
 * Prereqs/run: the regtest stack AND the cat21-indexer backend up (see
 * cat21-buy-chain.spec.ts / cat21-create-offer-chain.spec.ts headers).
 */
test.describe('CAT-21 autonomous buy (Path 3 / NMH, regtest chain truth)', () => {
  test('silent-builds + posts a real bid to the Bazaar backend with NO click', async ({
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

    // Fund the buyer (the wallet). Mint a cat owned by a SELLER (non-wallet).
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

    // Enable agent mode with the default permissive policy (the bid is within
    // the default per-action cap, so no field edits are needed).
    await page.goto(`chrome-extension://${extensionId}/index.html#/cat21-agent-policy`);
    await page.getByTestId('cat21-agent-policy-form').waitFor({ state: 'visible' });
    await page.getByTestId('cat21-agent-policy-save').click();

    // Stash an AUTONOMOUS buy intent as the NMH host does; open the confirm route
    // + reload for a cold boot. NO click from here — the autoconfirm resolves the
    // cat, builds + signs the buy-offer, and POSTs the bid.
    const requestId = 'e2e-autonomous-buy';
    const resultPromise = captureCat21Result(context, requestId);
    await stashCat21Request(page, requestId, {
      catId,
      catNumber,
      bidSats: BID_SATS,
      sellerPaymentAddress,
      feeRate: 5,
      mode: 'autonomous',
    });
    await page.goto(
      `chrome-extension://${extensionId}/index.html#/cat21-buy-confirm?cat21RequestId=${requestId}`
    );
    await page.reload();

    // 1. SILENT: the autoconfirm finalises a result on the bus with no click.
    // Assert it succeeded with a bid; a policy/build denial surfaces its exact
    // reason:detail here rather than masquerading as a backend-poll timeout.
    const result = await resultPromise;
    if (!result.ok) {
      throw new Error(`autonomous buy denied: ${JSON.stringify(result.value)}`);
    }
    expect((result.value as { kind?: string }).kind).toBe('bid');

    // 2/3. Read the bid back from the REAL backend and assert its truth.
    const bids = await waitForBackendBids(catMintTxid, 0, 90_000);
    const myBid = bids.find(b => b.sellerPaymentAddress === sellerPaymentAddress);
    if (!myBid) throw new Error('backend has no autonomous bid with our seller payment address');
    expect(myBid.network).toBe('regtest');
    expect(myBid.bidSats).toBe(BID_SATS);
    expect(myBid.catTxid).toBe(catMintTxid);
    expect(myBid.catVout).toBe(0);
    expect(myBid.psbtBase64.length).toBeGreaterThan(0);
  });
});

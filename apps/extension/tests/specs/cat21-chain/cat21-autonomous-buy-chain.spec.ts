import { expect } from '@playwright/test';
import { base64, hex } from '@scure/base';
import * as btc from '@scure/btc-signer';

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

// @scure/btc-signer network descriptor for regtest (bcrt), for decoding the
// bid PSBT's output scripts.
const REGTEST = { bech32: 'bcrt', pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef };

/** scriptPubKey (hex) an address decodes to, for comparing PSBT outputs by destination. */
function scriptHexFor(address: string): string {
  return hex.encode(btc.OutScript.encode(btc.Address(REGTEST).decode(address)));
}

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
    // Independent oracle for the payout check below: the wallet's ordinals
    // address read from the Receive UI, a surface that does NOT feed the buy
    // builder. Distinct from the (segwit) funding address and from the seller's
    // address, so an ordinals/payment swap in the builder cannot pass.
    const buyerOrdinalsAddress = await readReceiveAddress(page, extensionId, 'btc-taproot');

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

    // 4. DESTINATION TRUTH (independent of both the wallet and the backend).
    // The backend validates output 0 against the bid's self-reported
    // buyerOrdinalsAddress — but the wallet BOTH builds the output AND reports
    // that field, so a consistent ordinals/payment swap would pass the backend
    // by self-agreement (process distance is not independence). Decode the built
    // buy-offer PSBT and assert its outputs by destination against addresses read
    // from the Receive UI, a surface that does not feed the builder:
    //   output 0 = the cat, to the BUYER's ordinals address (the wallet receives it)
    //   output 1 = the payout, to the SELLER's payment address
    // The two are distinct address types (bcrt1p vs bcrt1q), so a swap fails.
    expect(buyerOrdinalsAddress).not.toBe(sellerPaymentAddress);
    const bidTx = btc.Transaction.fromPSBT(base64.decode(myBid.psbtBase64));
    const out0 = bidTx.getOutput(0);
    const out1 = bidTx.getOutput(1);
    if (!out0?.script || !out1?.script) {
      throw new Error('bid PSBT is missing output 0/1 scripts');
    }
    expect(hex.encode(out0.script)).toBe(scriptHexFor(buyerOrdinalsAddress));
    expect(hex.encode(out1.script)).toBe(scriptHexFor(sellerPaymentAddress));
  });
});

import { expect } from '@playwright/test';

import { test } from '../../fixtures/fixtures';
import {
  captureCat21Result,
  getCatIdAtOutput,
  installRegtestRoutes,
  mintCatViaRawTx,
  newCapture,
  newRegtestAddress,
  readReceiveAddress,
  stashCat21Request,
  switchToRegtestNetwork,
  waitElectrsSynced,
} from './regtest-harness';

const PRICE_SATS = 77_000;

/**
 * CAT-21 PATH-3 AUTONOMOUS CREATE OFFER — real-button-FREE proof.
 *
 * cat21_create_offer is the one cat action that neither broadcasts nor signs: it
 * resolves the seller's cat UTXO from cat21-ord and returns a listing (catId,
 * sellerUtxo, priceSats, paymentAddress) the agent forwards to a marketplace. So
 * "chain truth" here is UTXO truth: on a real regtest cat, the autonomous silent
 * path must resolve the cat's REAL on-chain outpoint and emit a listing pinned to
 * it — no 546 placeholder, no wrong vout.
 *
 * With agent mode on, the spec stashes an AUTONOMOUS create-offer intent as the
 * NMH host does, arms a real capture of the result envelope the popup posts on
 * `chrome.runtime.sendMessage` (no mock — a listener in the extension's own
 * service worker), opens the confirm route + reloads, and issues NO click. We
 * prove:
 *
 *   1. SILENT   — the autoconfirm finalises a `kind: 'listing'` result with zero
 *      clicks (the payload reached the agent bus).
 *   2. UTXO TRUTH — the listing's sellerUtxo is the cat's REAL mint outpoint
 *      (txid:0), and catId / priceSats / paymentAddress match the intent.
 *
 * Prereqs/run: see cat21-mint-chain.spec.ts header (same stack/config). No
 * Bazaar backend needed — Path 3 returns the listing, it does not publish it.
 */
test.describe('CAT-21 autonomous create offer (Path 3 / NMH, regtest)', () => {
  test('silent-builds a listing pinned to the real cat UTXO with NO click', async ({
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

    // Mint a cat OWNED by the wallet (raw nLockTime=21 to its taproot address).
    const catMintTxid = mintCatViaRawTx(ordinalsAddress);
    await waitElectrsSynced();
    const catId = await getCatIdAtOutput(catMintTxid, 0);
    expect(catId).toMatch(/^[0-9a-f]{64}i\d+$/);

    // Sanity: the price uses a real payout address distinct from the cat's owner.
    const payoutAddress = newRegtestAddress('bech32') || paymentAddress;

    // Enable agent mode with the default permissive policy.
    await page.goto(`chrome-extension://${extensionId}/index.html#/cat21-agent-policy`);
    await page.getByTestId('cat21-agent-policy-form').waitFor({ state: 'visible' });
    await page.getByTestId('cat21-agent-policy-save').click();

    // Arm the real result-bus capture BEFORE opening the route.
    const requestId = 'e2e-autonomous-create-offer';
    const resultPromise = captureCat21Result(context, requestId);

    // Stash an AUTONOMOUS create-offer intent as the NMH host does; open + reload.
    await stashCat21Request(page, requestId, {
      catId,
      priceSats: PRICE_SATS,
      paymentAddress: payoutAddress,
      mode: 'autonomous',
    });
    await page.goto(
      `chrome-extension://${extensionId}/index.html#/cat21-create-offer-confirm?cat21RequestId=${requestId}`
    );
    await page.reload();

    // 1. SILENT: the autoconfirm posts a listing result with no click.
    const result = await resultPromise;
    expect(result.ok).toBe(true);
    const value = result.value as
      | {
          kind: string;
          listing: {
            catId: string;
            sellerUtxo: { txid: string; vout: number };
            priceSats: number;
            paymentAddress: string;
          };
        }
      | undefined;
    if (!value || value.kind !== 'listing') {
      throw new Error(`expected a listing result, got ${JSON.stringify(result)}`);
    }

    // 2. UTXO TRUTH: the listing is pinned to the cat's REAL on-chain outpoint.
    expect(value.listing.catId).toBe(catId);
    expect(value.listing.sellerUtxo).toEqual({ txid: catMintTxid, vout: 0 });
    expect(value.listing.priceSats).toBe(PRICE_SATS);
    expect(value.listing.paymentAddress).toBe(payoutAddress);
  });
});

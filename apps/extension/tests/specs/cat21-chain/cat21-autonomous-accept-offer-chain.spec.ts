import * as secp from '@noble/secp256k1';
import { expect } from '@playwright/test';
import { base64, hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import { KnownOrdinalWalletType, Network, buildCat21BuyOfferPsbt } from 'ordpool-sdk/core';

import { test } from '../../fixtures/fixtures';
import {
  fundAddress,
  getCatIdAtOutput,
  getEsploraTx,
  installRegtestRoutes,
  mine,
  mintCatViaRawTx,
  newCapture,
  readReceiveAddress,
  stashCat21Request,
  switchToRegtestNetwork,
  waitElectrsSynced,
  waitForCatAtOutput,
  waitForUtxoAt,
} from './regtest-harness';

// @scure/btc-signer network descriptor for regtest (bcrt).
const REGTEST = { bech32: 'bcrt', pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef };
const PRICE_SATS = 50_000;
const FEE_SATS = 1_000;
// Deterministic synthetic buyer key (test-only; sats come from regtest).
const BUYER_PRIV = hex.decode('2233445566778899001122334455667788990011223344556677889900112233');

/**
 * CAT-21 PATH-3 AUTONOMOUS ACCEPT OFFER — real-button-FREE chain-truth proof.
 *
 * The click-driven accept spec (cat21-accept-offer-chain) proves the accept
 * WIRING; the autonomous-mint spec proves the silent-sign GATE. This proves the
 * COMBINATION: an NMH agent, in autonomous mode within policy, settles a buyer's
 * offer with no human click. This is the Bazaar's headline Path-3 action (a bot
 * auto-accepting bids), and a bug specific to the autonomous accept path would
 * pass both existing specs and still ship broken.
 *
 * The wallet is the SELLER. A synthetic BUYER (a keypair funded on-chain) builds
 * an ord-style buy-offer PSBT via the SDK and signs only its own funding input;
 * input 0 (the seller's cat) is left unsigned. That offer is stashed as an
 * AUTONOMOUS accept intent, the accept-offer-confirm route is opened + reloaded
 * (fresh NMH boot), and NO click is issued. The seller-side spend is zero (the
 * seller RECEIVES the price), so the default per-action cap never binds it — the
 * autonomous gate opens on agent-mode + within-policy. We prove:
 *
 *   1. SILENT   — a real broadcast happens with zero clicks on approve.
 *   2. CHAIN    — the settlement tx is on chain with locktime == 21, output 0
 *      (the cat) pays the buyer, output 1 pays the seller priceSats + the cat's
 *      preserved value.
 *   3. INDEXER  — cat21-ord re-homes the same cat id onto output 0, now the
 *      buyer's.
 *
 * Prereqs/run: see cat21-mint-chain.spec.ts header (same stack/config).
 */
test.describe('CAT-21 autonomous accept offer (Path 3 / NMH, regtest chain truth)', () => {
  test('silent-signs + settles a buyer offer with NO click (agent mode, seller receives)', async ({
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

    // Seller = the wallet.
    const sellerPaymentAddress = await readReceiveAddress(page, extensionId, 'btc');
    const sellerOrdinalsAddress = await readReceiveAddress(page, extensionId, 'btc-taproot');

    // Give the wallet a cat to sell.
    const catMintTxid = mintCatViaRawTx(sellerOrdinalsAddress);
    await waitElectrsSynced();
    const catId = await getCatIdAtOutput(catMintTxid, 0);
    const catTx = await getEsploraTx(catMintTxid);
    const catOut = catTx.vout[0];
    if (!catOut?.scriptpubkey) throw new Error('cat output missing scriptpubkey');
    const catValue = catOut.value;

    // Buyer = a synthetic keypair we control + fund on-chain.
    const buyerPub = secp.getPublicKey(BUYER_PRIV, true);
    const buyerP2wpkh = btc.p2wpkh(buyerPub, REGTEST);
    const buyerAddress = buyerP2wpkh.address;
    if (!buyerAddress) throw new Error('failed to derive buyer address');
    fundAddress(buyerAddress, 0.01);
    await waitElectrsSynced();
    const buyerFunding = await waitForUtxoAt(buyerAddress, 1_000_000);

    // Buyer builds the ord-style buy-offer PSBT and signs ONLY its funding input.
    const offer = buildCat21BuyOfferPsbt({
      walletType: KnownOrdinalWalletType.cat21wallet,
      network: Network.Regtest,
      sellerInput: {
        txid: catMintTxid,
        vout: 0,
        value: catValue,
        scriptPubKey: hex.decode(catOut.scriptpubkey),
      },
      buyerInputs: [
        {
          txid: buyerFunding.txid,
          vout: buyerFunding.vout,
          value: buyerFunding.value,
          scriptPubKey: buyerP2wpkh.script,
        },
      ],
      destinations: {
        buyerReceiveAddress: buyerAddress,
        sellerPaymentAddress,
        buyerChangeAddress: buyerAddress,
      },
      priceSats: PRICE_SATS,
      feeSats: FEE_SATS,
    });
    const psbtTx = btc.Transaction.fromPSBT(offer.psbt);
    psbtTx.signIdx(BUYER_PRIV, 1, [btc.SigHash.ALL]);
    const offerPsbtBase64 = base64.encode(psbtTx.toPSBT());

    // Enable agent mode with the default permissive policy.
    await page.goto(`chrome-extension://${extensionId}/index.html#/cat21-agent-policy`);
    await page.getByTestId('cat21-agent-policy-form').waitFor({ state: 'visible' });
    await page.getByTestId('cat21-agent-policy-save').click();

    // Stash an AUTONOMOUS accept intent as the NMH host does, open the confirm
    // route, reload for a cold boot. NO click from here.
    const requestId = 'e2e-autonomous-accept';
    await stashCat21Request(page, requestId, {
      offerPsbt: offerPsbtBase64,
      expectedCatId: catId,
      expectedPriceSats: PRICE_SATS,
      expectedSellerUtxo: { txid: catMintTxid, vout: 0 },
      mode: 'autonomous',
    });
    await page.goto(
      `chrome-extension://${extensionId}/index.html#/cat21-accept-offer-confirm?cat21RequestId=${requestId}`
    );
    await page.reload();

    // 1. SILENT: auto-confirm settles with no click on approve.
    const errorLabel = page.getByTestId('cat21-confirmation-error');
    await expect
      .poll(
        async () => {
          if (capture.txids.length > 0) return true;
          if (await errorLabel.isVisible().catch(() => false)) {
            throw new Error(`autonomous accept rejected: ${await errorLabel.textContent()}`);
          }
          return false;
        },
        { timeout: 90_000, intervals: [1500], message: 'autonomous accept never broadcast' }
      )
      .toBe(true);
    const settlementTxid = capture.txids[capture.txids.length - 1];

    // 2. CHAIN TRUTH: settlement on chain, cat to buyer, payment to seller.
    const settleTx = await getEsploraTx(settlementTxid);
    expect(settleTx.locktime).toBe(21);
    expect(settleTx.vout[0]?.scriptpubkey_address).toBe(buyerAddress);
    expect(settleTx.vout[1]?.scriptpubkey_address).toBe(sellerPaymentAddress);
    expect(settleTx.vout[1]?.value).toBe(PRICE_SATS + catValue);

    // 3. INDEXER TRUTH: the cat now belongs to the buyer.
    mine(1);
    await waitElectrsSynced();
    const output = await waitForCatAtOutput(settlementTxid, 0);
    expect(output.cats).toContain(catId);
    expect(output.address).toBe(buyerAddress);
  });
});

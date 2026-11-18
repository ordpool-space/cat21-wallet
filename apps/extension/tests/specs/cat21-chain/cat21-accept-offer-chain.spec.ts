import * as secp from '@noble/secp256k1';
import { expect } from '@playwright/test';
import { base64, hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import { KnownOrdinalWalletType, Network, buildCat21BuyOfferPsbt } from 'ordpool-sdk/core';

import { test } from '../../fixtures/fixtures';
import {
  approveUntilBroadcast,
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
// Deterministic synthetic buyer key. Test-only; the sats it spends come from
// regtest, so a fixed key keeps the run reproducible.
const BUYER_PRIV = hex.decode('1122334455667788990011223344556677889900112233445566778899001122');

/**
 * CAT-21 ACCEPT OFFER — real-button chain-truth proof.
 *
 * The wallet is the SELLER. Setup: give the wallet a cat (raw nLockTime=21 tx
 * to its taproot address), then a synthetic BUYER (a keypair we fund on-chain)
 * builds an ord-style buy-offer PSBT via the SDK and signs only its own funding
 * input — input 0 (the seller's cat) is left unsigned. That offer is stashed
 * and the spec drives the accept confirmation route and CLICKS Approve. The
 * wallet validates the offer against the intent, signs input 0 (the taproot
 * cat) with its keychain, and broadcasts the settlement. We prove:
 *
 *   1. CHAIN TRUTH   — the settlement tx is on chain with locktime == 21, its
 *      output 0 (the cat) pays the buyer, and output 1 pays the seller exactly
 *      priceSats + the cat's preserved value.
 *   2. INDEXER TRUTH — cat21-ord re-homes the same cat id onto the settlement's
 *      output 0, now owned by the buyer.
 *
 * Prereqs/run: see cat21-mint-chain.spec.ts header (same stack/config).
 */
test.describe('CAT-21 accept offer (regtest chain truth)', () => {
  test('accepts a buyer offer: settles on chain, cat to buyer, payment to seller', async ({
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

    // Build the buyer's ord-style buy-offer PSBT: input 0 = seller cat
    // (unsigned), input 1 = buyer funding; output 0 = cat to buyer, output 1 =
    // priceSats + catValue to the seller, output 2 = buyer change.
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

    // Buyer signs ONLY its funding input (index 1). Input 0 stays for the
    // seller (the wallet) to sign at accept time. Export as base64 (unfinalised).
    const psbtTx = btc.Transaction.fromPSBT(offer.psbt);
    psbtTx.signIdx(BUYER_PRIV, 1, [btc.SigHash.ALL]);
    const offerPsbtBase64 = base64.encode(psbtTx.toPSBT());

    // Stash the accept intent (manual mode ⇒ the route shows the dialog rather
    // than auto-confirming) and drive the confirm route + real Approve button.
    const requestId = 'e2e-accept-1';
    await stashCat21Request(page, requestId, {
      offerPsbt: offerPsbtBase64,
      expectedCatId: catId,
      expectedPriceSats: PRICE_SATS,
      expectedSellerUtxo: { txid: catMintTxid, vout: 0 },
      mode: 'manual',
    });
    await page.goto(
      `chrome-extension://${extensionId}/index.html#/cat21-accept-offer-confirm?cat21RequestId=${requestId}`
    );

    const settlementTxid = await approveUntilBroadcast(page, capture);

    // 1. CHAIN TRUTH: settlement on chain, cat to buyer, payment to seller.
    const settleTx = await getEsploraTx(settlementTxid);
    expect(settleTx.locktime).toBe(21);
    expect(settleTx.vout[0]?.scriptpubkey_address).toBe(buyerAddress);
    expect(settleTx.vout[1]?.scriptpubkey_address).toBe(sellerPaymentAddress);
    // Seller is made whole: net priceSats on top of the cat's preserved value.
    expect(settleTx.vout[1]?.value).toBe(PRICE_SATS + catValue);

    // 2. INDEXER TRUTH: the cat now belongs to the buyer.
    mine(1);
    await waitElectrsSynced();
    const output = await waitForCatAtOutput(settlementTxid, 0);
    expect(output.cats).toContain(catId);
    expect(output.address).toBe(buyerAddress);
  });
});

import type { Cat21OfferValidation as SdkCat21OfferValidation } from 'ordpool-sdk/core';

import type { Cat21AcceptOfferIntent } from '../types';

/**
 * The SDK's offer-validation result, used as-is so the union stays in
 * lockstep with the SDK (rejection reasons, and on success `pricePaidSats`,
 * `postageSats` and `buyerAddresses`, the parties the policy allowlist
 * checks). Imported as a type from `ordpool-sdk/core`, so nothing is bundled.
 */
export type Cat21OfferValidation = SdkCat21OfferValidation;

/**
 * Arguments handed to the SDK validator. The dispatcher (background page)
 * wires `Cat21RpcDeps.validateBuyOfferPsbt` to ordpool-sdk's
 * `validateCat21BuyOfferPsbt` at startup; tests stub the callback.
 */
// HACK -- Cat21: removed `export` (pre-wired for iter 10/11 consumers (popup pages + agent-policy store); restore on wire-up). HARD RULE #5 — restore on consumer wire-up.
interface ValidateAcceptOfferArgs {
  intent: Cat21AcceptOfferIntent;
  /** Decoded PSBT bytes (the invariants gate decoded base64/hex once). */
  psbtBytes: Uint8Array;
  /** Wallet's own payment address — Output 1 of the PSBT MUST land here. */
  expectedSellerPaymentAddress: string;
  network: 'mainnet' | 'testnet' | 'regtest';
}

/**
 * Thin orchestration wrapper around the SDK validator. Builds the SDK's
 * `ValidateCat21BuyOfferArgs` shape from the local args, delegates to the
 * injected callback, then cross-checks the SDK's `pricePaidSats` against
 * the intent's `expectedPriceSats` — equality, not just ≥ floor. The
 * wallet's contract is "the intent's expected values pin the deal"; any
 * mismatch surfaces as `wrong-price` even if the SDK accepted it against
 * a lower `floorPriceSats`.
 */
export function validateAcceptOffer(
  args: ValidateAcceptOfferArgs,
  delegate: (sdkArgs: {
    psbt: Uint8Array;
    expectedSellerUtxo: { txid: string; vout: number };
    floorPriceSats: number;
    expectedSellerPaymentAddress: string;
    network: 'mainnet' | 'testnet' | 'regtest';
  }) => Cat21OfferValidation
): Cat21OfferValidation {
  const sdkResult = delegate({
    psbt: args.psbtBytes,
    expectedSellerUtxo: args.intent.expectedSellerUtxo,
    floorPriceSats: args.intent.expectedPriceSats,
    expectedSellerPaymentAddress: args.expectedSellerPaymentAddress,
    network: args.network,
  });

  if (!sdkResult.ok) return sdkResult;

  // Underpay is rejected; overpay is accepted. The ord-style PSBT is
  // sniping-proof by construction (the buyer's SIGHASH_ALL signatures
  // commit to every byte; see ordpool-sdk/cat21-offer.helper.ts
  // sniping-proof note). An overpay is just a tip from the buyer the
  // seller has no honest reason to refuse.
  if (sdkResult.pricePaidSats < args.intent.expectedPriceSats) {
    return {
      ok: false,
      reason: 'wrong-price',
      detail: `intent.expectedPriceSats=${args.intent.expectedPriceSats}, psbt pays ${sdkResult.pricePaidSats}`,
    };
  }

  return sdkResult;
}

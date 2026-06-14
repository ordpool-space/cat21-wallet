import type { Cat21AcceptOfferIntent, Validated } from '../types';

/**
 * Mirror of the SDK's `Cat21OfferRejectionReason` union. We keep a local
 * copy here so the cat21-rpc service can be type-safe without
 * static-importing ordpool-sdk (which would land Angular peer warnings in
 * the background bundle). The SDK is the source of truth for the actual
 * validation; this enum is wire-only.
 */
export type Cat21OfferValidationReason =
  | 'missing-seller-input'
  | 'wrong-postage'
  | 'wrong-price'
  | 'sighash-not-all'
  | 'buyer-input-unsigned'
  | 'missing-seller-payment-output'
  | 'payment-output-wrong-address';

/** Successful validation: caller proceeds to sign + broadcast. */
export interface ValidationSuccess {
  ok: true;
  pricePaidSats: number;
  postageSats: number;
}

/** Validation failure: caller surfaces as `inbound-offer-mismatch` RPC denial. */
export interface ValidationFailure {
  ok: false;
  reason: Cat21OfferValidationReason;
  detail?: string;
}

export type Cat21OfferValidation = ValidationSuccess | ValidationFailure;

/**
 * Arguments handed to the SDK validator. The dispatcher (background page)
 * wires `Cat21RpcDeps.validateBuyOfferPsbt` to ordpool-sdk's
 * `validateCat21BuyOfferPsbt` at startup; tests stub the callback.
 */
export interface ValidateAcceptOfferArgs {
  intent: Validated<Cat21AcceptOfferIntent>;
  /** Decoded PSBT bytes (the invariants gate decoded base64/hex once). */
  psbtBytes: Uint8Array;
  /** Wallet's own payment address — Output 1 of the PSBT MUST land here. */
  expectedSellerPaymentAddress: string;
  network: 'mainnet' | 'testnet';
}

/**
 * Thin orchestration wrapper around the SDK validator. The implementation
 * commit fills in the body that:
 *
 *   1. Builds the SDK's `ValidateCat21BuyOfferArgs` shape from the local args.
 *   2. Delegates to the dep-injected `validateBuyOfferPsbt` callback.
 *   3. Cross-checks the SDK's `pricePaidSats` against the intent's
 *      `expectedPriceSats` — equality, not just ≥ floor. The wallet's
 *      contract is "the intent's expected values pin the deal"; any
 *      mismatch surfaces as `wrong-price` even if the SDK accepted it
 *      against a lower `floorPriceSats`.
 *
 * Implementation lands in the iteration-7 implementation commit.
 */
export function validateAcceptOffer(
  args: ValidateAcceptOfferArgs,
  delegate: (sdkArgs: {
    psbt: Uint8Array;
    expectedSellerUtxo: { txid: string; vout: number };
    floorPriceSats: number;
    expectedSellerPaymentAddress: string;
    network: 'mainnet' | 'testnet';
  }) => Cat21OfferValidation
): Cat21OfferValidation {
  void args;
  void delegate;
  throw new Error('Not implemented — iteration 7 (stubs commit)');
}

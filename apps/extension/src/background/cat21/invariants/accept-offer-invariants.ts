import type { Cat21AcceptOfferIntent, Validated } from '../types';

/**
 * Same catId pattern as the rest of the cat21 slice — `<txid>i<index>`.
 */
export const ACCEPT_OFFER_CAT_ID_PATTERN = /^[0-9a-fA-F]{64}i\d+$/;

/**
 * Lower bound on expectedPriceSats. Anything below relay dust is a
 * non-broadcastable output, so the offer cannot be a real deal.
 */
export const ACCEPT_OFFER_PRICE_MIN_SATS = 546;

/**
 * Upper bound on expectedPriceSats. Same 21 BTC × 10 sanity ceiling as
 * create-offer; anything above is presumed fat-finger or attack.
 */
export const ACCEPT_OFFER_PRICE_SANITY_CEILING_SATS = 21_000_000_000;

/**
 * Maximum offerPsbt payload size we accept at the gate. Real CAT-21 buy
 * offers fit comfortably below 64 KiB (one seller input + a handful of
 * buyer inputs + 2-3 outputs). 128 KiB is a generous ceiling that still
 * blocks obvious DoS submissions before any parser runs.
 */
export const ACCEPT_OFFER_PSBT_MAX_BYTES = 128 * 1024;

export type AcceptOfferInvariantViolation =
  | 'expected-cat-id-malformed'
  | 'expected-price-below-dust'
  | 'expected-price-above-sanity-ceiling'
  | 'expected-seller-utxo-malformed'
  | 'offer-psbt-empty'
  | 'offer-psbt-too-large'
  | 'offer-psbt-not-parseable';

export class AcceptOfferInvariantError extends Error {
  constructor(public readonly reason: AcceptOfferInvariantViolation, detail?: string) {
    super(detail ? `${reason}: ${detail}` : reason);
    this.name = 'AcceptOfferInvariantError';
  }
}

/**
 * Hard, unbypassable safety checks on a raw `Cat21AcceptOfferIntent`.
 *
 * The intent carries the buyer's PSBT plus three "expected" values that
 * pin what the seller thinks the deal is. The invariants gate here is
 * structural — well-formed catId, sensible price range, parseable PSBT
 * payload. The cryptographic checks (input 0 references seller's UTXO,
 * SIGHASH_ALL on every input, output 1 amount/address) are delegated to
 * the SDK's `validateCat21BuyOfferPsbt` — that runs *after* this gate, in
 * the RPC service.
 *
 * Implementation lands in the iteration-7 implementation commit.
 */
export function enforceAcceptOfferInvariants(
  intent: Cat21AcceptOfferIntent,
  _network: 'mainnet' | 'testnet'
): Validated<Cat21AcceptOfferIntent> {
  void intent;
  void _network;
  throw new Error('Not implemented — iteration 7 (stubs commit)');
}

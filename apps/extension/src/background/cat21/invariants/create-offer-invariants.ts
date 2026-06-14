import type { Cat21CreateOfferIntent, Validated } from '../types';

/**
 * Maximum priceSats we accept at the wallet-side sanity gate. The Genesis
 * Cat's lore price is 21 BTC = 2,100,000,000 sats; we ceiling at one
 * order of magnitude above that (21 BTC × 10) for any non-Genesis cat,
 * because anyone listing above that with no human review is almost
 * certainly fat-fingering the price. This is a *sanity* ceiling, not a
 * policy ceiling — the per-account `floorPriceSatsPerCat` policy still
 * applies on top.
 */
export const CREATE_OFFER_PRICE_SANITY_CEILING_SATS = 21_000_000_000;

/**
 * Minimum priceSats we accept. Anything below relay dust (546) cannot
 * appear as a Bitcoin output, so the listing would be unusable.
 */
export const CREATE_OFFER_PRICE_MIN_SATS = 546;

/**
 * Shape of an inscription / cat id we accept. cat21-ord emits ids as
 * `<txid>i<index>`. Same pattern as transfer-invariants. Exported so
 * the implementation commit can reuse it; the stubs commit needs the
 * symbol present so a future renaming pass updates both files at once.
 */
export const CREATE_OFFER_CAT_ID_PATTERN = /^[0-9a-fA-F]{64}i\d+$/;

export type CreateOfferInvariantViolation =
  | 'cat-id-malformed'
  | 'price-below-dust'
  | 'price-above-sanity-ceiling'
  | 'payment-address-not-a-bitcoin-address'
  | 'payment-address-wrong-network';

export class CreateOfferInvariantError extends Error {
  constructor(public readonly reason: CreateOfferInvariantViolation, detail?: string) {
    super(detail ? `${reason}: ${detail}` : reason);
    this.name = 'CreateOfferInvariantError';
  }
}

/**
 * Hard, unbypassable safety checks on a raw `Cat21CreateOfferIntent`.
 *
 * Throws on first violation; returns the `Validated<>` brand on success.
 * The cat existence check (does the wallet actually own this cat?) is the
 * caller's responsibility — happens via cat21-ord lookup in the RPC
 * orchestrator.
 *
 * Implementation lands in the iteration-6 implementation commit.
 */
export function enforceCreateOfferInvariants(
  intent: Cat21CreateOfferIntent,
  network: 'mainnet' | 'testnet'
): Validated<Cat21CreateOfferIntent> {
  void intent;
  void network;
  throw new Error('Not implemented — iteration 6 (stubs commit)');
}

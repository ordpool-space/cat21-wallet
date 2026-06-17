import * as btc from '@scure/btc-signer';

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
// HACK -- Cat21: removed `export` (pre-wired for iter 10/11 consumers (popup pages + agent-policy store); restore on wire-up). HARD RULE #5 — restore on consumer wire-up.
const CREATE_OFFER_CAT_ID_PATTERN = /^[0-9a-fA-F]{64}i\d+$/;

// HACK -- Cat21: removed `export` (pre-wired for iter 10/11 consumers (popup pages + agent-policy store); restore on wire-up). HARD RULE #5 — restore on consumer wire-up.
type CreateOfferInvariantViolation =
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
 * Order of checks: catId → price → address. Tested order matters; bad
 * catId is the cheapest to detect and surfaces first.
 */
export function enforceCreateOfferInvariants(
  intent: Cat21CreateOfferIntent,
  network: 'mainnet' | 'testnet'
): Validated<Cat21CreateOfferIntent> {
  if (typeof intent.catId !== 'string' || !CREATE_OFFER_CAT_ID_PATTERN.test(intent.catId)) {
    throw new CreateOfferInvariantError('cat-id-malformed', String(intent.catId));
  }

  if (!Number.isFinite(intent.priceSats) || intent.priceSats < CREATE_OFFER_PRICE_MIN_SATS) {
    throw new CreateOfferInvariantError(
      'price-below-dust',
      `${intent.priceSats} < ${CREATE_OFFER_PRICE_MIN_SATS}`
    );
  }
  if (intent.priceSats > CREATE_OFFER_PRICE_SANITY_CEILING_SATS) {
    throw new CreateOfferInvariantError(
      'price-above-sanity-ceiling',
      `${intent.priceSats} > ${CREATE_OFFER_PRICE_SANITY_CEILING_SATS}`
    );
  }

  const addressNetwork = decodeAddressNetwork(intent.paymentAddress);
  if (addressNetwork === null) {
    throw new CreateOfferInvariantError(
      'payment-address-not-a-bitcoin-address',
      intent.paymentAddress
    );
  }
  if (addressNetwork !== network) {
    throw new CreateOfferInvariantError(
      'payment-address-wrong-network',
      `expected ${network}, got ${addressNetwork}`
    );
  }

  return intent as Validated<Cat21CreateOfferIntent>;
}

function decodeAddressNetwork(address: string): 'mainnet' | 'testnet' | null {
  if (typeof address !== 'string' || address.length === 0) return null;
  try {
    btc.Address(btc.NETWORK).decode(address);
    return 'mainnet';
  } catch {
    try {
      btc.Address(btc.TEST_NETWORK).decode(address);
      return 'testnet';
    } catch {
      return null;
    }
  }
}

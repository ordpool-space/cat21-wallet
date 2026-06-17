import { base64, hex } from '@scure/base';

import type { Cat21AcceptOfferIntent, Validated } from '../types';

/**
 * Same catId pattern as the rest of the cat21 slice — `<txid>i<index>`.
 */
// HACK -- Cat21: removed `export` (pre-wired for iter 10/11 consumers (popup pages + agent-policy store); restore on wire-up). HARD RULE #5 — restore on consumer wire-up.
const ACCEPT_OFFER_CAT_ID_PATTERN = /^[0-9a-fA-F]{64}i\d+$/;

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

/**
 * 64-char hex pattern for an outpoint txid.
 */
const TXID_PATTERN = /^[0-9a-fA-F]{64}$/;

/**
 * PSBT magic bytes: ASCII `psbt` + 0xff terminator. We assert these on
 * the decoded payload before the validator runs the heavy parser.
 */
const PSBT_MAGIC = new Uint8Array([0x70, 0x73, 0x62, 0x74, 0xff]);

// HACK -- Cat21: removed `export` (pre-wired for iter 10/11 consumers (popup pages + agent-policy store); restore on wire-up). HARD RULE #5 — restore on consumer wire-up.
type AcceptOfferInvariantViolation =
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
 * Branded intent with the decoded PSBT bytes attached. The validator
 * caller pulls the bytes off the brand instead of decoding twice.
 */
export type ValidatedAcceptOffer = Validated<Cat21AcceptOfferIntent> & {
  readonly psbtBytes: Uint8Array;
};

/**
 * Hard, unbypassable safety checks on a raw `Cat21AcceptOfferIntent`.
 *
 * Order: expectedCatId → expectedPrice → expectedSellerUtxo → offerPsbt.
 * The catId / price / utxo checks are cheap; the PSBT decode is
 * potentially expensive (up to 128 KiB of input), so it runs last.
 */
export function enforceAcceptOfferInvariants(
  intent: Cat21AcceptOfferIntent,
  _network: 'mainnet' | 'testnet'
): ValidatedAcceptOffer {
  void _network;

  if (
    typeof intent.expectedCatId !== 'string' ||
    !ACCEPT_OFFER_CAT_ID_PATTERN.test(intent.expectedCatId)
  ) {
    throw new AcceptOfferInvariantError('expected-cat-id-malformed', String(intent.expectedCatId));
  }

  if (
    !Number.isFinite(intent.expectedPriceSats) ||
    intent.expectedPriceSats < ACCEPT_OFFER_PRICE_MIN_SATS
  ) {
    throw new AcceptOfferInvariantError(
      'expected-price-below-dust',
      `${intent.expectedPriceSats} < ${ACCEPT_OFFER_PRICE_MIN_SATS}`
    );
  }
  if (intent.expectedPriceSats > ACCEPT_OFFER_PRICE_SANITY_CEILING_SATS) {
    throw new AcceptOfferInvariantError(
      'expected-price-above-sanity-ceiling',
      `${intent.expectedPriceSats} > ${ACCEPT_OFFER_PRICE_SANITY_CEILING_SATS}`
    );
  }

  const utxo = intent.expectedSellerUtxo;
  if (
    !utxo ||
    typeof utxo.txid !== 'string' ||
    !TXID_PATTERN.test(utxo.txid) ||
    typeof utxo.vout !== 'number' ||
    !Number.isInteger(utxo.vout) ||
    utxo.vout < 0
  ) {
    throw new AcceptOfferInvariantError(
      'expected-seller-utxo-malformed',
      JSON.stringify(utxo)
    );
  }

  if (typeof intent.offerPsbt !== 'string' || intent.offerPsbt.length === 0) {
    throw new AcceptOfferInvariantError('offer-psbt-empty');
  }
  if (intent.offerPsbt.length > ACCEPT_OFFER_PSBT_MAX_BYTES) {
    throw new AcceptOfferInvariantError(
      'offer-psbt-too-large',
      `${intent.offerPsbt.length} > ${ACCEPT_OFFER_PSBT_MAX_BYTES}`
    );
  }

  const psbtBytes = decodePsbtPayload(intent.offerPsbt);
  if (!psbtBytes) {
    throw new AcceptOfferInvariantError('offer-psbt-not-parseable', 'neither hex nor base64');
  }
  if (psbtBytes.length < PSBT_MAGIC.length || !startsWithMagic(psbtBytes)) {
    throw new AcceptOfferInvariantError(
      'offer-psbt-not-parseable',
      'missing PSBT magic bytes'
    );
  }
  if (psbtBytes.length > ACCEPT_OFFER_PSBT_MAX_BYTES) {
    throw new AcceptOfferInvariantError(
      'offer-psbt-too-large',
      `decoded ${psbtBytes.length} > ${ACCEPT_OFFER_PSBT_MAX_BYTES}`
    );
  }

  return Object.assign(intent as Validated<Cat21AcceptOfferIntent>, { psbtBytes });
}

function decodePsbtPayload(payload: string): Uint8Array | null {
  // Try hex first (deterministic charset; cheapest).
  if (/^[0-9a-fA-F]+$/.test(payload) && payload.length % 2 === 0) {
    try {
      return hex.decode(payload);
    } catch {
      // fall through to base64
    }
  }
  try {
    return base64.decode(payload);
  } catch {
    return null;
  }
}

function startsWithMagic(bytes: Uint8Array): boolean {
  for (let i = 0; i < PSBT_MAGIC.length; i++) {
    if (bytes[i] !== PSBT_MAGIC[i]) return false;
  }
  return true;
}

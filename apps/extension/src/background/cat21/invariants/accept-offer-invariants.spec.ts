import { describe, expect, it } from 'vitest';

import {
  ACCEPT_OFFER_PRICE_MIN_SATS,
  ACCEPT_OFFER_PRICE_SANITY_CEILING_SATS,
  ACCEPT_OFFER_PSBT_MAX_BYTES,
  AcceptOfferInvariantError,
  enforceAcceptOfferInvariants,
} from './accept-offer-invariants';

describe('enforceAcceptOfferInvariants', () => {

  describe('expected-cat-id-malformed', () => {

    it.todo('throws when expectedCatId is not a string');
    it.todo('throws when expectedCatId lacks the txidi<index> shape');
    it.todo('accepts a well-formed expectedCatId');
  });

  describe('expected-price boundaries', () => {

    it.todo('throws when expectedPriceSats is 0');
    it.todo('throws when expectedPriceSats is below 546');
    it.todo('accepts expectedPriceSats exactly at 546');
    it.todo('throws when expectedPriceSats exceeds 21_000_000_000');
    it.todo('accepts expectedPriceSats exactly at 21_000_000_000');
  });

  describe('expected-seller-utxo structure', () => {

    it.todo('throws when expectedSellerUtxo.txid is not 64-char hex');
    it.todo('throws when expectedSellerUtxo.vout is negative');
    it.todo('throws when expectedSellerUtxo.vout is non-integer');
    it.todo('accepts a well-formed expectedSellerUtxo');
  });

  describe('offer-psbt structure', () => {

    it.todo('throws when offerPsbt is an empty string');
    it.todo('throws when offerPsbt exceeds the size ceiling');
    it.todo('throws when offerPsbt is not valid base64 or hex');
    it.todo('throws when offerPsbt parses but is not a real PSBT (no magic bytes)');
    it.todo('accepts a real PSBT in hex form');
    it.todo('accepts a real PSBT in base64 form');
  });

  describe('happy path returns the branded intent', () => {

    it.todo('returns the same intent object on success (no field rewrite)');
    it.todo('runs invariants in order (catId → price → utxo → psbt)');
  });

  it('module exports are wired (smoke test)', () => {
    expect(enforceAcceptOfferInvariants).toBeTypeOf('function');
    expect(AcceptOfferInvariantError).toBeTypeOf('function');
    expect(ACCEPT_OFFER_PRICE_MIN_SATS).toBe(546);
    expect(ACCEPT_OFFER_PRICE_SANITY_CEILING_SATS).toBe(21_000_000_000);
    expect(ACCEPT_OFFER_PSBT_MAX_BYTES).toBe(128 * 1024);
  });
});

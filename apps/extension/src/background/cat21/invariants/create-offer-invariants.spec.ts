import { hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import { describe, expect, it } from 'vitest';

import {
  CREATE_OFFER_PRICE_SANITY_CEILING_SATS,
  CreateOfferInvariantError,
  enforceCreateOfferInvariants,
} from './create-offer-invariants';

const publicKey = hex.decode('030000000000000000000000000000000000000000000000000000000000000001');
const mainnetAddr = btc.p2wpkh(publicKey, btc.NETWORK).address!;
const testnetAddr = btc.p2wpkh(publicKey, btc.TEST_NETWORK).address!;
const VALID_CAT_ID = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefi0';

describe('enforceCreateOfferInvariants', () => {

  describe('cat-id-malformed', () => {

    it.todo('throws when catId is not a string');
    it.todo('throws when catId lacks the txidi<index> shape');
    it.todo('throws when catId has non-hex characters in the txid portion');
    it.todo('accepts a well-formed catId with multi-digit index');
  });

  describe('price-below-dust', () => {

    it.todo('throws when priceSats is 0');
    it.todo('throws when priceSats is below the dust floor (545)');
    it.todo('accepts priceSats exactly at the dust floor (546)');
  });

  describe('price-above-sanity-ceiling', () => {

    it.todo('throws when priceSats exceeds the 21 BTC × 10 ceiling');
    it.todo('accepts priceSats exactly at the ceiling');
  });

  describe('payment-address validity', () => {

    it.todo('throws when paymentAddress is not a parseable Bitcoin address');
    it.todo('throws when paymentAddress is mainnet but network is testnet');
    it.todo('throws when paymentAddress is testnet but network is mainnet');
    it.todo('accepts a network-matching mainnet paymentAddress');
    it.todo('accepts a network-matching testnet paymentAddress');
  });

  describe('happy path returns the branded intent', () => {

    it.todo('returns the same intent object on success (no field rewrite)');
    it.todo('runs invariants in declared order (catId → price → address)');
  });

  // Sentinel values to keep the linter happy in the stubs commit; they
  // exercise the import surface so an accidental rename is caught at type
  // level. The actual assertions land in the implementation commit.
  it('module exports are wired (smoke test)', () => {
    expect(enforceCreateOfferInvariants).toBeTypeOf('function');
    expect(CreateOfferInvariantError).toBeTypeOf('function');
    expect(CREATE_OFFER_PRICE_SANITY_CEILING_SATS).toBe(21_000_000_000);
    expect(mainnetAddr).toMatch(/^bc1/);
    expect(testnetAddr).toMatch(/^tb1/);
    expect(VALID_CAT_ID).toMatch(/i0$/);
  });
});

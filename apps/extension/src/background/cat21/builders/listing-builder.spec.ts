import { describe, expect, it } from 'vitest';

import { enforceCreateOfferInvariants } from '../invariants/create-offer-invariants';
import type { Cat21CreateOfferIntent, Validated } from '../types';
import { BuildListingArgs, buildListing } from './listing-builder';

const VALID_CAT_ID = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefi0';
const MAINNET_ADDR = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';

function validatedIntent(
  overrides: Partial<Cat21CreateOfferIntent> = {}
): Validated<Cat21CreateOfferIntent> {
  const raw: Cat21CreateOfferIntent = {
    catId: VALID_CAT_ID,
    priceSats: 100_000,
    paymentAddress: MAINNET_ADDR,
    ...overrides,
  };
  return enforceCreateOfferInvariants(raw, 'mainnet');
}

function makeArgs(overrides: Partial<BuildListingArgs> = {}): BuildListingArgs {
  return {
    intent: validatedIntent(),
    sellerUtxo: {
      txid: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
      vout: 0,
    },
    ...overrides,
  };
}

describe('buildListing', () => {

  it('emits a listing with all four fields', () => {
    const listing = buildListing(makeArgs());
    expect(listing).toMatchObject({
      catId: expect.any(String),
      sellerUtxo: { txid: expect.any(String), vout: expect.any(Number) },
      priceSats: expect.any(Number),
      paymentAddress: expect.any(String),
    });
  });

  it('preserves the catId verbatim from the validated intent', () => {
    const listing = buildListing(makeArgs());
    expect(listing.catId).toBe(VALID_CAT_ID);
  });

  it('preserves the sellerUtxo verbatim from the caller-supplied lookup', () => {
    const args = makeArgs();
    const listing = buildListing(args);
    expect(listing.sellerUtxo.txid).toBe(args.sellerUtxo.txid);
    expect(listing.sellerUtxo.vout).toBe(args.sellerUtxo.vout);
  });

  it('preserves priceSats verbatim from the validated intent', () => {
    const listing = buildListing(makeArgs({ intent: validatedIntent({ priceSats: 21_000_000 }) }));
    expect(listing.priceSats).toBe(21_000_000);
  });

  it('preserves paymentAddress verbatim from the validated intent', () => {
    const listing = buildListing(makeArgs());
    expect(listing.paymentAddress).toBe(MAINNET_ADDR);
  });

  it('returns a fresh sellerUtxo object (no shared reference with the input)', () => {
    const args = makeArgs();
    const listing = buildListing(args);
    expect(listing.sellerUtxo).not.toBe(args.sellerUtxo);
  });
});

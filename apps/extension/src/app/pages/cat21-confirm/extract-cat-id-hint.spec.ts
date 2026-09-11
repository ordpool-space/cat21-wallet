import { describe, expect, it } from 'vitest';

import type {
  Cat21AcceptOfferIntent,
  Cat21CreateOfferIntent,
  Cat21MintIntent,
  Cat21TransferIntent,
} from '@background/cat21/types';

import { extractCatIdHint } from './extract-cat-id-hint';

const mint: Cat21MintIntent = {
  recipient: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
  feeRate: 7,
};
const transfer: Cat21TransferIntent = {
  catId: 'cat-tx0i0',
  recipient: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
  feeRate: 7,
};
const createOffer: Cat21CreateOfferIntent = {
  catId: 'cat-tx0i0',
  priceSats: 21000,
  paymentAddress: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
};
const acceptOffer: Cat21AcceptOfferIntent = {
  offerPsbt: 'deadbeef',
  expectedCatId: 'cat-tx0i0',
  expectedPriceSats: 21000,
  expectedSellerUtxo: { txid: 'a'.repeat(64), vout: 0 },
};

describe('extractCatIdHint', () => {
  it('returns the catId for a transfer intent', () => {
    expect(extractCatIdHint(transfer)).toBe('cat-tx0i0');
  });

  it('returns the catId for a create-offer intent', () => {
    expect(extractCatIdHint(createOffer)).toBe('cat-tx0i0');
  });

  it('returns the expectedCatId for an accept-offer intent (different field name)', () => {
    expect(extractCatIdHint(acceptOffer)).toBe('cat-tx0i0');
  });

  it('returns undefined for a mint intent (no cat exists yet)', () => {
    // Pinning this enforces the contract: useCat21RpcDeps skips the
    // cat21-ord pre-fetch when no hint is present, so a mint popup
    // never tries to look up a cat that hasn't been minted.
    expect(extractCatIdHint(mint)).toBeUndefined();
  });

  it('returns undefined when the intent is undefined (caller passed `location.state` with no intent)', () => {
    expect(extractCatIdHint(undefined)).toBeUndefined();
  });
});

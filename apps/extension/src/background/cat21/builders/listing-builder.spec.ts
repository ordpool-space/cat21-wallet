import { describe, expect, it } from 'vitest';

import { buildListing } from './listing-builder';

describe('buildListing', () => {

  it.todo('emits a listing with all four fields (catId, sellerUtxo, priceSats, paymentAddress)');
  it.todo('preserves the catId verbatim from the validated intent');
  it.todo('preserves the sellerUtxo verbatim from the caller-supplied lookup');
  it.todo('preserves priceSats verbatim from the validated intent');
  it.todo('preserves paymentAddress verbatim from the validated intent');
  it.todo('returns a fresh object (no shared reference with intent or sellerUtxo)');

  it('module export is wired (smoke test)', () => {
    expect(buildListing).toBeTypeOf('function');
  });
});

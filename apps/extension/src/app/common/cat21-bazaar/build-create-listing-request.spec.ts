import { describe, expect, it } from 'vitest';

import { buildCreateListingRequest } from './build-create-listing-request';

const TXID = 'ab49227cce490e2137872f7d08924187ee4f4bc7e8b3bda7ac63d7bba1d897df';
const BASE = {
  catNumber: 42,
  bundleCatNumbers: [42],
  askSats: 21_000,
  paymentAddress: 'bc1qpayment',
  ordinalsAddress: 'bc1pordinals',
  catTxid: TXID,
  catVout: 0,
  network: 'mainnet' as const,
};

describe('buildCreateListingRequest', () => {
  it('assembles the full DTO, carrying the caller-supplied network', () => {
    expect(buildCreateListingRequest(BASE)).toEqual({
      catNumber: 42,
      cats: [42],
      network: 'mainnet',
      askSats: 21_000,
      payTo: 'bc1qpayment',
      catTxid: TXID,
      catVout: 0,
      ordinalsAddress: 'bc1pordinals',
    });
  });

  it('passes a non-mainnet network through (regtest E2E against a real backend)', () => {
    expect(buildCreateListingRequest({ ...BASE, network: 'regtest' }).network).toBe('regtest');
  });

  it('dedupes + ascending-sorts bundleCatNumbers', () => {
    const req = buildCreateListingRequest({ ...BASE, bundleCatNumbers: [500, 42, 100, 42] });
    expect(req.cats).toEqual([42, 100, 500]);
  });

  it('throws when catNumber is not in the bundle', () => {
    expect(() =>
      buildCreateListingRequest({ ...BASE, catNumber: 7, bundleCatNumbers: [42, 100] })
    ).toThrow(/not in the bundle/);
  });

  it('throws on non-positive askSats', () => {
    expect(() => buildCreateListingRequest({ ...BASE, askSats: 0 })).toThrow(/askSats/);
  });

  it('throws on malformed txid', () => {
    expect(() => buildCreateListingRequest({ ...BASE, catTxid: 'nothex' })).toThrow(/catTxid/);
  });

  it('accepts catNumber 0 — the Genesis Cat is listable', () => {
    const req = buildCreateListingRequest({ ...BASE, catNumber: 0, bundleCatNumbers: [0] });
    expect(req.catNumber).toBe(0);
    expect(req.cats).toEqual([0]);
  });
});

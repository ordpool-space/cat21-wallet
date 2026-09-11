import { describe, expect, it, vi } from 'vitest';

import {
  BundleCatNumberResolver,
  resolveListingBundle,
  toListingNetwork,
} from './publish-to-bazaar.helper';

/**
 * The bundle resolver is the one place the wallet turns cat21-ord's
 * `/output.cats` into the cat NUMBERS the Bazaar DTO carries. cat21-ord emits
 * those entries as inscription-id STRINGS ("<txid>iN"); the cat21-indexer
 * `getCatsAtOutput` regression is exactly what happens when a consumer assumes
 * they are numbers. These tests pin that this resolver treats them as strings
 * end to end: the ids it forwards to `/cat/<id>` are the verbatim string ids.
 *
 * The resolver is mocked at its two IO methods (`fetchCat21`, `fetchOutput`)
 * whose return shapes match `OrdCat21` / `OrdOutput` as the sibling
 * cat21-ord-api.schema spec parses them from live responses.
 */

const HEADLINE_ID = 'aa'.repeat(32) + 'i0';
const SIBLING_ID = 'bb'.repeat(32) + 'i0';
const SELLER_UTXO = { txid: 'aa'.repeat(32), vout: 0 };

function resolver(opts: { numbersById: Record<string, number>; outputCats: string[] }): {
  ord: BundleCatNumberResolver;
  fetchCat21: ReturnType<typeof vi.fn>;
  fetchOutput: ReturnType<typeof vi.fn>;
} {
  const fetchCat21 = vi.fn((id: string): Promise<{ number: number }> => {
    const number = opts.numbersById[id];
    if (number === undefined) return Promise.reject(new Error(`no cat for id ${id}`));
    return Promise.resolve({ number });
  });
  const fetchOutput = vi.fn(
    (): Promise<{ cats: string[] }> => Promise.resolve({ cats: opts.outputCats })
  );
  return { ord: { fetchCat21, fetchOutput }, fetchCat21, fetchOutput };
}

describe('resolveListingBundle', () => {
  it('resolves a single-cat UTXO without a redundant /cat lookup for the headline', async () => {
    const { ord, fetchCat21 } = resolver({
      numbersById: { [HEADLINE_ID]: 42 },
      outputCats: [HEADLINE_ID],
    });

    const result = await resolveListingBundle(ord, { catId: HEADLINE_ID, sellerUtxo: SELLER_UTXO });

    expect(result).toEqual({ headlineNumber: 42, bundleCatNumbers: [42] });
    // headline resolved once; the bundle entry reuses it, so exactly one call.
    expect(fetchCat21).toHaveBeenCalledTimes(1);
    expect(fetchCat21).toHaveBeenCalledWith(HEADLINE_ID);
  });

  it('resolves a multi-cat bundle, mapping each id STRING to its number', async () => {
    const { ord, fetchCat21 } = resolver({
      numbersById: { [HEADLINE_ID]: 42, [SIBLING_ID]: 100 },
      outputCats: [HEADLINE_ID, SIBLING_ID],
    });

    const result = await resolveListingBundle(ord, { catId: HEADLINE_ID, sellerUtxo: SELLER_UTXO });

    expect(result).toEqual({ headlineNumber: 42, bundleCatNumbers: [42, 100] });
    // The sibling id — a STRING like "<txid>i0" — is forwarded verbatim, never
    // coerced to a number. This is the getCatsAtOutput guard.
    expect(fetchCat21).toHaveBeenCalledWith(SIBLING_ID);
    expect(typeof fetchCat21.mock.calls[fetchCat21.mock.calls.length - 1][0]).toBe('string');
  });

  it('preserves ord’s bundle order (backend cross-checks the exact set)', async () => {
    const { ord } = resolver({
      numbersById: { [HEADLINE_ID]: 42, [SIBLING_ID]: 7 },
      // ord lists the sibling first; the resolved numbers must follow that order.
      outputCats: [SIBLING_ID, HEADLINE_ID],
    });

    const result = await resolveListingBundle(ord, { catId: HEADLINE_ID, sellerUtxo: SELLER_UTXO });

    expect(result.bundleCatNumbers).toEqual([7, 42]);
  });

  it('reads the LIVE output (skipCache) so a stale bundle cannot be published', async () => {
    const { ord, fetchOutput } = resolver({
      numbersById: { [HEADLINE_ID]: 42 },
      outputCats: [HEADLINE_ID],
    });

    await resolveListingBundle(ord, {
      catId: HEADLINE_ID,
      sellerUtxo: { txid: 'aa'.repeat(32), vout: 3 },
    });

    expect(fetchOutput).toHaveBeenCalledWith(`${'aa'.repeat(32)}:3`, { skipCache: true });
  });

  it('propagates a resolution failure (unknown id) instead of inventing a number', async () => {
    const { ord } = resolver({
      numbersById: { [HEADLINE_ID]: 42 },
      outputCats: [HEADLINE_ID, SIBLING_ID], // sibling has no number → reject
    });

    await expect(
      resolveListingBundle(ord, { catId: HEADLINE_ID, sellerUtxo: SELLER_UTXO })
    ).rejects.toThrow();
  });
});

describe('toListingNetwork', () => {
  it('passes mainnet and regtest through unchanged', () => {
    expect(toListingNetwork('mainnet')).toBe('mainnet');
    expect(toListingNetwork('regtest')).toBe('regtest');
  });

  it.each(['testnet', 'testnet4', 'signet', 'anything-else', ''])(
    'collapses the non-mainnet, non-regtest mode %s to testnet3',
    mode => {
      expect(toListingNetwork(mode)).toBe('testnet3');
    }
  );
});

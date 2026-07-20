import { describe, expect, it, vi } from 'vitest';

import cat0 from '../infrastructure/api/cat21-ord/__fixtures__/cat-0.json';
import { Cat21OrdApiClient } from '../infrastructure/api/cat21-ord/cat21-ord-api.client';
import { AccountRequest } from '../types';
import { Cat21AssetService } from './cat21-asset.service';

const TAPROOT = 'bc1ptaproot';
const NATIVE_SEGWIT = 'bc1qsegwit';

function makeRequest(): AccountRequest {
  return {
    account: {
      bitcoin: {
        zeroIndexTaprootPayerAddress: TAPROOT,
        zeroIndexNativeSegwitPayerAddress: NATIVE_SEGWIT,
      },
    },
  } as unknown as AccountRequest;
}

function makeService(client: Partial<Cat21OrdApiClient>) {
  return new Cat21AssetService(client as Cat21OrdApiClient);
}

describe(Cat21AssetService.name, () => {
  it('maps every cat the addresses hold', async () => {
    const service = makeService({
      fetchAddressCat21s: vi.fn().mockResolvedValue({ cats: [cat0.id] }),
      fetchCat21: vi.fn().mockResolvedValue(cat0),
    });

    const assets = await service.getAccountCat21Assets(makeRequest());

    // Two addresses are walked, so the single fixture id comes back twice.
    expect(assets).toHaveLength(2);
    expect(assets[0].id).toBe(cat0.id);
    expect(assets[0].number).toBe(0);
    expect(assets[0].genesisBlockHash).toBe(cat0.block_hash);
  });

  it('returns nothing when a cat cannot be read, rather than a quiet subset', async () => {
    // The failure this pins: a schema mismatch against ord made every
    // fetchCat21 reject. Swallowing those individually rendered an empty list
    // that looked exactly like an account owning no cats.
    const service = makeService({
      fetchAddressCat21s: vi.fn().mockResolvedValue({ cats: [cat0.id, cat0.id] }),
      fetchCat21: vi
        .fn()
        .mockResolvedValueOnce(cat0)
        .mockRejectedValueOnce(new Error('schema mismatch')),
    });

    const assets = await service.getAccountCat21Assets(makeRequest());

    expect(assets).toEqual([]);
  });

  it('returns nothing when an address lookup fails', async () => {
    const service = makeService({
      fetchAddressCat21s: vi.fn().mockRejectedValue(new Error('ord unreachable')),
      fetchCat21: vi.fn(),
    });

    const assets = await service.getAccountCat21Assets(makeRequest());

    expect(assets).toEqual([]);
  });

  it('returns an empty list for an account that genuinely holds no cats', async () => {
    const fetchCat21 = vi.fn();
    const service = makeService({
      fetchAddressCat21s: vi.fn().mockResolvedValue({ cats: [] }),
      fetchCat21,
    });

    const assets = await service.getAccountCat21Assets(makeRequest());

    expect(assets).toEqual([]);
    // No ids means no per-cat round trips at all.
    expect(fetchCat21.mock.calls).toHaveLength(0);
  });

  it('walks both payer addresses', async () => {
    const fetchAddressCat21s = vi.fn().mockResolvedValue({ cats: [] });
    const service = makeService({ fetchAddressCat21s, fetchCat21: vi.fn() });

    await service.getAccountCat21Assets(makeRequest());

    expect(fetchAddressCat21s.mock.calls.map(c => c[0]).sort()).toEqual(
      [NATIVE_SEGWIT, TAPROOT].sort()
    );
  });

  it('skips the network entirely for an account with no bitcoin keys', async () => {
    const fetchAddressCat21s = vi.fn();
    const service = makeService({ fetchAddressCat21s, fetchCat21: vi.fn() });

    const assets = await service.getAccountCat21Assets({
      account: {},
    } as unknown as AccountRequest);

    expect(assets).toEqual([]);
    expect(fetchAddressCat21s.mock.calls).toHaveLength(0);
  });
});

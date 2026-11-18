import { beforeEach, describe, expect, it, vi } from 'vitest';

import addressWithCats from './__fixtures__/address-with-cats.json';
import cat0 from './__fixtures__/cat-0.json';
import outputWithCat from './__fixtures__/output-with-cat.json';
import status from './__fixtures__/status.json';
import { Cat21OrdApiClient } from './cat21-ord-api.client';

/**
 * Client-level behaviour: URL construction, the mandatory `Accept:
 * application/json` header, the cache/skip-cache branch, and — most importantly —
 * that a wrong-shaped body from ord is rejected rather than passed through.
 *
 * axios is mocked at the network boundary; every response body fed in is a real
 * captured ord.cat21.space fixture (the same ones the schema spec parses and
 * that were verified byte-for-byte against the live server). The cache and
 * rate-limiter collaborators are faked to pass-through so the client's own logic
 * is what runs, while still recording the cache key so we can assert it.
 */

const getMock = vi.fn();
vi.mock('axios', () => ({ default: { get: (...args: unknown[]) => getMock(...args) } }));

interface CacheCall {
  key: unknown[];
}

function makeClient() {
  const cacheCalls: CacheCall[] = [];
  const cache = {
    fetchWithCache: vi.fn((key: unknown[], fetchFn: () => Promise<unknown>) => {
      cacheCalls.push({ key });
      return fetchFn();
    }),
  };
  const limiter = {
    add: vi.fn((_type: unknown, fn: () => Promise<unknown>) => fn()),
  };
  // The client only touches `cache.fetchWithCache` and `limiter.add`; the casts
  // keep the test free of the full inversify container.
  const client = new Cat21OrdApiClient(cache as never, limiter as never);
  return { client, cache, limiter, cacheCalls };
}

function respondWith(body: unknown) {
  getMock.mockResolvedValueOnce({ data: body });
}

beforeEach(() => {
  getMock.mockReset();
});

describe('Cat21OrdApiClient URL + header + parse', () => {
  it('fetchStatus hits /status with the JSON accept header and returns a parsed status', async () => {
    const { client } = makeClient();
    respondWith(status);

    const result = await client.fetchStatus();

    expect(getMock).toHaveBeenCalledWith('https://ord.cat21.space/status', {
      signal: undefined,
      headers: { Accept: 'application/json' },
    });
    expect(result.height).toBe(status.height);
    expect(result.cats).toBe(status.cats);
  });

  it('fetchCat21 builds /cat/<id> and parses the real cat-0 body', async () => {
    const { client } = makeClient();
    respondWith(cat0);

    const result = await client.fetchCat21(cat0.id);

    expect(getMock).toHaveBeenCalledWith(
      `https://ord.cat21.space/cat/${cat0.id}`,
      expect.objectContaining({ headers: { Accept: 'application/json' } })
    );
    expect(result.number).toBe(0);
    expect(result.block_hash).toBe(cat0.block_hash);
  });

  it('fetchAddressCat21s builds /address/<addr> and returns the cats array', async () => {
    const { client } = makeClient();
    const address = 'bc1p85ra9kv6a48yvk4mq4hx08wxk6t32tdjw9ylahergexkymsc3uwsdrx6sh';
    respondWith(addressWithCats);

    const result = await client.fetchAddressCat21s(address);

    expect(getMock).toHaveBeenCalledWith(
      `https://ord.cat21.space/address/${address}`,
      expect.objectContaining({ headers: { Accept: 'application/json' } })
    );
    expect(result.cats).toEqual(addressWithCats.cats);
  });

  it('fetchOutput builds /output/<outpoint> and parses value + cats', async () => {
    const { client } = makeClient();
    respondWith(outputWithCat);

    const result = await client.fetchOutput(outputWithCat.outpoint);

    expect(getMock).toHaveBeenCalledWith(
      `https://ord.cat21.space/output/${encodeURIComponent(outputWithCat.outpoint)}`,
      expect.objectContaining({ headers: { Accept: 'application/json' } })
    );
    expect(result.value).toBe(outputWithCat.value);
    expect(result.cats).toEqual(outputWithCat.cats);
  });

  it('percent-encodes an outpoint so the path separator cannot break the URL', async () => {
    const { client } = makeClient();
    respondWith(outputWithCat);

    await client.fetchOutput('abc:0');

    // encodeURIComponent turns the ':' into %3A; the query is one path segment.
    expect(getMock).toHaveBeenCalledWith(
      'https://ord.cat21.space/output/abc%3A0',
      expect.anything()
    );
  });
});

describe('Cat21OrdApiClient caching', () => {
  it('routes through the cache with a stable key by default', async () => {
    const { client, cacheCalls } = makeClient();
    respondWith(status);

    await client.fetchStatus();

    expect(cacheCalls).toHaveLength(1);
    expect(cacheCalls[0].key).toEqual(['cat21-ord-status']);
  });

  it('keys the cache by the query argument for per-item endpoints', async () => {
    const { client, cacheCalls } = makeClient();
    respondWith(outputWithCat);

    await client.fetchOutput('deadbeef:1');

    expect(cacheCalls[0].key).toEqual(['cat21-ord-output', 'deadbeef:1']);
  });

  it('skips the cache entirely when skipCache is set', async () => {
    const { client, cache } = makeClient();
    respondWith(status);

    await client.fetchStatus({ skipCache: true });

    expect(cache.fetchWithCache).not.toHaveBeenCalled();
    expect(getMock).toHaveBeenCalledTimes(1);
  });
});

describe('Cat21OrdApiClient rejects wrong-shaped bodies', () => {
  it('throws when /status reports an ord that is not indexing cats', async () => {
    const { client } = makeClient();
    respondWith({ ...status, cat_index: false });

    await expect(client.fetchStatus()).rejects.toThrow();
  });

  it('throws when /status is on the wrong network', async () => {
    const { client } = makeClient();
    respondWith({ ...status, chain: 'testnet' });

    await expect(client.fetchStatus()).rejects.toThrow();
  });

  it('throws when /address carries ord upstream name (inscriptions) instead of cats', async () => {
    const { client } = makeClient();
    const { cats, ...rest } = addressWithCats;
    respondWith({ ...rest, inscriptions: cats });

    await expect(
      client.fetchAddressCat21s('bc1pexampleexampleexampleexampleexampleexampleex')
    ).rejects.toThrow();
  });

  it('throws when a cat body is missing the block_hash the renderer needs', async () => {
    const { client } = makeClient();
    const { block_hash: _omit, ...withoutBlockHash } = cat0;
    respondWith(withoutBlockHash);

    await expect(client.fetchCat21(cat0.id)).rejects.toThrow();
  });
});

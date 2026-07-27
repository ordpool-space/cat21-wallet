import { buildCat21SessionMessage } from 'ordpool-sdk/core';
import { describe, expect, it, vi } from 'vitest';

import { clearCat21Session, getOrCreateCat21Session } from './cat21-session';

const ADDR = 'bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxq7pkrz9';
const ADDR_B = 'bc1pw508d6qejxtdg4y5r3zarvary0c5xw7kw508d6qejxtdg4y5r3zarvary0c5xw7kqzk5jj0';
const DAY_MS = 24 * 60 * 60 * 1_000;

/** In-memory Storage stand-in — only the 3 methods the module touches. */
function makeStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & {
  map: Map<string, string>;
} {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe('getOrCreateCat21Session', () => {
  it('first call signs the EXACT canonical session message from buildCat21SessionMessage', async () => {
    const storage = makeStorage();
    const nowMs = 1_700_000_000_000;
    const signBip322 = vi.fn(async () => 'SIG_BASE64');

    await getOrCreateCat21Session({ address: ADDR, signBip322, nowMs, storage });

    const validUntilIso = new Date(nowMs + DAY_MS).toISOString();
    const expectedMessage = buildCat21SessionMessage({ address: ADDR, validUntilIso });
    expect(signBip322).toHaveBeenCalledWith(expectedMessage);
  });

  it('returns the three headers with address, validUntilIso, and the signature the signer produced', async () => {
    const storage = makeStorage();
    const nowMs = 1_700_000_000_000;
    const headers = await getOrCreateCat21Session({
      address: ADDR,
      signBip322: async () => 'SIG_BASE64',
      nowMs,
      storage,
    });
    expect(headers).toEqual({
      'X-Cat21-Session-Address': ADDR,
      'X-Cat21-Session-Valid-Until': new Date(nowMs + DAY_MS).toISOString(),
      'X-Cat21-Session-Signature': 'SIG_BASE64',
    });
  });

  it('validUntilIso is nowMs + 24h', async () => {
    const storage = makeStorage();
    const nowMs = 1_700_000_000_000;
    const headers = await getOrCreateCat21Session({
      address: ADDR,
      signBip322: async () => 'SIG_BASE64',
      nowMs,
      storage,
    });
    const delta = Date.parse(headers['X-Cat21-Session-Valid-Until']) - nowMs;
    expect(delta).toBe(DAY_MS);
  });

  it('second call within validity returns the cached token — signer called exactly once', async () => {
    const storage = makeStorage();
    const nowMs = 1_700_000_000_000;
    const signBip322 = vi.fn(async () => 'SIG_BASE64');

    const first = await getOrCreateCat21Session({ address: ADDR, signBip322, nowMs, storage });
    const second = await getOrCreateCat21Session({
      address: ADDR,
      signBip322,
      nowMs: nowMs + 60 * 60 * 1_000, // +1h, still well inside 24h
      storage,
    });

    expect(signBip322).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it('cached token with < 60s validity left is discarded and re-signed (grace window)', async () => {
    const storage = makeStorage();
    const signAt = 1_700_000_000_000;
    const signBip322 = vi.fn(async () => 'SIG_BASE64');

    await getOrCreateCat21Session({ address: ADDR, signBip322, nowMs: signAt, storage });
    // 30s before expiry — inside the 60s grace window → must re-sign.
    const nearExpiry = signAt + DAY_MS - 30_000;
    await getOrCreateCat21Session({ address: ADDR, signBip322, nowMs: nearExpiry, storage });

    expect(signBip322).toHaveBeenCalledTimes(2);
  });

  it('expired cached token is discarded and re-signed', async () => {
    const storage = makeStorage();
    const signAt = 1_700_000_000_000;
    const signBip322 = vi.fn(async () => 'SIG_BASE64');

    await getOrCreateCat21Session({ address: ADDR, signBip322, nowMs: signAt, storage });
    await getOrCreateCat21Session({
      address: ADDR,
      signBip322,
      nowMs: signAt + DAY_MS + 1,
      storage,
    });

    expect(signBip322).toHaveBeenCalledTimes(2);
  });

  it('corrupt JSON in storage is treated as a miss, not a crash', async () => {
    const storage = makeStorage();
    // Storage key is an internal detail; seed the raw slot directly.
    storage.setItem(`cat21-session-${ADDR}`, '{not json');
    const signBip322 = vi.fn(async () => 'SIG_BASE64');

    const headers = await getOrCreateCat21Session({
      address: ADDR,
      signBip322,
      nowMs: 1_700_000_000_000,
      storage,
    });
    expect(signBip322).toHaveBeenCalledTimes(1);
    expect(headers['X-Cat21-Session-Signature']).toBe('SIG_BASE64');
  });
});

describe('clearCat21Session', () => {
  it('after clearing, the next getOrCreateCat21Session signs a fresh token', async () => {
    const storage = makeStorage();
    const nowMs = 1_700_000_000_000;
    const signBip322 = vi.fn(async () => 'SIG_BASE64');

    await getOrCreateCat21Session({ address: ADDR, signBip322, nowMs, storage });
    clearCat21Session(ADDR, storage);
    await getOrCreateCat21Session({ address: ADDR, signBip322, nowMs, storage });

    expect(signBip322).toHaveBeenCalledTimes(2);
  });

  it("clearing address A leaves address B's cached session intact", async () => {
    const storage = makeStorage();
    const nowMs = 1_700_000_000_000;

    // Sign A + B with signatures we can tell apart.
    const bHeaders = await getOrCreateCat21Session({
      address: ADDR_B,
      signBip322: async () => 'SIG_B',
      nowMs,
      storage,
    });
    await getOrCreateCat21Session({
      address: ADDR,
      signBip322: async () => 'SIG_A',
      nowMs,
      storage,
    });

    clearCat21Session(ADDR, storage);

    // B is still cached: fetching it again with a signer that would
    // throw if invoked returns B's ORIGINAL headers (cache hit).
    const bAfter = await getOrCreateCat21Session({
      address: ADDR_B,
      signBip322: async () => {
        throw new Error('B should have been served from cache — signer must not run');
      },
      nowMs,
      storage,
    });
    expect(bAfter).toEqual(bHeaders);
    expect(bAfter['X-Cat21-Session-Signature']).toBe('SIG_B');

    // A was cleared: fetching it re-signs (fresh signature value).
    const aAfter = await getOrCreateCat21Session({
      address: ADDR,
      signBip322: async () => 'SIG_A_FRESH',
      nowMs,
      storage,
    });
    expect(aAfter['X-Cat21-Session-Signature']).toBe('SIG_A_FRESH');
  });
});

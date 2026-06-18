import { describe, expect, it, vi } from 'vitest';

import {
  type SessionStorageLike,
  cat21RequestStorageKey,
  clearCat21Request,
  fetchCat21Request,
  stashCat21Request,
} from './popup-bridge';
import type { Cat21MintIntent } from './types';

/**
 * In-memory storage fake matching the narrow `SessionStorageLike`
 * shape. Mirrors `chrome.storage.session`'s "callback-as-promise"
 * surface. Built fresh per test so each assertion sees a clean state.
 */
function makeFakeStorage(): SessionStorageLike & { state: Record<string, unknown> } {
  const state: Record<string, unknown> = {};
  return {
    state,
    async set(items) {
      for (const [k, v] of Object.entries(items)) state[k] = v;
    },
    async get(keys) {
      const want = Array.isArray(keys) ? keys : [keys];
      const out: Record<string, unknown> = {};
      for (const k of want) if (k in state) out[k] = state[k];
      return out;
    },
    async remove(keys) {
      const want = Array.isArray(keys) ? keys : [keys];
      for (const k of want) delete state[k];
    },
  };
}

const mintIntent: Cat21MintIntent = {
  recipient: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
  feeRate: 7,
};

describe('cat21RequestStorageKey', () => {
  it('formats the key as cat21-request-<id> so a future grep finds every persisted intent', () => {
    expect(cat21RequestStorageKey('abc-123')).toBe('cat21-request-abc-123');
  });
});

describe('stashCat21Request', () => {
  it('writes intent + transport + stashedAt under the cat21RequestStorageKey', async () => {
    const storage = makeFakeStorage();
    const result = await stashCat21Request({
      intent: mintIntent,
      transport: 'mcp-nmh',
      storage,
      generateId: () => 'pinned-id-42',
      now: () => 1_700_000_000_000,
    });

    expect(result.requestId).toBe('pinned-id-42');
    expect(storage.state['cat21-request-pinned-id-42']).toEqual({
      intent: mintIntent,
      transport: 'mcp-nmh',
      stashedAt: 1_700_000_000_000,
    });
  });

  it('encodes the request id as the cat21RequestId search param so the popup can read it from URL', async () => {
    const storage = makeFakeStorage();
    const result = await stashCat21Request({
      intent: mintIntent,
      transport: 'mcp-nmh',
      storage,
      generateId: () => 'pinned-id-42',
    });

    expect(result.urlParams.get('cat21RequestId')).toBe('pinned-id-42');
  });

  it('uses crypto.randomUUID by default — the generateId injection is a test seam, not a runtime knob', async () => {
    const storage = makeFakeStorage();
    const spy = vi.spyOn(crypto, 'randomUUID');
    await stashCat21Request({ intent: mintIntent, transport: 'mcp-nmh', storage });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe('fetchCat21Request', () => {
  it('returns the stashed record verbatim when the key exists (round-trip identity)', async () => {
    const storage = makeFakeStorage();
    await stashCat21Request({
      intent: mintIntent,
      transport: 'popup',
      storage,
      generateId: () => 'round-trip',
      now: () => 1_700_000_000_000,
    });

    const fetched = await fetchCat21Request(storage, 'round-trip');
    expect(fetched).toEqual({
      intent: mintIntent,
      transport: 'popup',
      stashedAt: 1_700_000_000_000,
    });
  });

  it('returns null when the request id has no stashed record (eg. wallet restarted between popup-open and popup-load)', async () => {
    const storage = makeFakeStorage();
    const fetched = await fetchCat21Request(storage, 'never-existed');
    expect(fetched).toBeNull();
  });
});

describe('clearCat21Request', () => {
  it('removes the stashed record so a subsequent fetch returns null', async () => {
    const storage = makeFakeStorage();
    await stashCat21Request({
      intent: mintIntent,
      transport: 'mcp-nmh',
      storage,
      generateId: () => 'to-clear',
    });

    expect(await fetchCat21Request(storage, 'to-clear')).not.toBeNull();
    await clearCat21Request(storage, 'to-clear');
    expect(await fetchCat21Request(storage, 'to-clear')).toBeNull();
  });
});

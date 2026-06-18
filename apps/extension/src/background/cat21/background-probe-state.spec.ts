import { describe, expect, it } from 'vitest';

import { makeBackgroundProbeStateCache } from './background-probe-state';
import { type SessionStorageLike } from './popup-bridge';

function makeFakeStorage(initial?: Record<string, unknown>): SessionStorageLike & {
  state: Record<string, unknown>;
} {
  const state: Record<string, unknown> = { ...(initial ?? {}) };
  return {
    state,
    set(items) {
      for (const [k, v] of Object.entries(items)) state[k] = v;
      return Promise.resolve();
    },
    get(keys) {
      const want = Array.isArray(keys) ? keys : [keys];
      const out: Record<string, unknown> = {};
      for (const k of want) if (k in state) out[k] = state[k];
      return Promise.resolve(out);
    },
    remove(keys) {
      const want = Array.isArray(keys) ? keys : [keys];
      for (const k of want) delete state[k];
      return Promise.resolve();
    },
  };
}

function makeFakeOnChanged() {
  const listeners: ((
    changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
    areaName: string
  ) => void)[] = [];
  return {
    addListener(
      l: (
        changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
        areaName: string
      ) => void
    ) {
      listeners.push(l);
    },
    /** Test seam: deliver a synthesized change event. */
    fire(changes: Record<string, { newValue?: unknown; oldValue?: unknown }>, areaName: string) {
      for (const l of listeners) l(changes, areaName);
    },
  };
}

const sampleEncoded = JSON.stringify({
  network: 'testnet',
  accountId: 'fp:1',
  activeAccountAddress: 'tb1qbbb',
  agentModeEnabled: true,
});

function passthroughDecode(raw: unknown) {
  if (typeof raw !== 'string') {
    return {
      network: 'mainnet' as const,
      accountId: '',
      activeAccountAddress: undefined,
      agentModeEnabled: false,
    };
  }
  return JSON.parse(raw) as {
    network: 'mainnet' | 'testnet';
    accountId: string;
    activeAccountAddress: string | undefined;
    agentModeEnabled: boolean;
  };
}

describe('makeBackgroundProbeStateCache', () => {
  it('returns DEFAULT_STATE before bootstrap (boot-race-friendly empty fallback)', () => {
    const cache = makeBackgroundProbeStateCache({
      storage: makeFakeStorage({ 'persist:root': sampleEncoded }),
      onChanged: makeFakeOnChanged(),
      decode: passthroughDecode,
    });
    expect(cache.read()).toEqual({
      network: 'mainnet',
      accountId: '',
      activeAccountAddress: undefined,
      agentModeEnabled: false,
    });
  });

  it('bootstrap loads the cached state from storage and decode shapes it', async () => {
    const cache = makeBackgroundProbeStateCache({
      storage: makeFakeStorage({ 'persist:root': sampleEncoded }),
      onChanged: makeFakeOnChanged(),
      decode: passthroughDecode,
    });
    await cache.bootstrap();
    expect(cache.read()).toEqual({
      network: 'testnet',
      accountId: 'fp:1',
      activeAccountAddress: 'tb1qbbb',
      agentModeEnabled: true,
    });
  });

  it('onChanged updates the cache live so an account switch reaches the probes', async () => {
    const onChanged = makeFakeOnChanged();
    const cache = makeBackgroundProbeStateCache({
      storage: makeFakeStorage({ 'persist:root': sampleEncoded }),
      onChanged,
      decode: passthroughDecode,
    });
    await cache.bootstrap();
    const newEncoded = JSON.stringify({
      network: 'mainnet',
      accountId: 'fp:2',
      activeAccountAddress: 'bc1qccc',
      agentModeEnabled: false,
    });
    onChanged.fire({ 'persist:root': { newValue: newEncoded } }, 'local');
    expect(cache.read()).toEqual({
      network: 'mainnet',
      accountId: 'fp:2',
      activeAccountAddress: 'bc1qccc',
      agentModeEnabled: false,
    });
  });

  it('ignores onChanged events on other areas (session, sync, etc.)', async () => {
    const onChanged = makeFakeOnChanged();
    const cache = makeBackgroundProbeStateCache({
      storage: makeFakeStorage({ 'persist:root': sampleEncoded }),
      onChanged,
      decode: passthroughDecode,
    });
    await cache.bootstrap();
    onChanged.fire({ 'persist:root': { newValue: 'ignored' } }, 'session');
    expect(cache.read().accountId).toBe('fp:1');
  });

  it('ignores onChanged events for other keys', async () => {
    const onChanged = makeFakeOnChanged();
    const cache = makeBackgroundProbeStateCache({
      storage: makeFakeStorage({ 'persist:root': sampleEncoded }),
      onChanged,
      decode: passthroughDecode,
    });
    await cache.bootstrap();
    onChanged.fire({ 'address-monitor': { newValue: ['anything'] } }, 'local');
    expect(cache.read().accountId).toBe('fp:1');
  });

  it('respects the rootKey override (consumer can swap the persistence root)', async () => {
    const cache = makeBackgroundProbeStateCache({
      storage: makeFakeStorage({ 'cat21:rootv2': sampleEncoded }),
      onChanged: makeFakeOnChanged(),
      rootKey: 'cat21:rootv2',
      decode: passthroughDecode,
    });
    await cache.bootstrap();
    expect(cache.read().accountId).toBe('fp:1');
  });
});

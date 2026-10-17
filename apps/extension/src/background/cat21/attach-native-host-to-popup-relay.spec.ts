import { describe, expect, it, vi } from 'vitest';

import { type RouteUrls, RouteUrls as Routes } from '@shared/route-urls';

import { attachNativeHostToPopupRelay } from './attach-native-host-to-popup-relay';
import { type SessionStorageLike } from './popup-bridge';
import type { Cat21MintIntent } from './types';

function makeFakePort() {
  const listeners: ((msg: unknown) => void)[] = [];
  const postMessage = vi.fn();
  return {
    postMessage,
    onMessage: {
      addListener(l: (msg: unknown) => void) {
        listeners.push(l);
      },
    },
    onDisconnect: {
      addListener() {
        // not exercised in these tests; the disconnect-listener
        // wiring is the production-only path and lives in iter 12g
      },
    },
    /** Fire a message synchronously to all attached listeners. */
    fire(msg: unknown) {
      for (const l of listeners) l(msg);
    },
  };
}

function makeFakeStorage(): SessionStorageLike & { state: Record<string, unknown> } {
  const state: Record<string, unknown> = {};
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

/**
 * Read-only probe stand-ins for the mutating-flow specs that
 * shouldn't touch the probe surface. Each method throws so a test
 * that accidentally routes a mutating message through the probe
 * handler fails loudly.
 */
function throwingProbes() {
  return {
    listCatsAtActiveAccount: () =>
      Promise.reject(new Error('probe should not be called by mutating spec')),
    readWalletStatus: () => {
      throw new Error('probe should not be called by mutating spec');
    },
    readCat21OrdStatus: () =>
      Promise.reject(new Error('probe should not be called by mutating spec')),
  };
}

interface FakeSender {
  id?: string;
  tab?: unknown;
  url?: string;
}
function makeFakeOnMessage() {
  const listeners = new Set<(msg: unknown, sender?: FakeSender) => void>();
  return {
    onMessage: {
      addListener(l: (msg: unknown, sender?: FakeSender) => void) {
        listeners.add(l);
      },
      removeListener(l: (msg: unknown, sender?: FakeSender) => void) {
        listeners.delete(l);
      },
    },
    /** Used by tests to deliver a result envelope back from the "popup". */
    deliver(msg: unknown, sender: FakeSender = { id: 'own-ext-id' }) {
      for (const l of [...listeners]) l(msg, sender);
    },
  };
}

/** Default verifier these specs wire — accepts the spec's own-ext id. */
function acceptOwnSpecExt(sender: FakeSender | undefined): boolean {
  return sender?.id === 'own-ext-id' && sender?.tab === undefined;
}

const mintIntent: Cat21MintIntent = {
  recipient: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
  feeRate: 7,
};

describe('attachNativeHostToPopupRelay', () => {
  it('round-trips one cat21_mint NMH call through the popup-result bus', async () => {
    const port = makeFakePort();
    const storage = makeFakeStorage();
    const bus = makeFakeOnMessage();
    const openedRoutes: RouteUrls[] = [];

    attachNativeHostToPopupRelay({
      port,
      storage,
      onMessage: bus.onMessage,
      readOnlyProbes: throwingProbes(),
      verifyResultBusSender: acceptOwnSpecExt,
      triggerPopupOpen(route, urlParams) {
        openedRoutes.push(route);
        const requestId = urlParams.get('cat21RequestId');
        // Simulate the popup posting a result back AFTER
        // `waitForPopupResult` has set up its subscribe listener.
        // setTimeout(0) drains current microtasks first, ensuring
        // subscribe is registered before deliver fires.
        setTimeout(() => {
          bus.deliver({
            source: 'cat21-result-bus',
            requestId,
            result: {
              ok: true,
              value: { kind: 'broadcast', txid: 'deadbeef', channel: 'mempool' },
            },
          });
        }, 0);
        return Promise.resolve();
      },
    });

    port.fire({ type: 'cat21_mint', id: 'nmh-abc', payload: mintIntent });

    // Drain the macrotask queue (the deliver is on setTimeout(0)) +
    // microtasks until postMessage fires. Bounded to avoid runaway.
    for (let i = 0; i < 50 && port.postMessage.mock.calls.length === 0; i++) {
      await new Promise(r => setTimeout(r, 0));
    }

    expect(openedRoutes).toEqual([Routes.Cat21MintConfirm]);
    expect(port.postMessage).toHaveBeenCalledTimes(1);
    expect(port.postMessage).toHaveBeenCalledWith({
      type: 'cat21_mint:result',
      id: 'nmh-abc',
      payload: {
        ok: true,
        value: { kind: 'broadcast', txid: 'deadbeef', channel: 'mempool' },
      },
    });
    expect(Object.keys(storage.state)).toEqual([]);
  });

  it('writes a typed broadcast-failed denial back over the port when the popup-open call throws', async () => {
    const port = makeFakePort();
    const storage = makeFakeStorage();
    const bus = makeFakeOnMessage();

    attachNativeHostToPopupRelay({
      port,
      storage,
      onMessage: bus.onMessage,
      readOnlyProbes: throwingProbes(),
      verifyResultBusSender: acceptOwnSpecExt,
      triggerPopupOpen: () => Promise.reject(new Error('popup blocked by Chrome')),
    });

    port.fire({ type: 'cat21_mint', id: 'nmh-err', payload: mintIntent });

    for (let i = 0; i < 50 && port.postMessage.mock.calls.length === 0; i++) {
      await Promise.resolve();
    }

    expect(port.postMessage).toHaveBeenCalledTimes(1);
    expect(port.postMessage).toHaveBeenCalledWith({
      type: 'cat21_mint:result',
      id: 'nmh-err',
      payload: {
        ok: false,
        value: {
          reason: 'broadcast-failed',
          detail: 'relay-error: popup blocked by Chrome',
        },
      },
    });
    // Storage is cleared in the relay's finally even on the error path.
    expect(Object.keys(storage.state)).toEqual([]);
  });

  it('silently ignores noise on the port that is neither a probe nor a mutating envelope', () => {
    const port = makeFakePort();
    const storage = makeFakeStorage();
    const bus = makeFakeOnMessage();

    attachNativeHostToPopupRelay({
      port,
      storage,
      onMessage: bus.onMessage,
      readOnlyProbes: throwingProbes(),
      verifyResultBusSender: acceptOwnSpecExt,
      triggerPopupOpen: () => Promise.resolve(),
    });

    port.fire({ type: 'unknown_method', id: '99' });
    port.fire('plain-string-noise');
    port.fire(null);

    expect(port.postMessage).not.toHaveBeenCalled();
    expect(Object.keys(storage.state)).toEqual([]);
  });

  it('routes list_cats through the read-only probe handler without opening the popup', async () => {
    const port = makeFakePort();
    const storage = makeFakeStorage();
    const bus = makeFakeOnMessage();
    let popupOpened = false;

    attachNativeHostToPopupRelay({
      port,
      storage,
      onMessage: bus.onMessage,
      triggerPopupOpen: () => {
        popupOpened = true;
        return Promise.resolve();
      },
      readOnlyProbes: {
        listCatsAtActiveAccount: () => Promise.resolve(['cat-a', 'cat-b']),
        readWalletStatus: () => {
          throw new Error('not called');
        },
        readCat21OrdStatus: () => Promise.reject(new Error('not called')),
      },
      verifyResultBusSender: acceptOwnSpecExt,
    });

    port.fire({ type: 'list_cats', id: 'probe-1' });

    for (let i = 0; i < 50 && port.postMessage.mock.calls.length === 0; i++) {
      await new Promise(r => setTimeout(r, 0));
    }

    expect(popupOpened).toBe(false);
    expect(port.postMessage).toHaveBeenCalledTimes(1);
    expect(port.postMessage).toHaveBeenCalledWith({
      type: 'list_cats:result',
      id: 'probe-1',
      payload: ['cat-a', 'cat-b'],
    });
    expect(Object.keys(storage.state)).toEqual([]);
  });

  it('round-trips wallet_status synchronously over the port', async () => {
    const port = makeFakePort();
    const storage = makeFakeStorage();
    const bus = makeFakeOnMessage();

    attachNativeHostToPopupRelay({
      port,
      storage,
      onMessage: bus.onMessage,
      triggerPopupOpen: () => Promise.reject(new Error('not called')),
      readOnlyProbes: {
        listCatsAtActiveAccount: () => Promise.reject(new Error('not called')),
        readWalletStatus: () => ({
          network: 'testnet',
          accountId: 'fp:7',
          agentMode: { enabled: false },
        }),
        readCat21OrdStatus: () => Promise.reject(new Error('not called')),
      },
      verifyResultBusSender: acceptOwnSpecExt,
    });

    port.fire({ type: 'wallet_status', id: 'probe-2' });

    for (let i = 0; i < 50 && port.postMessage.mock.calls.length === 0; i++) {
      await new Promise(r => setTimeout(r, 0));
    }

    expect(port.postMessage).toHaveBeenCalledWith({
      type: 'wallet_status:result',
      id: 'probe-2',
      payload: { network: 'testnet', accountId: 'fp:7', agentMode: { enabled: false } },
    });
  });

  it('cat21_ord_status reports reachable:false-with-error when the deps call rejects', async () => {
    const port = makeFakePort();
    const storage = makeFakeStorage();
    const bus = makeFakeOnMessage();

    attachNativeHostToPopupRelay({
      port,
      storage,
      onMessage: bus.onMessage,
      triggerPopupOpen: () => Promise.reject(new Error('not called')),
      readOnlyProbes: {
        listCatsAtActiveAccount: () => Promise.reject(new Error('not called')),
        readWalletStatus: () => {
          throw new Error('not called');
        },
        readCat21OrdStatus: () => Promise.reject(new Error('ECONNREFUSED')),
      },
      verifyResultBusSender: acceptOwnSpecExt,
    });

    port.fire({ type: 'cat21_ord_status', id: 'probe-3' });

    for (let i = 0; i < 50 && port.postMessage.mock.calls.length === 0; i++) {
      await new Promise(r => setTimeout(r, 0));
    }

    expect(port.postMessage).toHaveBeenCalledWith({
      type: 'cat21_ord_status:result',
      id: 'probe-3',
      payload: { reachable: false, error: 'ECONNREFUSED' },
    });
  });
});

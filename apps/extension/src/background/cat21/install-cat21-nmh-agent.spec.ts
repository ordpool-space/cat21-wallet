import { describe, expect, it, vi } from 'vitest';

import { installCat21NmhAgent } from './install-cat21-nmh-agent';
import { type SessionStorageLike } from './popup-bridge';

function makeFakePort() {
  const dcListeners: (() => void)[] = [];
  return {
    postMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
    },
    onDisconnect: {
      addListener(cb: () => void) {
        dcListeners.push(cb);
      },
    },
    fireDisconnect() {
      for (const cb of dcListeners) cb();
    },
  };
}

function makeFakeStorage(): SessionStorageLike {
  const state: Record<string, unknown> = {};
  return {
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

function makeFakeOnMessage() {
  const listeners = new Set<(msg: unknown) => void>();
  return {
    addListener(l: (msg: unknown) => void) {
      listeners.add(l);
    },
    removeListener(l: (msg: unknown) => void) {
      listeners.delete(l);
    },
  };
}

const sampleState = {
  network: 'mainnet' as const,
  accountId: 'fp:0',
  activeAccountAddress: 'bc1qaaa',
  agentModeEnabled: false,
};

function happyProbes() {
  return {
    listCatsAtActiveAccount: () => Promise.resolve(['cat-a']),
    readWalletStatus: () => ({
      network: 'mainnet' as const,
      accountId: 'fp:0',
      agentMode: { enabled: false },
    }),
    readCat21OrdStatus: () => Promise.resolve({ reachable: true }),
  };
}

describe('installCat21NmhAgent', () => {
  it('opens the connectNative port with the cat21 application name on first install', () => {
    const port = makeFakePort();
    const connectNative = vi.fn(() => port);
    installCat21NmhAgent({
      connectNative,
      storage: makeFakeStorage(),
      onMessage: makeFakeOnMessage(),
      triggerPopupOpen: () => Promise.resolve(),
      getState: () => sampleState,
      readOnlyProbes: happyProbes(),
    });
    expect(connectNative).toHaveBeenCalledTimes(1);
    expect(connectNative).toHaveBeenCalledWith('space.cat21.wallet');
  });

  it('attaches the relay on the live port — fresh-port onMessage subscriber lands on the relay handler', () => {
    const port = makeFakePort();
    const connectNative = vi.fn(() => port);
    installCat21NmhAgent({
      connectNative,
      storage: makeFakeStorage(),
      onMessage: makeFakeOnMessage(),
      triggerPopupOpen: () => Promise.resolve(),
      getState: () => sampleState,
      readOnlyProbes: happyProbes(),
    });
    // attachNativeHostToPopupRelay registers exactly one onMessage
    // listener on the port; if the lifecycle wires the attach
    // correctly, the listener count is 1.
    expect(port.onMessage.addListener).toHaveBeenCalledTimes(1);
  });

  it('teardown stops further reconnect attempts', () => {
    const port = makeFakePort();
    const connectNative = vi.fn(() => port);
    const agent = installCat21NmhAgent({
      connectNative,
      storage: makeFakeStorage(),
      onMessage: makeFakeOnMessage(),
      triggerPopupOpen: () => Promise.resolve(),
      getState: () => sampleState,
      readOnlyProbes: happyProbes(),
    });
    agent.teardown();
    expect(agent.state()).toBe('idle');
    // A subsequent disconnect on the (dead) port should NOT result
    // in a reconnect because teardown set the `stopped` flag in the
    // lifecycle.
    port.fireDisconnect();
    expect(connectNative).toHaveBeenCalledTimes(1);
  });
});

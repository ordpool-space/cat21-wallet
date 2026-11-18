import { describe, expect, it, vi } from 'vitest';

import { makeReadOnlyProbeWires } from './make-read-only-probe-wires';

const sampleState = {
  network: 'mainnet' as const,
  accountId: 'abcd1234:0',
  activeAccountAddress: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
  agentModeEnabled: true,
};

/**
 * Tiny `Cat21OrdApiClient`-shaped fake exposing only the two methods
 * the wires touch. Returns identifiable sentinels so specs assert
 * round-trip rather than just shape.
 */
function makeFakeClient(overrides?: {
  fetchAddressCat21s?: ReturnType<typeof vi.fn>;
  fetchStatus?: ReturnType<typeof vi.fn>;
}) {
  return {
    fetchAddressCat21s:
      overrides?.fetchAddressCat21s ??
      vi.fn(() => Promise.resolve({ cats: ['cat-1i0', 'cat-2i0'] })),
    fetchStatus:
      overrides?.fetchStatus ??
      vi.fn(() =>
        Promise.resolve({
          height: 921234,
          chain: 'mainnet' as const,
          cat_index: true as const,
          address_index: true as const,
          sat_index: true as const,
          cats: 75432,
        })
      ),
  };
}

describe('makeReadOnlyProbeWires.listCatsAtActiveAccount', () => {
  it('passes the active-account address to fetchAddressCat21s and returns the cats array', async () => {
    const client = makeFakeClient();
    const wires = makeReadOnlyProbeWires({ getState: () => sampleState, cat21OrdClient: client });

    await expect(wires.listCatsAtActiveAccount()).resolves.toEqual(['cat-1i0', 'cat-2i0']);
    expect(client.fetchAddressCat21s).toHaveBeenCalledTimes(1);
    expect(client.fetchAddressCat21s).toHaveBeenCalledWith(
      'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'
    );
  });

  it('returns [] without hitting cat21-ord when the active address is undefined (wallet still booting)', async () => {
    const client = makeFakeClient();
    const wires = makeReadOnlyProbeWires({
      getState: () => ({ ...sampleState, activeAccountAddress: undefined }),
      cat21OrdClient: client,
    });

    await expect(wires.listCatsAtActiveAccount()).resolves.toEqual([]);
    expect(client.fetchAddressCat21s).not.toHaveBeenCalled();
  });

  it('lets the cat21-ord rejection bubble so the probe handler can encode it inline', async () => {
    const client = makeFakeClient({
      fetchAddressCat21s: vi.fn(() => Promise.reject(new Error('cat21-ord offline'))),
    });
    const wires = makeReadOnlyProbeWires({ getState: () => sampleState, cat21OrdClient: client });

    await expect(wires.listCatsAtActiveAccount()).rejects.toThrow('cat21-ord offline');
  });

  it('re-reads state on every call so account switches are reflected (no stale capture)', async () => {
    const client = makeFakeClient();
    let addr = 'bc1qaaa';
    const wires = makeReadOnlyProbeWires({
      getState: () => ({ ...sampleState, activeAccountAddress: addr }),
      cat21OrdClient: client,
    });

    await wires.listCatsAtActiveAccount();
    addr = 'bc1qbbb';
    await wires.listCatsAtActiveAccount();

    expect(client.fetchAddressCat21s).toHaveBeenNthCalledWith(1, 'bc1qaaa');
    expect(client.fetchAddressCat21s).toHaveBeenNthCalledWith(2, 'bc1qbbb');
  });
});

describe('makeReadOnlyProbeWires.readWalletStatus', () => {
  it('shapes the snapshot exactly as the probe handler expects', () => {
    const wires = makeReadOnlyProbeWires({
      getState: () => sampleState,
      cat21OrdClient: makeFakeClient(),
    });
    expect(wires.readWalletStatus()).toEqual({
      network: 'mainnet',
      accountId: 'abcd1234:0',
      agentMode: { enabled: true },
    });
  });

  it('re-reads state per call so an agent-mode toggle is visible without rebuilding the wires', () => {
    let enabled = false;
    const wires = makeReadOnlyProbeWires({
      getState: () => ({ ...sampleState, agentModeEnabled: enabled }),
      cat21OrdClient: makeFakeClient(),
    });
    expect(wires.readWalletStatus().agentMode.enabled).toBe(false);
    enabled = true;
    expect(wires.readWalletStatus().agentMode.enabled).toBe(true);
  });
});

describe('makeReadOnlyProbeWires.readCat21OrdStatus', () => {
  it('returns reachable:true plus height+cats when cat21-ord responds', async () => {
    const client = makeFakeClient();
    const wires = makeReadOnlyProbeWires({ getState: () => sampleState, cat21OrdClient: client });
    await expect(wires.readCat21OrdStatus()).resolves.toEqual({
      reachable: true,
      height: 921234,
      cats: 75432,
    });
  });

  it('returns reachable:false when fetchStatus rejects (network down, schema mismatch, …)', async () => {
    const client = makeFakeClient({
      fetchStatus: vi.fn(() => Promise.reject(new Error('ECONNREFUSED'))),
    });
    const wires = makeReadOnlyProbeWires({ getState: () => sampleState, cat21OrdClient: client });
    await expect(wires.readCat21OrdStatus()).resolves.toEqual({ reachable: false });
  });
});

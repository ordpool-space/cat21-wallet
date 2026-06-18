import { describe, expect, it } from 'vitest';

import { decodeWalletProbeState } from './decode-wallet-probe-state';

const DEFAULT_STATE = {
  network: 'mainnet' as const,
  accountId: '',
  activeAccountAddress: undefined,
  agentModeEnabled: false,
};

/**
 * Builder for a redux-persist'd root JSON envelope. Each slice gets
 * inner-serialised (JSON inside JSON) to match the v6 default.
 */
function persistedRoot(slices: Record<string, unknown>): string {
  const out: Record<string, string> = {};
  for (const [name, content] of Object.entries(slices)) {
    out[name] = JSON.stringify(content);
  }
  return JSON.stringify(out);
}

describe('decodeWalletProbeState fail-closed behaviour', () => {
  it('returns DEFAULT_STATE when input is not a string (the storage key was missing)', () => {
    expect(decodeWalletProbeState(undefined)).toEqual(DEFAULT_STATE);
    expect(decodeWalletProbeState(null)).toEqual(DEFAULT_STATE);
    expect(decodeWalletProbeState({ wrong: 'shape' })).toEqual(DEFAULT_STATE);
    expect(decodeWalletProbeState(42)).toEqual(DEFAULT_STATE);
  });

  it('returns DEFAULT_STATE when input is a string but not JSON', () => {
    expect(decodeWalletProbeState('not-json')).toEqual(DEFAULT_STATE);
    expect(decodeWalletProbeState('{malformed')).toEqual(DEFAULT_STATE);
  });

  it('returns DEFAULT_STATE when parsed JSON is not an object', () => {
    expect(decodeWalletProbeState('[]')).toEqual(DEFAULT_STATE);
    expect(decodeWalletProbeState('"a-string-value"')).toEqual(DEFAULT_STATE);
    expect(decodeWalletProbeState('null')).toEqual(DEFAULT_STATE);
  });

  it('returns DEFAULT_STATE when the inner slice JSON is malformed', () => {
    expect(decodeWalletProbeState(JSON.stringify({ networks: 'malformed{' }))).toEqual(
      DEFAULT_STATE
    );
  });

  it('returns DEFAULT_STATE for an empty envelope (fresh-install wallet)', () => {
    expect(decodeWalletProbeState(persistedRoot({}))).toEqual(DEFAULT_STATE);
  });
});

describe('decodeWalletProbeState network normalisation', () => {
  it("maps currentNetworkId 'mainnet' → network: 'mainnet'", () => {
    const root = persistedRoot({ networks: { currentNetworkId: 'mainnet' } });
    expect(decodeWalletProbeState(root).network).toBe('mainnet');
  });

  it("maps every non-mainnet network id → 'testnet' (testnet, testnet4, signet, regtest, …)", () => {
    for (const id of ['testnet', 'testnet4', 'signet', 'sbtcTestnet', 'sbtcDevenv', 'devnet']) {
      const root = persistedRoot({ networks: { currentNetworkId: id } });
      expect(decodeWalletProbeState(root).network).toBe('testnet');
    }
  });

  it('returns DEFAULT_STATE.network when the networks slice exists but lacks currentNetworkId', () => {
    const root = persistedRoot({ networks: { ids: [], entities: {} } });
    expect(decodeWalletProbeState(root).network).toBe('mainnet');
  });
});

describe('decodeWalletProbeState fail-closed contract for accountId + agentMode', () => {
  it("returns accountId '' + agentModeEnabled false when no agentPolicy slice exists", () => {
    const root = persistedRoot({ networks: { currentNetworkId: 'mainnet' } });
    const state = decodeWalletProbeState(root);
    expect(state.accountId).toBe('');
    expect(state.agentModeEnabled).toBe(false);
  });

  it("returns accountId '' + agentModeEnabled false even when agentPolicy slice has policies (active-account lookup is iter-12g maintainer-decision wire-up)", () => {
    const root = persistedRoot({
      networks: { currentNetworkId: 'mainnet' },
      agentPolicy: { policies: { 'fp:0': { enabled: true } }, spentToday: {} },
    });
    const state = decodeWalletProbeState(root);
    // Until iter 12g resolves the active-account slice path, the
    // decoder fails closed: the agent learns nothing about which
    // policy applies, so agentModeEnabled stays false even though
    // a policy exists for fp:0.
    expect(state.accountId).toBe('');
    expect(state.agentModeEnabled).toBe(false);
  });
});

describe('decodeWalletProbeState always returns activeAccountAddress: undefined (iter-12g contract)', () => {
  it('never returns a defined activeAccountAddress regardless of slice content (popup-tied derivation)', () => {
    const root = persistedRoot({
      networks: { currentNetworkId: 'mainnet' },
      agentPolicy: { policies: {}, spentToday: {} },
    });
    expect(decodeWalletProbeState(root).activeAccountAddress).toBeUndefined();
  });
});

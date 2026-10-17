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

describe('decodeWalletProbeState accountId + agentMode wire', () => {
  it("returns accountId '' + agentModeEnabled false when neither active nor agentPolicy slices exist", () => {
    const root = persistedRoot({ networks: { currentNetworkId: 'mainnet' } });
    const state = decodeWalletProbeState(root);
    expect(state.accountId).toBe('');
    expect(state.agentModeEnabled).toBe(false);
  });

  it('reads the active account id from the active slice (fingerprint:accountIndex)', () => {
    const root = persistedRoot({
      networks: { currentNetworkId: 'mainnet' },
      active: { account: { fingerprint: 'fp', accountIndex: 0 } },
    });
    expect(decodeWalletProbeState(root).accountId).toBe('fp:0');
  });

  it('returns agentModeEnabled true when the active account has an enabled policy', () => {
    const root = persistedRoot({
      networks: { currentNetworkId: 'mainnet' },
      active: { account: { fingerprint: 'fp', accountIndex: 0 } },
      agentPolicy: { policies: { 'fp:0': { enabled: true } }, spentToday: {} },
    });
    expect(decodeWalletProbeState(root).agentModeEnabled).toBe(true);
  });

  it('returns agentModeEnabled false when the active account has a disabled policy', () => {
    const root = persistedRoot({
      networks: { currentNetworkId: 'mainnet' },
      active: { account: { fingerprint: 'fp', accountIndex: 0 } },
      agentPolicy: { policies: { 'fp:0': { enabled: false } }, spentToday: {} },
    });
    expect(decodeWalletProbeState(root).agentModeEnabled).toBe(false);
  });

  it('returns agentModeEnabled false when there is no policy for the active account', () => {
    const root = persistedRoot({
      networks: { currentNetworkId: 'mainnet' },
      active: { account: { fingerprint: 'fp', accountIndex: 0 } },
      agentPolicy: { policies: { 'other-fp:1': { enabled: true } }, spentToday: {} },
    });
    expect(decodeWalletProbeState(root).agentModeEnabled).toBe(false);
  });

  it("returns accountId '' for a malformed active slice (null account)", () => {
    const root = persistedRoot({
      networks: { currentNetworkId: 'mainnet' },
      active: { account: null },
    });
    expect(decodeWalletProbeState(root).accountId).toBe('');
  });

  it("returns accountId '' when fingerprint is empty", () => {
    const root = persistedRoot({
      networks: { currentNetworkId: 'mainnet' },
      active: { account: { fingerprint: '', accountIndex: 0 } },
    });
    expect(decodeWalletProbeState(root).accountId).toBe('');
  });

  it("returns accountId '' when accountIndex is non-integer", () => {
    const root = persistedRoot({
      networks: { currentNetworkId: 'mainnet' },
      active: { account: { fingerprint: 'fp', accountIndex: 0.5 } },
    });
    expect(decodeWalletProbeState(root).accountId).toBe('');
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

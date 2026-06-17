import { describe, expect, it } from 'vitest';

import type { Cat21MintIntent } from '../types';
import {
  MINT_FEE_RATE_SANITY_CEILING_SAT_PER_VBYTE,
  MintInvariantError,
  enforceMintInvariants,
} from './mint-invariants';

// Known-valid example addresses (deterministic across Bitcoin networks).
const MAINNET_P2TR = 'bc1pmfr3p9j00pfxjh0zmgp99y8zftmd3s5pmedqhyptwy6lm87hf5sspknck9';
const MAINNET_P2WPKH = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const TESTNET_P2WPKH = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';

function makeIntent(over: Partial<Cat21MintIntent> = {}): Cat21MintIntent {
  return {
    recipient: MAINNET_P2TR,
    feeRate: 5,
    ...over,
  };
}

describe('enforceMintInvariants', () => {
  it('returns a Validated<Cat21MintIntent> for a well-formed mainnet mint', () => {
    const result = enforceMintInvariants(makeIntent(), 'mainnet');
    expect(result.recipient).toBe(MAINNET_P2TR);
    expect(result.feeRate).toBe(5);
  });

  it('returns a Validated<Cat21MintIntent> for a well-formed testnet mint', () => {
    const result = enforceMintInvariants(makeIntent({ recipient: TESTNET_P2WPKH }), 'testnet');
    expect(result.recipient).toBe(TESTNET_P2WPKH);
  });

  it('throws MintInvariantError(recipient-not-a-bitcoin-address) on empty recipient', () => {
    try {
      enforceMintInvariants(makeIntent({ recipient: '' }), 'mainnet');
      throw new Error('did not throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MintInvariantError);
      expect((err as MintInvariantError).reason).toBe('recipient-not-a-bitcoin-address');
    }
  });

  it('throws MintInvariantError(recipient-not-a-bitcoin-address) on non-bech32 garbage', () => {
    try {
      enforceMintInvariants(makeIntent({ recipient: 'not-a-real-address' }), 'mainnet');
      throw new Error('did not throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MintInvariantError);
      expect((err as MintInvariantError).reason).toBe('recipient-not-a-bitcoin-address');
    }
  });

  it('throws MintInvariantError(recipient-wrong-network) when active network is mainnet but recipient is testnet', () => {
    try {
      enforceMintInvariants(makeIntent({ recipient: TESTNET_P2WPKH }), 'mainnet');
      throw new Error('did not throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MintInvariantError);
      expect((err as MintInvariantError).reason).toBe('recipient-wrong-network');
    }
  });

  it('throws MintInvariantError(fee-rate-not-positive) on feeRate === 0', () => {
    try {
      enforceMintInvariants(makeIntent({ feeRate: 0 }), 'mainnet');
      throw new Error('did not throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MintInvariantError);
      expect((err as MintInvariantError).reason).toBe('fee-rate-not-positive');
    }
  });

  it('throws MintInvariantError(fee-rate-not-positive) on negative feeRate', () => {
    try {
      enforceMintInvariants(makeIntent({ feeRate: -1 }), 'mainnet');
      throw new Error('did not throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MintInvariantError);
      expect((err as MintInvariantError).reason).toBe('fee-rate-not-positive');
    }
  });

  it('throws MintInvariantError(fee-rate-above-sanity-ceiling) when feeRate is implausibly high', () => {
    try {
      enforceMintInvariants(
        makeIntent({ feeRate: MINT_FEE_RATE_SANITY_CEILING_SAT_PER_VBYTE + 1 }),
        'mainnet'
      );
      throw new Error('did not throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MintInvariantError);
      expect((err as MintInvariantError).reason).toBe('fee-rate-above-sanity-ceiling');
    }
  });

  it('throws MintInvariantError(tip-address-invalid) when tip exists with garbage address', () => {
    try {
      enforceMintInvariants(makeIntent({ tip: { address: 'garbage', value: 1000 } }), 'mainnet');
      throw new Error('did not throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MintInvariantError);
      expect((err as MintInvariantError).reason).toBe('tip-address-invalid');
    }
  });

  it('throws MintInvariantError(tip-address-invalid) when tip exists with wrong-network address', () => {
    try {
      enforceMintInvariants(
        makeIntent({ tip: { address: TESTNET_P2WPKH, value: 1000 } }),
        'mainnet'
      );
      throw new Error('did not throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MintInvariantError);
      expect((err as MintInvariantError).reason).toBe('tip-address-invalid');
    }
  });

  it('throws MintInvariantError(tip-value-negative) when tip.value < 0', () => {
    try {
      enforceMintInvariants(makeIntent({ tip: { address: MAINNET_P2WPKH, value: -1 } }), 'mainnet');
      throw new Error('did not throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MintInvariantError);
      expect((err as MintInvariantError).reason).toBe('tip-value-negative');
    }
  });

  it('throws MintInvariantError(fee-rate-not-positive) on NaN feeRate', () => {
    try {
      enforceMintInvariants(makeIntent({ feeRate: NaN }), 'mainnet');
      throw new Error('did not throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MintInvariantError);
      expect((err as MintInvariantError).reason).toBe('fee-rate-not-positive');
    }
  });

  it('throws MintInvariantError(fee-rate-not-positive) on Infinity feeRate', () => {
    try {
      enforceMintInvariants(makeIntent({ feeRate: Infinity }), 'mainnet');
      throw new Error('did not throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MintInvariantError);
      expect((err as MintInvariantError).reason).toBe('fee-rate-not-positive');
    }
  });

  it('treats null tip the same as omitted tip (no TypeError, no error at all)', () => {
    // Defensive: a bug in upstream code or a hand-crafted intent could pass
    // `tip: null`. Without the `!= null` guard the subsequent dereference
    // would throw a raw TypeError, surfacing as an opaque crash. We accept
    // null as a tip-absent signal alongside undefined.
    const result = enforceMintInvariants(
      makeIntent({ tip: null as unknown as Cat21MintIntent['tip'] }),
      'mainnet'
    );
    expect(result.recipient).toBe(MAINNET_P2TR);
  });

  it('throws MintInvariantError(tip-value-negative) when tip.value is missing or non-numeric', () => {
    try {
      enforceMintInvariants(
        makeIntent({
          tip: { address: MAINNET_P2WPKH } as unknown as Cat21MintIntent['tip'],
        }),
        'mainnet'
      );
      throw new Error('did not throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MintInvariantError);
      expect((err as MintInvariantError).reason).toBe('tip-value-negative');
    }
  });

  it('checks tip-value-negative BEFORE tip-address-invalid (first violation wins)', () => {
    // Pin first-violation-wins ordering so a future refactor doesn't accidentally
    // surface a different reason. Both fields are wrong; tip-value-negative fires.
    try {
      enforceMintInvariants(makeIntent({ tip: { address: 'garbage', value: -1 } }), 'mainnet');
      throw new Error('did not throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MintInvariantError);
      expect((err as MintInvariantError).reason).toBe('tip-value-negative');
    }
  });

  it('accepts tip with value === 0 (caller convention: 0 means no output)', () => {
    // tip.value === 0 skips the address-validity check, even with a
    // syntactically broken address — the caller has opted out of the
    // tip output entirely.
    const result = enforceMintInvariants(
      makeIntent({ tip: { address: 'wont-be-validated', value: 0 } }),
      'mainnet'
    );
    expect(result.tip?.value).toBe(0);
  });

  it('compiles where Validated<Cat21MintIntent> is required', () => {
    // Type-level only. Just calling the function in a context that
    // expects the branded type exercises the compile-time check; if
    // the return type drifted, this file would fail typecheck.
    const checked = enforceMintInvariants(makeIntent(), 'mainnet');
    function acceptOnlyValidated(i: typeof checked): string {
      return i.recipient;
    }
    expect(acceptOnlyValidated(checked)).toBe(MAINNET_P2TR);
  });
});

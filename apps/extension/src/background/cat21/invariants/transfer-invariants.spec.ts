import { describe, expect, it } from 'vitest';

import type { Cat21TransferIntent } from '../types';
import {
  TRANSFER_FEE_RATE_SANITY_CEILING_SAT_PER_VBYTE,
  TransferInvariantError,
  enforceTransferInvariants,
} from './transfer-invariants';

const MAINNET_P2TR = 'bc1pmfr3p9j00pfxjh0zmgp99y8zftmd3s5pmedqhyptwy6lm87hf5sspknck9';
const TESTNET_P2WPKH = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
const VALID_CAT_ID = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefi0';

function makeIntent(over: Partial<Cat21TransferIntent> = {}): Cat21TransferIntent {
  return {
    catId: VALID_CAT_ID,
    recipient: MAINNET_P2TR,
    feeRate: 5,
    ...over,
  };
}

describe('enforceTransferInvariants', () => {

  it('returns a Validated<Cat21TransferIntent> for a well-formed mainnet transfer', () => {
    const result = enforceTransferInvariants(makeIntent(), 'mainnet');
    expect(result.catId).toBe(VALID_CAT_ID);
    expect(result.recipient).toBe(MAINNET_P2TR);
  });

  it('returns a Validated<Cat21TransferIntent> for a well-formed testnet transfer', () => {
    const result = enforceTransferInvariants(
      makeIntent({ recipient: TESTNET_P2WPKH }),
      'testnet'
    );
    expect(result.recipient).toBe(TESTNET_P2WPKH);
  });

  it('throws cat-id-malformed on empty catId', () => {
    try {
      enforceTransferInvariants(makeIntent({ catId: '' }), 'mainnet');
      throw new Error('did not throw');
    } catch (err) {
      expect(err).toBeInstanceOf(TransferInvariantError);
      expect((err as TransferInvariantError).reason).toBe('cat-id-malformed');
    }
  });

  it('throws cat-id-malformed on non-string catId', () => {
    try {
      enforceTransferInvariants(
        makeIntent({ catId: 42 as unknown as string }),
        'mainnet'
      );
      throw new Error('did not throw');
    } catch (err) {
      expect((err as TransferInvariantError).reason).toBe('cat-id-malformed');
    }
  });

  it('throws cat-id-malformed when format is not <txid>i<index>', () => {
    try {
      enforceTransferInvariants(
        makeIntent({ catId: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' }),
        'mainnet'
      );
      throw new Error('did not throw');
    } catch (err) {
      expect((err as TransferInvariantError).reason).toBe('cat-id-malformed');
    }
  });

  it('throws recipient-not-a-bitcoin-address on garbage recipient', () => {
    try {
      enforceTransferInvariants(makeIntent({ recipient: 'garbage' }), 'mainnet');
      throw new Error('did not throw');
    } catch (err) {
      expect((err as TransferInvariantError).reason).toBe('recipient-not-a-bitcoin-address');
    }
  });

  it('throws recipient-wrong-network when address is for the other network', () => {
    try {
      enforceTransferInvariants(
        makeIntent({ recipient: TESTNET_P2WPKH }),
        'mainnet'
      );
      throw new Error('did not throw');
    } catch (err) {
      expect((err as TransferInvariantError).reason).toBe('recipient-wrong-network');
    }
  });

  it('throws fee-rate-not-positive on feeRate === 0', () => {
    try {
      enforceTransferInvariants(makeIntent({ feeRate: 0 }), 'mainnet');
      throw new Error('did not throw');
    } catch (err) {
      expect((err as TransferInvariantError).reason).toBe('fee-rate-not-positive');
    }
  });

  it('throws fee-rate-not-positive on NaN feeRate', () => {
    try {
      enforceTransferInvariants(makeIntent({ feeRate: NaN }), 'mainnet');
      throw new Error('did not throw');
    } catch (err) {
      expect((err as TransferInvariantError).reason).toBe('fee-rate-not-positive');
    }
  });

  it('throws fee-rate-not-positive on Infinity feeRate', () => {
    try {
      enforceTransferInvariants(makeIntent({ feeRate: Infinity }), 'mainnet');
      throw new Error('did not throw');
    } catch (err) {
      expect((err as TransferInvariantError).reason).toBe('fee-rate-not-positive');
    }
  });

  it('throws fee-rate-above-sanity-ceiling when feeRate is implausibly high', () => {
    try {
      enforceTransferInvariants(
        makeIntent({ feeRate: TRANSFER_FEE_RATE_SANITY_CEILING_SAT_PER_VBYTE + 1 }),
        'mainnet'
      );
      throw new Error('did not throw');
    } catch (err) {
      expect((err as TransferInvariantError).reason).toBe('fee-rate-above-sanity-ceiling');
    }
  });

  it('accepts cat IDs with multi-digit output index', () => {
    const result = enforceTransferInvariants(
      makeIntent({
        catId: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefi12345',
      }),
      'mainnet'
    );
    expect(result.catId).toContain('i12345');
  });
});

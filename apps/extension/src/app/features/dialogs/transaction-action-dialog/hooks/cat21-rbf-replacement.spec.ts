import * as btc from '@scure/btc-signer';
import { describe, expect, it } from 'vitest';

import {
  assertReplacementKeepsLocktime,
  bumpRbfSequence,
  createLocktimePreservingReplacement,
} from './cat21-rbf-replacement';

/**
 * The RBF invariants for a cat21-wallet fee bump (audit T4), against a fixture
 * with nLockTime 21: an unconfirmed CAT-21 mint, the case where the locktime is
 * the cat itself.
 */
const MINT_LOCKTIME = 21;
// cat21-wallet's own mint inputs signal RBF with 0xfffffffd.
const CAT21_WALLET_SEQUENCE = 0xfffffffd;

describe('createLocktimePreservingReplacement', () => {
  it('carries the original mint locktime 21, not the 0 a plain RBF uses', () => {
    expect(createLocktimePreservingReplacement(MINT_LOCKTIME).lockTime).toBe(MINT_LOCKTIME);
  });
});

describe('bumpRbfSequence', () => {
  it('bumps the wallet mint sequence 0xfffffffd to 0xfffffffe', () => {
    expect(bumpRbfSequence(CAT21_WALLET_SEQUENCE)).toBe(0xfffffffe);
  });

  it('never reaches the final 0xffffffff, however often it is bumped', () => {
    let sequence = CAT21_WALLET_SEQUENCE;
    for (let i = 0; i < 5; i++) sequence = bumpRbfSequence(sequence);
    expect(sequence).toBe(0xfffffffe);
  });

  it('bumps a low sequence by one', () => {
    expect(bumpRbfSequence(0)).toBe(1);
  });
});

describe('assertReplacementKeepsLocktime', () => {
  it('passes a replacement that keeps locktime 21', () => {
    const replacement = createLocktimePreservingReplacement(MINT_LOCKTIME);
    expect(() => assertReplacementKeepsLocktime(replacement, MINT_LOCKTIME)).not.toThrow();
  });

  it('refuses a replacement that dropped the locktime to 0', () => {
    const plainRbf = new btc.Transaction({ lockTime: 0 });
    expect(() => assertReplacementKeepsLocktime(plainRbf, MINT_LOCKTIME)).toThrow(
      /does not match original 21/
    );
  });
});

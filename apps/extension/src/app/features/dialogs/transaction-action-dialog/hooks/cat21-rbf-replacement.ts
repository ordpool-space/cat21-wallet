import * as btc from '@scure/btc-signer';

/**
 * The Cat21 invariants of an RBF fee bump (WAL HARD RULE #1), kept out of the
 * upstream `useBtcIncreaseFee` hook so they are unit-testable on their own.
 *
 * A replacement must carry the original transaction's nLockTime: for an
 * unconfirmed CAT-21 mint the locktime IS the cat (a mint is a cat iff
 * `locktime == 21`), so a replacement with lockTime 0 kills it. A plain Bitcoin
 * RBF builds its replacement with lockTime 0; these keep the original's.
 */

/** The highest input sequence that keeps the transaction-level nLockTime enforced. */
const MAX_LOCKTIME_ENFORCING_SEQUENCE = 0xfffffffe;

/** A new, empty replacement transaction carrying the original's nLockTime. */
export function createLocktimePreservingReplacement(originalLocktime: number): btc.Transaction {
  return new btc.Transaction({ lockTime: originalLocktime });
}

/**
 * The bumped input sequence for a replacement, clamped below `0xffffffff`. A
 * sequence of `0xffffffff` on every input marks the transaction final and makes
 * consensus ignore nLockTime, so a locktime-bearing replacement must never
 * reach it, however many times it is bumped.
 */
export function bumpRbfSequence(sequence: number): number {
  return Math.min(sequence + 1, MAX_LOCKTIME_ENFORCING_SEQUENCE);
}

/** Refuse to sign a replacement whose nLockTime differs from the original's. */
export function assertReplacementKeepsLocktime(
  replacement: btc.Transaction,
  originalLocktime: number
): void {
  if (replacement.lockTime !== originalLocktime) {
    throw new Error(
      `Replacement tx locktime ${replacement.lockTime} does not match original ` +
        `${originalLocktime}. Refusing to sign: it would kill any cat the ` +
        'original mints.'
    );
  }
}

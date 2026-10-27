import { hexToBytes } from '@noble/hashes/utils';
import { getPublicKey } from '@noble/secp256k1';
import * as btc from '@scure/btc-signer';
import { describe, expect, it } from 'vitest';

import { defaultAllowedSighashTypes } from './psbt-inputs';

/**
 * Real-signer enforcement of `defaultAllowedSighashTypes`.
 *
 * The production sign path (`useSignBitcoinTx` -> the software signer's
 * `signAtIndex`) does NOT call `isDisallowedSighash`; it hands
 * `[...defaultAllowedSighashTypes, ...requestAllowed]` straight to
 * `@scure/btc-signer`'s `tx.signIdx(key, idx, allowedSighash)`, which refuses an
 * input whose sighash is outside the list. The predicate unit tests pin the
 * boolean; this pins the fact that the SAME constant, handed to the REAL
 * signer, actually refuses a dangerous sighash and signs a safe one.
 *
 * Mutation guard: widen `defaultAllowedSighashTypes` to include `SigHash.NONE`
 * and the NONE case stops throwing -> this test goes red.
 */

// A fixed, valid secp256k1 scalar; deterministic so the test is reproducible.
const privateKey = hexToBytes('1111111111111111111111111111111111111111111111111111111111111111');
const publicKey = getPublicKey(privateKey, true);

// A single-input, single-output P2WPKH spend the key above can sign. The
// sighashType on the input is what we vary.
function buildSpend(sighashType: number): btc.Transaction {
  const payment = btc.p2wpkh(publicKey, btc.TEST_NETWORK);
  const tx = new btc.Transaction();
  tx.addInput({
    // Arbitrary but fixed prevout; the signer only needs the witnessUtxo.
    txid: hexToBytes('a'.repeat(64)),
    index: 0,
    witnessUtxo: { script: payment.script, amount: 100_000n },
    sighashType,
  });
  tx.addOutputAddress(payment.address!, 90_000n, btc.TEST_NETWORK);
  return tx;
}

describe('defaultAllowedSighashTypes enforced by the real signer', () => {
  it('signs a SIGHASH_ALL input (the value the cat-flow and funding inputs use)', () => {
    const tx = buildSpend(btc.SigHash.ALL);
    expect(() => tx.signIdx(privateKey, 0, defaultAllowedSighashTypes)).not.toThrow();
    // Positive proof: a real partial signature landed on the input.
    expect(tx.getInput(0).partialSig).toHaveLength(1);
  });

  it('refuses a SIGHASH_NONE input, so a disallowed sighash can never be signed', () => {
    const tx = buildSpend(btc.SigHash.NONE);
    expect(() => tx.signIdx(privateKey, 0, defaultAllowedSighashTypes)).toThrow();
    // And nothing was signed.
    expect(tx.getInput(0).partialSig).toBeUndefined();
  });
});

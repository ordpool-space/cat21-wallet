import { hexToBytes } from '@noble/hashes/utils';
import { getPublicKey } from '@noble/secp256k1';
import * as btc from '@scure/btc-signer';
import { describe, expect, it } from 'vitest';

import { finalizeRemainingInputs } from './finalize-remaining-inputs';

const privateKey = hexToBytes('1111111111111111111111111111111111111111111111111111111111111111');
const publicKey = getPublicKey(privateKey, true);
const payment = btc.p2wpkh(publicKey, btc.TEST_NETWORK);

function twoInputTx(): btc.Transaction {
  const tx = new btc.Transaction();
  tx.addInput({
    txid: hexToBytes('a'.repeat(64)),
    index: 0,
    witnessUtxo: { script: payment.script, amount: 100_000n },
    sighashType: btc.SigHash.ALL,
  });
  tx.addInput({
    txid: hexToBytes('b'.repeat(64)),
    index: 1,
    witnessUtxo: { script: payment.script, amount: 100_000n },
    sighashType: btc.SigHash.ALL,
  });
  tx.addOutputAddress(payment.address!, 180_000n, btc.TEST_NETWORK);
  return tx;
}

function isFinal(input: ReturnType<btc.Transaction['getInput']>): boolean {
  return (input.finalScriptWitness?.length ?? 0) > 0 || (input.finalScriptSig?.length ?? 0) > 0;
}

describe('finalizeRemainingInputs', () => {
  it('finalises the seller input 0 and leaves a pre-finalised buyer input 1 intact (ord-accept shape)', () => {
    const tx = twoInputTx();
    // Buyer input 1 arrives already finalised (the ord-acceptable offer shape).
    tx.signIdx(privateKey, 1, [btc.SigHash.ALL]);
    tx.finalizeIdx(1);
    // Seller signs input 0 at accept time.
    tx.signIdx(privateKey, 0, [btc.SigHash.ALL]);
    // scure's finalize() over ALL inputs throws "Not enough partial sign" on the
    // pre-finalised buyer input; this must not.
    expect(() => finalizeRemainingInputs(tx)).not.toThrow();
    expect(isFinal(tx.getInput(0))).toBe(true);
    expect(isFinal(tx.getInput(1))).toBe(true);
    expect(tx.extract().length).toBeGreaterThan(0);
  });

  it('finalises every input when none is pre-finalised (mint/transfer shape)', () => {
    const tx = twoInputTx();
    tx.signIdx(privateKey, 0, [btc.SigHash.ALL]);
    tx.signIdx(privateKey, 1, [btc.SigHash.ALL]);
    finalizeRemainingInputs(tx);
    expect(isFinal(tx.getInput(0))).toBe(true);
    expect(isFinal(tx.getInput(1))).toBe(true);
    expect(tx.extract().length).toBeGreaterThan(0);
  });
});

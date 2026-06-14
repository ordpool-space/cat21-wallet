import { hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import { describe, expect, it } from 'vitest';

import { enforceMintInvariants } from '../invariants/mint-invariants';
import type { Cat21MintIntent, Validated } from '../types';
import {
  BuildMintPsbtArgs,
  CAT21_CAT_OUTPUT_SATS,
  CAT21_CHANGE_DUST_LIMIT_SATS,
  CAT21_LOCK_TIME,
  CAT21_WALLET_MINT_INPUT_SEQUENCE,
  buildMintPsbt,
} from './mint-builder';

const publicKey = hex.decode('030000000000000000000000000000000000000000000000000000000000000001');
const p2wpkhMainnet = btc.p2wpkh(publicKey, btc.NETWORK);
const p2wpkhTestnet = btc.p2wpkh(publicKey, btc.TEST_NETWORK);

function validatedIntent(overrides: Partial<Cat21MintIntent> = {}): Validated<Cat21MintIntent> {
  const raw: Cat21MintIntent = {
    recipient: p2wpkhMainnet.address!,
    feeRate: 5,
    ...overrides,
  };
  return enforceMintInvariants(raw, 'mainnet');
}

function makeArgs(overrides: Partial<BuildMintPsbtArgs> = {}): BuildMintPsbtArgs {
  return {
    intent: validatedIntent(),
    fundingUtxo: {
      txid: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      vout: 0,
      value: 50_000,
      scriptPubKey: p2wpkhMainnet.script,
    },
    paymentAddress: p2wpkhMainnet.address!,
    network: 'mainnet',
    ...overrides,
  };
}

describe('buildMintPsbt', () => {

  it('produces a parseable PSBT', () => {
    const result = buildMintPsbt(makeArgs());
    const psbtMagic = [0x70, 0x73, 0x62, 0x74, 0xff];
    expect(Array.from(result.psbt.slice(0, 5))).toEqual(psbtMagic);
  });

  it('sets lockTime to exactly 21', () => {
    const result = buildMintPsbt(makeArgs());
    const tx = btc.Transaction.fromPSBT(result.psbt);
    expect(tx.lockTime).toBe(21);
    expect(tx.lockTime).toBe(CAT21_LOCK_TIME);
  });

  it('sets the input sequence to 0xfffffffd (RBF-signalling, lockTime-enforced)', () => {
    const result = buildMintPsbt(makeArgs());
    const tx = btc.Transaction.fromPSBT(result.psbt);
    expect(tx.getInput(0).sequence).toBe(0xfffffffd);
    expect(tx.getInput(0).sequence).toBe(CAT21_WALLET_MINT_INPUT_SEQUENCE);
  });

  it('every input carries SIGHASH_ALL', () => {
    const result = buildMintPsbt(makeArgs());
    const tx = btc.Transaction.fromPSBT(result.psbt);
    for (let i = 0; i < tx.inputsLength; i++) {
      expect(tx.getInput(i).sighashType).toBe(btc.SigHash.ALL);
    }
  });

  it('puts the cat at output 0 with 546 sats', () => {
    const result = buildMintPsbt(makeArgs());
    const tx = btc.Transaction.fromPSBT(result.psbt);
    expect(tx.getOutput(0).amount).toBe(BigInt(CAT21_CAT_OUTPUT_SATS));
    expect(tx.getOutput(0).amount).toBe(BigInt(546));
  });

  it('puts change above dust on output 1 to the payment address', () => {
    const result = buildMintPsbt(makeArgs());
    const tx = btc.Transaction.fromPSBT(result.psbt);
    // 50_000 - 546 - 5*150 = 48_704 change → above 546 dust → emitted
    expect(tx.outputsLength).toBe(2);
    expect(tx.getOutput(1).amount).toBe(BigInt(48_704));
    expect(result.changeAbsorbed).toBe(false);
  });

  it('absorbs sub-dust change into the miner fee instead of emitting an output', () => {
    // Pick funding so change is below 546:
    // funding - 546 - fee = 545 → funding = 546 + fee + 545
    // fee at 5 sat/vB * 150 vsize = 750. funding = 546 + 750 + 545 = 1_841.
    const result = buildMintPsbt(
      makeArgs({
        fundingUtxo: {
          txid: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          vout: 0,
          value: 1_841,
          scriptPubKey: p2wpkhMainnet.script,
        },
      })
    );
    const tx = btc.Transaction.fromPSBT(result.psbt);
    expect(tx.outputsLength).toBe(1);
    expect(result.changeAbsorbed).toBe(true);
  });

  it('emits change at exactly 546 sats (dust boundary)', () => {
    // funding = 546 + 750 fee + 546 change = 1_842
    const result = buildMintPsbt(
      makeArgs({
        fundingUtxo: {
          txid: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          vout: 0,
          value: 1_842,
          scriptPubKey: p2wpkhMainnet.script,
        },
      })
    );
    const tx = btc.Transaction.fromPSBT(result.psbt);
    expect(tx.outputsLength).toBe(2);
    expect(tx.getOutput(1).amount).toBe(BigInt(CAT21_CHANGE_DUST_LIMIT_SATS));
    expect(result.changeAbsorbed).toBe(false);
  });

  it('emits a tip output when intent ships tip with value > 0', () => {
    const result = buildMintPsbt(
      makeArgs({
        intent: validatedIntent({
          tip: { address: p2wpkhMainnet.address!, value: 1_000 },
        }),
      })
    );
    const tx = btc.Transaction.fromPSBT(result.psbt);
    // outputs: recipient + tip + change → 3 outputs
    expect(tx.outputsLength).toBe(3);
    expect(tx.getOutput(1).amount).toBe(BigInt(1_000));
  });

  it('does NOT emit a tip output when intent.tip.value === 0', () => {
    const result = buildMintPsbt(
      makeArgs({
        intent: validatedIntent({
          // value === 0 is the documented "no tip" convention.
          tip: { address: p2wpkhMainnet.address!, value: 0 },
        }),
      })
    );
    const tx = btc.Transaction.fromPSBT(result.psbt);
    // outputs: recipient + change → 2 outputs (no tip)
    expect(tx.outputsLength).toBe(2);
  });

  it('throws on insufficient funding', () => {
    expect(() =>
      buildMintPsbt(
        makeArgs({
          fundingUtxo: {
            txid: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            vout: 0,
            value: 100, // way below 546 + fee
            scriptPubKey: p2wpkhMainnet.script,
          },
        })
      )
    ).toThrow(/Funding UTXO insufficient/);
  });

  it('respects tapInternalKey for P2TR funding UTXOs', () => {
    const taproot = btc.p2tr(publicKey.slice(1, 33), undefined, btc.NETWORK);
    const result = buildMintPsbt(
      makeArgs({
        fundingUtxo: {
          txid: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          vout: 0,
          value: 50_000,
          scriptPubKey: taproot.script,
          tapInternalKey: publicKey.slice(1, 33),
        },
      })
    );
    const tx = btc.Transaction.fromPSBT(result.psbt);
    expect(tx.getInput(0).tapInternalKey).toBeDefined();
  });

  it('computes fee as feeRate × estimated vsize', () => {
    const result = buildMintPsbt(makeArgs({ intent: validatedIntent({ feeRate: 10 }) }));
    // 10 sat/vB × 150 vsize = 1500 sats
    expect(result.fee).toBe(1_500);
  });

  it('adds tip-output vsize when computing fee for a tipping mint', () => {
    const result = buildMintPsbt(
      makeArgs({
        intent: validatedIntent({
          feeRate: 10,
          tip: { address: p2wpkhMainnet.address!, value: 1_000 },
        }),
      })
    );
    // 10 sat/vB × (150 + 31) = 1810 sats
    expect(result.fee).toBe(1_810);
  });

  it('builds correctly on testnet', () => {
    const testnetIntent = enforceMintInvariants(
      { recipient: p2wpkhTestnet.address!, feeRate: 5 },
      'testnet'
    );
    const result = buildMintPsbt({
      intent: testnetIntent,
      fundingUtxo: {
        txid: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        vout: 0,
        value: 50_000,
        scriptPubKey: p2wpkhTestnet.script,
      },
      paymentAddress: p2wpkhTestnet.address!,
      network: 'testnet',
    });
    const tx = btc.Transaction.fromPSBT(result.psbt);
    expect(tx.lockTime).toBe(21);
  });
});

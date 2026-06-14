import { hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import { describe, expect, it } from 'vitest';

import { enforceTransferInvariants } from '../invariants/transfer-invariants';
import type { Cat21TransferIntent, Validated } from '../types';
import {
  BuildTransferPsbtArgs,
  TRANSFER_CAT_OUTPUT_SATS,
  buildTransferPsbt,
} from './transfer-builder';

const publicKey = hex.decode('030000000000000000000000000000000000000000000000000000000000000001');
const p2wpkhMainnet = btc.p2wpkh(publicKey, btc.NETWORK);
const VALID_CAT_ID = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefi0';

function validatedIntent(
  overrides: Partial<Cat21TransferIntent> = {}
): Validated<Cat21TransferIntent> {
  const raw: Cat21TransferIntent = {
    catId: VALID_CAT_ID,
    recipient: p2wpkhMainnet.address!,
    feeRate: 5,
    ...overrides,
  };
  return enforceTransferInvariants(raw, 'mainnet');
}

function makeArgs(overrides: Partial<BuildTransferPsbtArgs> = {}): BuildTransferPsbtArgs {
  const catUtxo = {
    txid: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    vout: 0,
    value: 546,
    scriptPubKey: p2wpkhMainnet.script,
  };
  const fundingUtxo = {
    txid: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
    vout: 1,
    value: 50_000,
    scriptPubKey: p2wpkhMainnet.script,
  };
  return {
    intent: validatedIntent(),
    catUtxo,
    fundingUtxo,
    paymentAddress: p2wpkhMainnet.address!,
    network: 'mainnet',
    ...overrides,
  };
}

describe('buildTransferPsbt', () => {

  it('produces a parseable PSBT', () => {
    const result = buildTransferPsbt(makeArgs());
    expect(Array.from(result.psbt.slice(0, 5))).toEqual([0x70, 0x73, 0x62, 0x74, 0xff]);
  });

  it('places the cat UTXO at input 0 and funding at input 1', () => {
    const args = makeArgs();
    const result = buildTransferPsbt(args);
    const tx = btc.Transaction.fromPSBT(result.psbt);
    expect(tx.inputsLength).toBe(2);
    expect(Array.from(tx.getInput(0).txid!)).toEqual(
      Array.from(hex.decode(args.catUtxo.txid))
    );
    expect(Array.from(tx.getInput(1).txid!)).toEqual(
      Array.from(hex.decode(args.fundingUtxo.txid))
    );
  });

  it('places the recipient at output 0 with 546 sats (cat lands here)', () => {
    const result = buildTransferPsbt(makeArgs());
    const tx = btc.Transaction.fromPSBT(result.psbt);
    expect(tx.getOutput(0).amount).toBe(BigInt(TRANSFER_CAT_OUTPUT_SATS));
  });

  it('every input carries SIGHASH_ALL', () => {
    const result = buildTransferPsbt(makeArgs());
    const tx = btc.Transaction.fromPSBT(result.psbt);
    for (let i = 0; i < tx.inputsLength; i++) {
      expect(tx.getInput(i).sighashType).toBe(btc.SigHash.ALL);
    }
  });

  it('does NOT set lockTime=21 (transfer is not a mint)', () => {
    const result = buildTransferPsbt(makeArgs());
    const tx = btc.Transaction.fromPSBT(result.psbt);
    expect(tx.lockTime).toBe(0);
  });

  it('emits change above dust as output 1 (after cat output)', () => {
    const result = buildTransferPsbt(makeArgs());
    const tx = btc.Transaction.fromPSBT(result.psbt);
    // 546 (cat in) + 50_000 (funding) - 546 (cat out) - 5×220 (fee=1100) = 48_900 change
    expect(tx.outputsLength).toBe(2);
    expect(tx.getOutput(1).amount).toBe(BigInt(48_900));
  });

  it('absorbs sub-dust change into the miner fee instead of emitting it', () => {
    // catUtxo=546 + funding=1645 = 2191 totalIn; 2191 - 546 (cat out) - 1100 (fee) = 545 change → sub-dust → absorbed.
    const result = buildTransferPsbt(
      makeArgs({
        fundingUtxo: {
          txid: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
          vout: 1,
          value: 1_645,
          scriptPubKey: p2wpkhMainnet.script,
        },
      })
    );
    const tx = btc.Transaction.fromPSBT(result.psbt);
    expect(tx.outputsLength).toBe(1);
    expect(result.changeAbsorbed).toBe(true);
  });

  it('uses a single input when catUtxo has enough value to cover postage+fee on its own', () => {
    const args = makeArgs();
    // catUtxo and fundingUtxo same → single input is used.
    const singleArgs = {
      ...args,
      catUtxo: { ...args.catUtxo, value: 50_000 },
      fundingUtxo: { ...args.catUtxo, value: 50_000 },
    };
    const result = buildTransferPsbt(singleArgs);
    const tx = btc.Transaction.fromPSBT(result.psbt);
    expect(tx.inputsLength).toBe(1);
  });

  it('throws on insufficient transfer funding', () => {
    expect(() =>
      buildTransferPsbt(
        makeArgs({
          fundingUtxo: {
            txid: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
            vout: 1,
            value: 100, // way too small for 1100 sat fee
            scriptPubKey: p2wpkhMainnet.script,
          },
        })
      )
    ).toThrow(/Transfer funding insufficient/);
  });

  it('respects tapInternalKey for P2TR cat UTXO', () => {
    const taproot = btc.p2tr(publicKey.slice(1, 33), undefined, btc.NETWORK);
    const result = buildTransferPsbt(
      makeArgs({
        catUtxo: {
          txid: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          vout: 0,
          value: 546,
          scriptPubKey: taproot.script,
          tapInternalKey: publicKey.slice(1, 33),
        },
      })
    );
    const tx = btc.Transaction.fromPSBT(result.psbt);
    expect(tx.getInput(0).tapInternalKey).toBeDefined();
  });

  it('computes fee as feeRate × vsize (220 vbytes base)', () => {
    const result = buildTransferPsbt(makeArgs({ intent: validatedIntent({ feeRate: 10 }) }));
    expect(result.fee).toBe(2_200);
  });
});

import * as btc from '@scure/btc-signer';

import type { Cat21TransferIntent, Validated } from '../types';
import {
  CAT21_LOCK_TIME,
  CAT21_WALLET_MINT_INPUT_SEQUENCE,
} from './mint-builder';

/**
 * Cat-output postage. Same as mint and offer — 546 sats keeps cat output
 * value uniform across all three flows.
 */
export const TRANSFER_CAT_OUTPUT_SATS = 546;

/**
 * Dust threshold for change output.
 */
export const TRANSFER_CHANGE_DUST_LIMIT_SATS = 546;

/**
 * Estimated vsize for a 2-in-2-out transfer tx:
 *   - input 0 (cat-bearing UTXO): ~70 vbytes
 *   - input 1 (funding UTXO):     ~70 vbytes
 *   - output 0 (cat recipient):   ~31 vbytes
 *   - output 1 (change):          ~31 vbytes
 *   - tx overhead:                ~11 vbytes
 * Sum: ~213 vbytes. Round up to 220 for safety.
 */
const TRANSFER_VSIZE_BASE = 220;

export interface TransferUtxo {
  txid: string;
  vout: number;
  value: number;
  scriptPubKey: Uint8Array;
  tapInternalKey?: Uint8Array;
}

export interface BuildTransferPsbtArgs {
  intent: Validated<Cat21TransferIntent>;
  /**
   * The cat-bearing UTXO. By ordinal-theory convention, the cat lives
   * on the first sat of this UTXO — when spent as input 0, it ends up
   * on the first sat of output 0.
   */
  catUtxo: TransferUtxo;
  /** Funding UTXO for the miner fee. May coincide with the cat UTXO if it has surplus value. */
  fundingUtxo: TransferUtxo;
  paymentAddress: string;
  network: 'mainnet' | 'testnet';
}

export interface BuildTransferPsbtResult {
  hex: string;
  psbt: Uint8Array;
  weight: number;
  fee: number;
  changeAbsorbed: boolean;
}

/**
 * Builds the unsigned CAT-21 transfer PSBT.
 *
 * Structure:
 *   Input 0  — cat-bearing UTXO. The cat sits on its first sat and
 *              must be spent to output 0 to preserve ownership.
 *   Input 1  — funding UTXO (may equal cat UTXO when surplus value
 *              covers the fee; in that case input 1 is omitted).
 *   Output 0 — recipient address, 546 sats. The cat lands here AND a
 *              new cat is revealed on the same satoshi.
 *
 * Hard invariants (asserted before return):
 *   1. `lockTime === 21`. Every cat-touching tx our code builds is a
 *      CAT-21 mint by policy — a transfer mints a new cat onto the same
 *      ordinal that already carries the original cat. Per the protocol
 *      spec, a single CAT-21 ordinal can carry multiple cats through
 *      repeated minting.
 *   2. Every input carries `sequence === 0xfffffffd` (RBF-signalling).
 *      Sequence is purely about RBF UX — block 21 was mined in 2009,
 *      so the lockTime field has no consensus meaning, it's a data
 *      marker. `0xfffffffd` lets our own accelerate flow fee-bump the
 *      tx; that flow is required to preserve `lockTime=21` through any
 *      replacement.
 *   3. Every input carries SIGHASH_ALL. The signature commits to
 *      lockTime, so the marker is cryptographically locked the moment
 *      the input is signed.
 *
 * Coin selection (find one or two UTXOs that cover postage + fee) is
 * the caller's responsibility.
 */
export function buildTransferPsbt(args: BuildTransferPsbtArgs): BuildTransferPsbtResult {
  const scureNetwork = args.network === 'mainnet' ? btc.NETWORK : btc.TEST_NETWORK;
  const tx = new btc.Transaction({
    lockTime: CAT21_LOCK_TIME,
    allowLegacyWitnessUtxo: true,
    disableScriptCheck: true,
  });

  addInput(tx, args.catUtxo);

  const usesSeparateFundingInput = !sameUtxo(args.catUtxo, args.fundingUtxo);
  if (usesSeparateFundingInput) {
    addInput(tx, args.fundingUtxo);
  }

  // Output 0: recipient. Cat ordinal travels here via FIFO; lockTime=21
  // mints a fresh cat onto the same sat in the same tx.
  tx.addOutputAddress(
    args.intent.recipient,
    BigInt(TRANSFER_CAT_OUTPUT_SATS),
    scureNetwork
  );

  // Fee estimate.
  const estimatedVsize = TRANSFER_VSIZE_BASE;
  const fee = Math.ceil(args.intent.feeRate * estimatedVsize);

  // Change calculation. Total in = cat UTXO value + (funding UTXO value if separate).
  // Required out = 546 (cat output) + fee.
  const totalIn = args.catUtxo.value + (usesSeparateFundingInput ? args.fundingUtxo.value : 0);
  const change = totalIn - TRANSFER_CAT_OUTPUT_SATS - fee;
  if (change < 0) {
    throw new Error(
      `Transfer funding insufficient: ${totalIn} sats < ${TRANSFER_CAT_OUTPUT_SATS + fee} sats required`
    );
  }

  const changeAbsorbed = change > 0 && change < TRANSFER_CHANGE_DUST_LIMIT_SATS;
  if (change >= TRANSFER_CHANGE_DUST_LIMIT_SATS) {
    tx.addOutputAddress(args.paymentAddress, BigInt(change), scureNetwork);
  }

  // Hard post-build asserts. Match mint-builder's positive invariant
  // shape — same constants, same failure mode.
  if (tx.lockTime !== CAT21_LOCK_TIME) {
    throw new Error(
      `CAT-21 invariant violated: lockTime=${tx.lockTime}, expected ${CAT21_LOCK_TIME}`
    );
  }
  for (let i = 0; i < tx.inputsLength; i++) {
    const input = tx.getInput(i);
    if (input.sequence !== CAT21_WALLET_MINT_INPUT_SEQUENCE) {
      throw new Error(
        `CAT-21 invariant violated: input ${i} sequence=${input.sequence}, expected ${CAT21_WALLET_MINT_INPUT_SEQUENCE}`
      );
    }
    if (input.sighashType !== btc.SigHash.ALL) {
      throw new Error(
        `CAT-21 invariant violated: input ${i} sighashType is not SIGHASH_ALL`
      );
    }
  }

  return {
    hex: tx.hex,
    psbt: tx.toPSBT(),
    weight: estimatedVsize * 4,
    fee,
    changeAbsorbed,
  };
}

function addInput(tx: btc.Transaction, utxo: TransferUtxo): void {
  const inputBase = {
    txid: utxo.txid,
    index: utxo.vout,
    sequence: CAT21_WALLET_MINT_INPUT_SEQUENCE,
    sighashType: btc.SigHash.ALL,
    witnessUtxo: {
      script: utxo.scriptPubKey,
      amount: BigInt(utxo.value),
    },
  };
  if (utxo.tapInternalKey) {
    tx.addInput({ ...inputBase, tapInternalKey: utxo.tapInternalKey });
  } else {
    tx.addInput(inputBase);
  }
}

function sameUtxo(a: TransferUtxo, b: TransferUtxo): boolean {
  return a.txid === b.txid && a.vout === b.vout;
}

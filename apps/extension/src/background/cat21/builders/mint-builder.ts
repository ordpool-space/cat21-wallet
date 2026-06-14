import * as btc from '@scure/btc-signer';

import type { Cat21MintIntent, Validated } from '../types';

/**
 * Protocol identifier for CAT-21 mints. Every cat lives on a transaction
 * with `nLockTime === 21`. The builder pins this; the post-build assert
 * fails loudly if a future refactor drops it.
 */
export const CAT21_LOCK_TIME = 21;

/**
 * Cat21-wallet's mint input sequence — RBF-signalling, lockTime-enforced.
 * See `ordpool-sdk/.claude/CLAUDE.md` "CAT-21 mints — RBF policy
 * (per-wallet)" for why we pick `0xfffffffd` while every other wallet
 * picks `0xfffffffe`. Our increase-fee flow guarantees lockTime
 * preservation through RBF replacement (see cat21-wallet HARD RULE #1),
 * so signalling RBF is safe AND useful for the cat21wallet path.
 */
export const CAT21_WALLET_MINT_INPUT_SEQUENCE = 0xfffffffd;

/**
 * Cat sat sits on the first sat of the first output. The recipient
 * output value is fixed at 546 sats — above relay dust on every address
 * type, uniform across cat-mint / cat-transfer / cat-offer.
 */
export const CAT21_CAT_OUTPUT_SATS = 546;

/**
 * Inputs the wallet's signer needs to actually sign the mint. The
 * caller (Cat21RpcService) gathers these from the wallet's existing
 * keychain / UTXO services before calling this builder.
 *
 * The funding UTXO is singular. Coin selection (find one UTXO that
 * covers price + postage + fee) is the caller's responsibility — keeps
 * the builder pure-functional and easy to spec.
 */
export interface BuildMintPsbtArgs {
  intent: Validated<Cat21MintIntent>;
  fundingUtxo: {
    txid: string;
    vout: number;
    value: number;
    /** scriptPubKey of the funding UTXO (witness-program bytes). */
    scriptPubKey: Uint8Array;
    /** Required for P2TR funding UTXOs so the signer can build a key-path signature. */
    tapInternalKey?: Uint8Array;
  };
  /** Sender's own address. Change (when above dust) returns here. */
  paymentAddress: string;
  /** 'mainnet' or 'testnet'. Matches the network arg of `enforceMintInvariants`. */
  network: 'mainnet' | 'testnet';
}

export interface BuildMintPsbtResult {
  /** Raw hex of the unsigned tx. */
  hex: string;
  /** Raw PSBT bytes. */
  psbt: Uint8Array;
  /** Tx weight in WU. Caller uses it for the broadcast dispatcher's mempool/Slipstream decision. */
  weight: number;
  /** Computed miner fee in sats. */
  fee: number;
  /** True when sub-dust change was absorbed into the fee. */
  changeAbsorbed: boolean;
}

/**
 * Estimated virtual size in vbytes for a CAT-21 mint tx.
 *
 *   - 1 P2WPKH/P2TR input with witness data:  ~70 vbytes
 *   - 1 recipient output (P2WPKH or P2TR):    ~31 vbytes
 *   - 1 change output (P2WPKH):               ~31 vbytes
 *   - tx overhead (version + locktime):       ~11 vbytes
 *
 * Sum:  ~143 vbytes. Round up to 150 for safety. Optional tip output
 * adds another ~31 vbytes; we include it when the intent ships a tip.
 *
 * Constants are integer literals (no helper imports) so the spec can
 * sanity-check the fee math without spinning up an SDK estimator.
 */
const MINT_VSIZE_BASE = 150;
const MINT_VSIZE_PER_TIP_OUTPUT = 31;

/**
 * Dust threshold below which change is absorbed into the miner fee.
 * 546 is the conservative cross-address-type floor used across CAT-21
 * mint / transfer / offer flows.
 */
export const CAT21_CHANGE_DUST_LIMIT_SATS = 546;

/**
 * Builds the unsigned CAT-21 mint PSBT.
 *
 * Hard invariants the result holds (asserted before return):
 *
 *   1. Transaction `lockTime === 21`.
 *   2. Every input carries `sequence === 0xfffffffd` (RBF-signalling,
 *      lockTime-enforced).
 *   3. Output 0 = recipient (intent.recipient), value 546 sats. The
 *      cat lives on the first sat of this output.
 *   4. Output 1 = change to `paymentAddress` (only when above dust).
 *   5. Optional output N = tip output (only when intent.tip.value > 0).
 *
 * Coin selection is NOT performed here. The caller passes one funding
 * UTXO that must cover postage + fee + optional tip. Insufficient
 * funding throws.
 */
export function buildMintPsbt(args: BuildMintPsbtArgs): BuildMintPsbtResult {
  const scureNetwork = args.network === 'mainnet' ? btc.NETWORK : btc.TEST_NETWORK;

  const tx = new btc.Transaction({
    lockTime: CAT21_LOCK_TIME,
    allowLegacyWitnessUtxo: true,
    disableScriptCheck: true,
  });

  // Input: the funding UTXO with the RBF-signalling Cat21-wallet sequence.
  const inputBase = {
    txid: args.fundingUtxo.txid,
    index: args.fundingUtxo.vout,
    sequence: CAT21_WALLET_MINT_INPUT_SEQUENCE,
    sighashType: btc.SigHash.ALL,
    witnessUtxo: {
      script: args.fundingUtxo.scriptPubKey,
      amount: BigInt(args.fundingUtxo.value),
    },
  };
  if (args.fundingUtxo.tapInternalKey) {
    tx.addInput({ ...inputBase, tapInternalKey: args.fundingUtxo.tapInternalKey });
  } else {
    tx.addInput(inputBase);
  }

  // Output 0: recipient (the cat lands on the first sat of this output).
  tx.addOutputAddress(
    args.intent.recipient,
    BigInt(CAT21_CAT_OUTPUT_SATS),
    scureNetwork
  );

  // Fee estimate. The tip output (when present) adds ~31 vbytes.
  const hasTipOutput = args.intent.tip !== undefined && args.intent.tip.value > 0;
  const estimatedVsize = MINT_VSIZE_BASE + (hasTipOutput ? MINT_VSIZE_PER_TIP_OUTPUT : 0);
  const fee = Math.ceil(args.intent.feeRate * estimatedVsize);

  // Tip output (if requested and above 0).
  const tipValue = hasTipOutput && args.intent.tip ? args.intent.tip.value : 0;
  if (hasTipOutput && args.intent.tip) {
    tx.addOutputAddress(args.intent.tip.address, BigInt(tipValue), scureNetwork);
  }

  // Change calculation. The funding UTXO covers postage + tip + fee +
  // optional change. Insufficient funding throws.
  const change = args.fundingUtxo.value - CAT21_CAT_OUTPUT_SATS - tipValue - fee;
  if (change < 0) {
    throw new Error(
      `Funding UTXO insufficient: ${args.fundingUtxo.value} sats < ${CAT21_CAT_OUTPUT_SATS + tipValue + fee} sats required`
    );
  }

  const changeAbsorbed = change > 0 && change < CAT21_CHANGE_DUST_LIMIT_SATS;
  if (change >= CAT21_CHANGE_DUST_LIMIT_SATS) {
    tx.addOutputAddress(args.paymentAddress, BigInt(change), scureNetwork);
  }

  // Hard post-build asserts. CLAUDE.md HARD RULE #1: nLockTime=21 is
  // the protocol marker. CLAUDE.md cat21-mint sequence rule:
  // 0xfffffffd for the cat21wallet path.
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
  }

  return {
    hex: tx.hex,
    psbt: tx.toPSBT(),
    // `tx.weight` is only defined on finalised transactions. We're handing
    // back an unsigned PSBT, so callers (broadcast dispatcher) get our
    // pre-sign estimate: vsize × 4 (segwit weight convention). The 5-10%
    // overshoot is intentional — preferable to a miss-the-ceiling Slipstream
    // dispatch decision.
    weight: estimatedVsize * 4,
    fee,
    changeAbsorbed,
  };
}

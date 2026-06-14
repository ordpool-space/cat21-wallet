import type { Cat21MintIntent, Validated } from '../types';

/**
 * Inputs the wallet's signer needs to actually sign the mint. The
 * caller (Cat21RpcService) gathers these from the wallet's existing
 * keychain / UTXO services before calling this builder.
 */
export interface BuildMintPsbtArgs {
  intent: Validated<Cat21MintIntent>;
  fundingUtxos: readonly {
    txid: string;
    vout: number;
    value: number;
    scriptPubKey: Uint8Array;
    tapInternalKey?: Uint8Array;
  }[];
  /** Wallet's own change address. */
  changeAddress: string;
  /** `'mainnet' | 'testnet'`. */
  network: 'mainnet' | 'testnet';
}

export interface BuildMintPsbtResult {
  /** Hex-encoded unsigned tx. */
  hex: string;
  /** Raw PSBT bytes. */
  psbt: Uint8Array;
  /** Weight in WU, used by the broadcast dispatcher to choose mempool vs Slipstream. */
  weight: number;
}

/**
 * Builds the unsigned CAT-21 mint PSBT by delegating to
 * `ordpool-sdk → createTransaction`. The wallet does not re-implement
 * mint mechanics; it only assembles the SDK call from the validated
 * intent.
 *
 * The Validated brand on `args.intent` is enforced by the type system:
 * callers must run `enforceMintInvariants` first. There is no way to
 * call this with an unvetted intent without a type error.
 *
 * Post-build assertions live in the iteration-2 implementation and run
 * on `tx.lockTime === 21` and the per-wallet sequence value
 * (0xfffffffd for cat21wallet per ordpool-sdk's RBF policy table).
 */
export function buildMintPsbt(args: BuildMintPsbtArgs): Promise<BuildMintPsbtResult> {
  void args;
  return Promise.reject(new Error('Not implemented — see iteration-2 commit'));
}

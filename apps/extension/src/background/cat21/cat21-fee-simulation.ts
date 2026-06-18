/**
 * Wallet-side bridge between the SDK's `twoPassFeeSimulation` and the
 * SDK's per-flow builders (`buildCat21MintPsbt`,
 * `buildCat21TransferPsbt`). The SDK exposes the loop and the
 * builders; the wallet exposes the per-flow `simulate(feeSats)`
 * callback by:
 *
 *   1. Calling the SDK builder with `feeSats`
 *   2. Dummy-signing every input with the SDK's well-known dummy
 *      keypair (`getDummyKeypair`)
 *   3. Finalising and reading `tx.vsize`
 *
 * The dummy keypair is SDK-controlled and only valid for simulation —
 * the resulting signatures are structurally valid for vsize but
 * cryptographically meaningless. **Never broadcast.**
 *
 * Why this lives in the wallet: the simulate callback is the only
 * piece that has to know how many inputs to dummy-sign (per flow).
 * The SDK keeps the dummy keypair + the loop; the wallet decides
 * which idxs to sign for each flow.
 *
 * Only mint + transfer need this. accept-offer's fee is set by the
 * buyer inside the PSBT; the wallet just signs+broadcasts.
 */
import * as btc from '@scure/btc-signer';
import {
  type Cat21MintFundingInput,
  type Cat21TransferCatInput,
  type Cat21TransferDestinations,
  type Cat21TransferFundingInput,
  KnownOrdinalWalletType,
  type Network,
  buildCat21MintPsbt,
  buildCat21TransferPsbt,
  getDummyKeypair,
  toScureNetwork,
  twoPassFeeSimulation,
} from 'ordpool-sdk/core';

const ALLOWED_DUMMY_SIGHASHES = [btc.SigHash.DEFAULT, btc.SigHash.ALL];

interface SimulateMintFeeArgs {
  network: Network;
  fundingInput: Cat21MintFundingInput;
  destinations: {
    recipientAddress: string;
    senderChangeAddress: string;
    tip?: { address: string; valueSats: number };
  };
  /** sat/vB the user/agent asked for. */
  feeRatePerVbyte: number;
}

/**
 * Run the two-pass fee simulation for a CAT-21 mint and return the
 * final fee in sats. The caller then re-builds the real PSBT with
 * `feeSats: finalFeeSats` for signing.
 *
 * Mint has exactly one input (the funding UTXO) so dummy-signing is
 * `signIdx(dummyPrivateKey, 0, …)`.
 */
export function simulateMintFee(args: SimulateMintFeeArgs): {
  finalFeeSats: number;
  vsize: number;
} {
  const dummy = getDummyKeypair(toScureNetwork(args.network)).dummyPrivateKey;
  const { finalFeeSats, vsize } = twoPassFeeSimulation({
    feeRatePerVbyte: args.feeRatePerVbyte,
    simulate(feeSats) {
      const sim = buildCat21MintPsbt({
        walletType: KnownOrdinalWalletType.cat21wallet,
        network: args.network,
        fundingInput: args.fundingInput,
        destinations: args.destinations,
        feeSats,
      });
      sim.tx.signIdx(dummy, 0, ALLOWED_DUMMY_SIGHASHES);
      sim.tx.finalize();
      return { vsize: sim.tx.vsize };
    },
  });
  return { finalFeeSats, vsize };
}

interface SimulateTransferFeeArgs {
  network: Network;
  catUtxo: Cat21TransferCatInput;
  fundingInputs: Cat21TransferFundingInput[];
  destinations: Cat21TransferDestinations;
  feeRatePerVbyte: number;
}

/**
 * Two-pass fee simulation for a CAT-21 transfer. Transfer has the
 * cat UTXO at input 0 plus 1+ funding inputs — dummy-sign every
 * input before reading vsize.
 *
 * Returns `finalFeeSats` for the caller to re-build the real PSBT
 * with.
 */
export function simulateTransferFee(args: SimulateTransferFeeArgs): {
  finalFeeSats: number;
  vsize: number;
} {
  const dummy = getDummyKeypair(toScureNetwork(args.network)).dummyPrivateKey;
  const { finalFeeSats, vsize } = twoPassFeeSimulation({
    feeRatePerVbyte: args.feeRatePerVbyte,
    simulate(feeSats) {
      const sim = buildCat21TransferPsbt({
        walletType: KnownOrdinalWalletType.cat21wallet,
        network: args.network,
        catUtxo: args.catUtxo,
        fundingInputs: args.fundingInputs,
        destinations: args.destinations,
        feeSats,
      });
      // `BuildCat21TransferResult` exposes `psbt` bytes (not the
      // scure Transaction). Re-parse here for the dummy-sign +
      // finalise + vsize observation.
      const tx = btc.Transaction.fromPSBT(sim.psbt);
      for (let i = 0; i < tx.inputsLength; i++) {
        tx.signIdx(dummy, i, ALLOWED_DUMMY_SIGHASHES);
      }
      tx.finalize();
      return { vsize: tx.vsize };
    },
  });
  return { finalFeeSats, vsize };
}

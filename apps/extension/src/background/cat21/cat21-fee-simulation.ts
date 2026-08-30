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
 * Mint, transfer, and buy need this. On buy the wallet IS the buyer,
 * so it sizes the buy-offer PSBT itself — input 0 (the seller's cat)
 * is non-signable here, so vsize comes from `computePsbtVsize` with a
 * faked witness there rather than a dummy-sign. accept-offer's fee is
 * set by the buyer inside the PSBT; the seller just signs input 0 +
 * broadcasts, so it needs no simulation.
 */
import {
  type Cat21OfferBuyerInput,
  type Cat21OfferDestinations,
  type Cat21OfferSellerInput,
  KnownOrdinalWalletType,
  type Network,
  buildCat21BuyOfferPsbt,
  computePsbtVsize,
  toScureNetwork,
  twoPassFeeSimulation,
} from 'ordpool-sdk/core';

interface SimulateBuyOfferFeeArgs {
  network: Network;
  /** Seller's cat UTXO (input 0). Always 546 sats; the buyer never signs it. */
  sellerInput: Cat21OfferSellerInput;
  /** Buyer-funded inputs (1..N). Signed by the buyer, SIGHASH_ALL. */
  buyerInputs: Cat21OfferBuyerInput[];
  destinations: Cat21OfferDestinations;
  /** Net sats offered to the seller. */
  priceSats: number;
  feeRatePerVbyte: number;
}

/**
 * Two-pass fee simulation for a buyer-initiated CAT-21 buy-offer. The
 * wallet is the buyer, so it computes the fee (unlike accept-offer,
 * where the buyer already baked the fee in).
 *
 * Input 0 is the SELLER's cat UTXO — the buyer can't sign it, so we
 * size the tx via `computePsbtVsize({ nonSignableInputs: [0] })`,
 * which fakes a 64-byte taproot key-path witness there and dummy-signs
 * only the buyer's inputs 1..N. Returns `finalFeeSats` for the caller
 * to re-build the real PSBT with.
 */
export function simulateBuyOfferFee(args: SimulateBuyOfferFeeArgs): {
  finalFeeSats: number;
  vsize: number;
} {
  const scureNetwork = toScureNetwork(args.network);
  const { finalFeeSats, vsize } = twoPassFeeSimulation({
    feeRatePerVbyte: args.feeRatePerVbyte,
    simulate(feeSats) {
      const sim = buildCat21BuyOfferPsbt({
        walletType: KnownOrdinalWalletType.cat21wallet,
        network: args.network,
        sellerInput: args.sellerInput,
        buyerInputs: args.buyerInputs,
        destinations: args.destinations,
        priceSats: args.priceSats,
        feeSats,
      });
      return {
        vsize: computePsbtVsize({
          psbt: sim.psbt,
          network: scureNetwork,
          nonSignableInputs: [0],
        }),
      };
    },
  });
  return { finalFeeSats, vsize };
}

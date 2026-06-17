import type { Cat21CreateOfferIntent, Cat21RpcListingSuccess, Validated } from '../types';

/**
 * Inputs the listing builder needs to assemble a `Cat21RpcListingSuccess`.
 * The cat UTXO comes from cat21-ord (proof of ownership); price and
 * payment address come from the validated intent.
 *
 * Why no PSBT here: cat21_create_offer does NOT commit anything on-chain.
 * The seller publishes a structured listing object; buyers later construct
 * a buy-offer PSBT (SDK's `buildCat21BuyOfferPsbt`) that the seller signs
 * and broadcasts via `cat21_accept_offer`. The PSBT-construction shape is
 * deliberate (CLAUDE.md HARD RULE #6 + SDK's "buyer-initiated" model):
 * keeping listings as data and the only cat-spending PSBT as the
 * fully-signed acceptance tx means there is exactly one moment where a
 * cat-bearing input is signed, and it carries the cryptographic gate of
 * the seller's signature reviewing the buyer's bytes.
 */
export interface BuildListingArgs {
  intent: Validated<Cat21CreateOfferIntent>;
  sellerUtxo: { txid: string; vout: number };
}

/**
 * Builds the structured listing object returned by `cat21_create_offer`.
 *
 * No PSBT, no signature, no broadcast. The wallet has already proven
 * ownership via cat21-ord lookup before calling this builder; the
 * builder's only job is to assemble the `Cat21RpcListingSuccess.listing`
 * payload from the validated intent + resolved seller UTXO.
 */
export function buildListing(args: BuildListingArgs): Cat21RpcListingSuccess['listing'] {
  return {
    catId: args.intent.catId,
    sellerUtxo: { txid: args.sellerUtxo.txid, vout: args.sellerUtxo.vout },
    priceSats: args.intent.priceSats,
    paymentAddress: args.intent.paymentAddress,
  };
}

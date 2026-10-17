/**
 * Shared types for the internal Cat21 RPC surface.
 *
 * The four mutating cat21 operations have protocol-level intent
 * shapes — `Cat21MintIntent`, `Cat21TransferIntent`,
 * `Cat21CreateOfferIntent`, `Cat21AcceptOfferIntent` — defined in
 * `ordpool-sdk/core`. The wallet imports them verbatim and adds an
 * optional `mode` tag (manual vs autonomous) that's the wallet's
 * transport-routing concern, not part of the protocol.
 *
 * Validation: `validateCat21Operation` from the SDK is the single
 * bulletproof gate. Every rejection reason maps to a closed-set
 * named variant; the downstream rpc-service maps SDK reasons onto
 * its own `Cat21RpcDenyReason` union. The discriminated-union
 * return type from the gate is the runtime witness that validation
 * ran — no branded type or out-of-band marker needed.
 *
 * Per CLAUDE.md HARD RULE #6, the typed `cat21_*` actions live on the
 * internal `Cat21RpcService` only, reachable from two transports:
 * the wallet popup UI (Path 2) and the MCP NMH bridge (Path 3). The
 * browser surface (`window.Cat21Provider`) never sees these types.
 */
import type {
  Cat21AcceptOfferIntent as SdkCat21AcceptOfferIntent,
  Cat21BuyIntent as SdkCat21BuyIntent,
  Cat21CreateOfferIntent as SdkCat21CreateOfferIntent,
  Cat21MintIntent as SdkCat21MintIntent,
  Cat21TransferIntent as SdkCat21TransferIntent,
} from 'ordpool-sdk/core';

/* ------------------------------- Intents ------------------------------- */

/** Optional transport-routing hint the wallet's mode-resolver reads. */
interface WalletModeTag {
  /** Defaults to `'manual'` when omitted. */
  mode?: 'autonomous' | 'manual';
}

export type Cat21MintIntent = SdkCat21MintIntent & WalletModeTag;
export type Cat21TransferIntent = SdkCat21TransferIntent & WalletModeTag;
export type Cat21CreateOfferIntent = SdkCat21CreateOfferIntent & WalletModeTag;
export type Cat21AcceptOfferIntent = SdkCat21AcceptOfferIntent & WalletModeTag;

/**
 * Wallet buy intent = the SDK's `Cat21BuyIntent` (catId, bidSats,
 * sellerPaymentAddress, feeRate — the fields the SDK gate validates)
 * plus two wallet-only fields:
 *   - `mode` — transport-routing hint (manual vs autonomous).
 *   - `catNumber` — the headline cat number, known from the ask-link /
 *     by-number lookup on the buy page. The SDK intent carries only the
 *     inscription id (`catId`); the Bazaar bid DTO needs the cat number
 *     for display + the buyer-observed `cats` bundle (a 546-sat cat UTXO
 *     holds exactly one cat, so the bundle is `[catNumber]`). The SDK
 *     gate ignores this extra field.
 */
export type Cat21BuyIntent = SdkCat21BuyIntent & WalletModeTag & { catNumber: number };

export type Cat21Intent =
  | Cat21MintIntent
  | Cat21TransferIntent
  | Cat21CreateOfferIntent
  | Cat21AcceptOfferIntent
  | Cat21BuyIntent;

/* ----------------------------- Result types ---------------------------- */

/**
 * Discriminated success union. Mint, transfer, and accept-offer return a
 * `broadcast` outcome (txid + channel). `cat21_create_offer` returns a
 * `listing` outcome — it does NOT broadcast, it emits a structured listing
 * the agent can publish to a marketplace. Buyers later send back a
 * buy-offer PSBT, which the seller signs+broadcasts via cat21_accept_offer.
 * `cat21_buy` returns a `bid` outcome — the wallet built + buyer-signed a
 * buy-offer PSBT and POSTed it to the Bazaar as a bid. No chain broadcast;
 * the seller accepts + broadcasts.
 */
// HACK -- Cat21: removed `export` (pre-wired for iter 10/11 consumers (popup pages + agent-policy store); restore on wire-up). HARD RULE #5 — restore on consumer wire-up.
type Cat21RpcSuccess = Cat21RpcBroadcastSuccess | Cat21RpcListingSuccess | Cat21RpcBidSuccess;

// HACK -- Cat21: removed `export` (pre-wired for iter 10/11 consumers (popup pages + agent-policy store); restore on wire-up). HARD RULE #5 — restore on consumer wire-up.
interface Cat21RpcBroadcastSuccess {
  kind: 'broadcast';
  txid: string;
  channel: 'mempool' | 'slipstream';
}

/**
 * `cat21_buy` outcome. The wallet built a buy-offer PSBT (input 0 = the
 * seller's cat, unsigned; inputs 1..N = buyer-funded, SIGHASH_ALL-signed),
 * signed the buyer's inputs, and POSTed it to the Bazaar as a bid. The
 * seller later accepts + broadcasts it. Not a chain tx — there is no txid
 * yet; the `psbtBase64` is the artifact the seller signs, and doubles as a
 * shareable accept-link (offers are public — SDK/HQ HARD RULE).
 */
export interface Cat21RpcBidSuccess {
  kind: 'bid';
  /** Headline cat number the bid targets. */
  catNumber: number;
  /** Net sats offered to the seller. */
  bidSats: number;
  /** Cat UTXO the bid pins (PSBT input 0). */
  catTxid: string;
  catVout: number;
  /** The buyer-signed buy-offer PSBT, base64. */
  psbtBase64: string;
}

export interface Cat21RpcListingSuccess {
  kind: 'listing';
  /**
   * The buyer reconstructs the seller-input bytes (`value`, `scriptPubKey`)
   * from cat21-ord's `/output/<txid>:<vout>` before constructing a buy-offer
   * PSBT. That's deliberate — the buyer must not trust seller-asserted UTXO
   * bytes; verifying against chain is the right cryptographic posture, and
   * keeps the listing shape minimal. Publishing this listing publishes the
   * ownership outpoint pre-trade (a buyer can resolve `catId → outpoint`
   * via cat21-ord regardless, so no incremental leak vs. publishing the
   * catId itself; future work may add commit-reveal listings for sellers
   * who want stealth).
   */
  listing: {
    catId: string;
    sellerUtxo: { txid: string; vout: number };
    priceSats: number;
    paymentAddress: string;
  };
}

/**
 * Typed deny reasons. The union mirrors the categories the mode resolver,
 * invariants, and broadcaster can each surface. Surface-specific
 * sub-reasons (`spend-above-action-cap`, `wrong-postage`, etc.) live on
 * the SDK side and are nested in `detail`.
 */
export type Cat21RpcDenyReason =
  | 'intent-shape-invalid'
  | 'intent-invariant-violated'
  | 'agent-disabled'
  | 'policy-denied'
  | 'transport-not-trusted-for-autonomous'
  | 'inbound-offer-mismatch'
  | 'broadcast-failed';

// HACK -- Cat21: removed `export` (pre-wired for iter 10/11 consumers (popup pages + agent-policy store); restore on wire-up). HARD RULE #5 — restore on consumer wire-up.
interface Cat21RpcDenied {
  reason: Cat21RpcDenyReason;
  detail?: string;
}

export type Cat21RpcResult =
  | { ok: true; value: Cat21RpcSuccess }
  | { ok: false; value: Cat21RpcDenied };

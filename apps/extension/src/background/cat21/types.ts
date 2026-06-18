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
 * its own `Cat21RpcDenyReason` union. The branded `Validated<I>`
 * marker type is gone — the discriminated-union return type from
 * the gate is the runtime witness that validation ran.
 *
 * Per CLAUDE.md HARD RULE #6, the typed `cat21_*` actions live on the
 * internal `Cat21RpcService` only, reachable from two transports:
 * the wallet popup UI (Path 2) and the MCP NMH bridge (Path 3). The
 * browser surface (`window.Cat21Provider`) never sees these types.
 */
import type {
  Cat21AcceptOfferIntent as SdkCat21AcceptOfferIntent,
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

export type Cat21Intent =
  | Cat21MintIntent
  | Cat21TransferIntent
  | Cat21CreateOfferIntent
  | Cat21AcceptOfferIntent;

/* ----------------------------- Result types ---------------------------- */

/**
 * Discriminated success union. Mint, transfer, and accept-offer return a
 * `broadcast` outcome (txid + channel). `cat21_create_offer` returns a
 * `listing` outcome — it does NOT broadcast, it emits a structured listing
 * the agent can publish to a marketplace. Buyers later send back a
 * buy-offer PSBT, which the seller signs+broadcasts via cat21_accept_offer.
 */
// HACK -- Cat21: removed `export` (pre-wired for iter 10/11 consumers (popup pages + agent-policy store); restore on wire-up). HARD RULE #5 — restore on consumer wire-up.
type Cat21RpcSuccess = Cat21RpcBroadcastSuccess | Cat21RpcListingSuccess;

// HACK -- Cat21: removed `export` (pre-wired for iter 10/11 consumers (popup pages + agent-policy store); restore on wire-up). HARD RULE #5 — restore on consumer wire-up.
interface Cat21RpcBroadcastSuccess {
  kind: 'broadcast';
  txid: string;
  channel: 'mempool' | 'slipstream';
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

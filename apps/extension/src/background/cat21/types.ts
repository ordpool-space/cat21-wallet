/**
 * Shared types for the internal Cat21 RPC surface.
 *
 * `Validated<I>` is a branded type that can only be constructed by the
 * matching `enforce*Invariants(...)` function in `./invariants/`. Every
 * downstream consumer (builders, signer, broadcaster) takes
 * `Validated<I>` rather than the raw intent — so the type system
 * enforces "invariants ran before the bytes were built" with no
 * convention required at call sites.
 *
 * Per CLAUDE.md HARD RULE #6, the typed `cat21_*` actions live on the
 * internal `Cat21RpcService` only, reachable from two transports:
 * the wallet popup UI (Path 2) and the MCP NMH bridge (Path 3). The
 * browser surface (`window.Cat21Provider`) never sees these types.
 */

declare const ValidatedBrand: unique symbol;

/**
 * Marker token: the value passed an `enforce*Invariants` gate.
 *
 * The brand is a `unique symbol`, unforgeable from outside the
 * invariants module — every cast lives in the gate function itself.
 * Builders and the signer accept `Validated<I>`; passing a raw intent
 * fails at compile time.
 */
export type Validated<I> = I & { readonly [ValidatedBrand]: true };

/* ------------------------------- Intents ------------------------------- */

export interface Cat21MintIntent {
  /** Bitcoin address where the cat lands. P2TR or P2WPKH; checked at gate. */
  recipient: string;
  /** sat/vB the user is willing to pay. */
  feeRate: number;
  /** Optional developer tip output. `value === 0` skips the output. */
  tip?: { address: string; value: number };
  /** Defaults to `'manual'` when omitted. */
  mode?: 'autonomous' | 'manual';
}

export interface Cat21TransferIntent {
  /** Inscription id of the cat to transfer (`{txid}i{index}` shape). */
  catId: string;
  recipient: string;
  feeRate: number;
  mode?: 'autonomous' | 'manual';
}

export interface Cat21CreateOfferIntent {
  catId: string;
  priceSats: number;
  /** Where the seller payment lands (the wallet's own address). */
  paymentAddress: string;
  mode?: 'autonomous' | 'manual';
}

export interface Cat21AcceptOfferIntent {
  /** Inbound PSBT bytes (base64 or hex per caller convention). */
  offerPsbt: string;
  expectedCatId: string;
  expectedPriceSats: number;
  expectedSellerUtxo: { txid: string; vout: number };
  mode?: 'autonomous' | 'manual';
}

export type Cat21Intent =
  | Cat21MintIntent
  | Cat21TransferIntent
  | Cat21CreateOfferIntent
  | Cat21AcceptOfferIntent;

/* ----------------------------- Result types ---------------------------- */

export interface Cat21RpcSuccess {
  txid: string;
  channel: 'mempool' | 'slipstream';
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

export interface Cat21RpcDenied {
  reason: Cat21RpcDenyReason;
  detail?: string;
}

export type Cat21RpcResult =
  | { ok: true; value: Cat21RpcSuccess }
  | { ok: false; value: Cat21RpcDenied };

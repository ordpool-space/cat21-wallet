/**
 * Types + constants for the wallet's CAT-21 Bazaar client (Path 2 —
 * in-wallet sell flow).
 *
 * The Bazaar is the cat orderbook served by cat21-indexer at
 * backend2.cat21.space. The wallet publishes listings the same way
 * cat21.space does, so wallet-originated and site-originated asks
 * are indistinguishable on the orderbook:
 *
 *   - Auth: session-token headers — a BIP-322 signature (ordinals /
 *     taproot key) over the SDK's canonical session message. One
 *     signature authorises mutations for up to 24 h; no per-listing
 *     signature (the backend re-verifies ownership against cat21-ord
 *     on every POST and assigns `signedAt` server-side).
 *   - Transport: plain HTTPS JSON. The extension bypasses CORS via
 *     the `https://backend2.cat21.space/*` host permission, so the
 *     backend's browser-origin allowlist (cat21.space, ordpool.space)
 *     does not apply to us.
 *
 * Mirrors (do not drift):
 *   - DTO: cat21-indexer backend/src/modules/listings/create-listing.dto.ts
 *   - Guard: cat21-indexer backend/src/modules/shared/cat21-session.guard.ts
 *   - Site client: cat21-indexer frontend/src/app/shared/cat21-listing.service.ts
 */

/** The Bazaar backend. Same instance cat21.space talks to. */
export const CAT21_BAZAAR_BASE_URL = 'https://backend2.cat21.space';

/**
 * POST /api/v1/listings request body — field-for-field mirror of the
 * backend's CreateListingDto. The backend cross-checks every claim
 * against cat21-ord (current owner, live cats bundle, outpoint), so
 * a stale or dishonest body is rejected, never trusted.
 */
export interface Cat21BazaarCreateListingRequest {
  /** Headline cat number; must be a member of `cats`. */
  catNumber: number;
  /** Every cat number on the UTXO, ascending. Backend re-derives + rejects drift. */
  cats: number[];
  /** Network tag ('mainnet' — ADR-7 wallet). */
  network: string;
  /** Ask price in sats. 1 .. MAX_ASK_SATS. */
  askSats: number;
  /** Seller's payment address (proceeds land here). */
  payTo: string;
  /** Cat UTXO txid, lowercase 64-hex. */
  catTxid: string;
  /** Cat UTXO vout. */
  catVout: number;
  /** Seller's ordinals address; must match the session-token address. */
  ordinalsAddress: string;
}

/**
 * POST /api/v1/bids request body — field-for-field mirror of the
 * backend's CreateBidDto. UNAUTHENTICATED: the buyer's SIGHASH_ALL
 * signatures on the PSBT's inputs 1..N ARE the auth, so no session
 * token. The backend re-parses the PSBT and cross-checks every claim
 * (outpoint, output addresses, price, cats bundle vs ord) — a
 * dishonest body is rejected, never trusted.
 *
 * Mirrors: cat21-indexer backend/src/modules/bids/dto/create-bid.dto.ts.
 */
export interface Cat21BazaarCreateBidRequest {
  /** Bitcoin network the bid targets. Must match the backend deployment. */
  network: 'mainnet' | 'testnet3' | 'testnet4' | 'signet' | 'regtest';
  /** Cat UTXO txid the PSBT input 0 targets. Lowercase 64-hex. */
  catTxid: string;
  /** vout of the cat UTXO. */
  catVout: number;
  /** Cats on the UTXO (buyer-observed snapshot). 546-sat UTXO ⇒ one cat. */
  cats: number[];
  /** Headline cat number for display; member of `cats`. */
  headlineCatNumber: number;
  /** Bid price in sats (what the seller receives). 1 .. MAX_ASK_SATS. */
  bidSats: number;
  /** Buyer's ordinals address — the cat lands here (output 0). Buyer identity. */
  buyerOrdinalsAddress: string;
  /** Buyer's payment address — the change output (output 2). */
  buyerPaymentAddress: string;
  /** Seller's payout address (output 1); baked into the signed PSBT. */
  sellerPaymentAddress: string;
  /** Buyer's half-signed buy-offer PSBT, base64. Input 0 unsigned (seller signs). */
  psbtBase64: string;
}

/**
 * Bid-mutation error taxonomy. Bid POST is unauthenticated so there's
 * no `session-rejected` on the POST path (DELETE, session-guarded,
 * reuses the listing session codes). Superset of the backend's bid
 * rejection codes plus transport failures. UI copy maps from these.
 */
export type Cat21BazaarBidErrorCode =
  /** Backend PSBT / bundle / price cross-check failures (400-class codes). */
  | 'network-mismatch'
  | 'headline-not-in-bundle'
  | 'bid-below-marketplace-floor'
  | 'psbt-malformed'
  | 'psbt-shape-invalid'
  | 'psbt-input0-mismatch'
  | 'psbt-output0-mismatch'
  | 'psbt-output1-mismatch'
  | 'psbt-output2-mismatch'
  | 'psbt-price-mismatch'
  | 'ord-lookup-failed'
  | 'cat-not-found'
  | 'cats-bundle-drift'
  /** 429 — rate limited (5 bid posts/min/IP). */
  | 'rate-limited'
  /** Anything else the backend rejected (bad DTO, unknown code). */
  | 'rejected'
  /** Fetch failed / backend unreachable. */
  | 'network-error';

export interface Cat21BazaarBidError {
  code: Cat21BazaarBidErrorCode;
  /** Human-readable detail for logs; UI renders from `code`. */
  detail?: string;
}

/**
 * The three session-token headers the Cat21SessionGuard requires on
 * every mutation (POST + DELETE). Values come from
 * `getOrCreateCat21Session`.
 */
export interface Cat21SessionHeaders {
  'X-Cat21-Session-Address': string;
  'X-Cat21-Session-Valid-Until': string;
  'X-Cat21-Session-Signature': string;
}

/** Cached session-token entry (localStorage, keyed per address). */
export interface CachedCat21Session {
  address: string;
  validUntilIso: string;
  /** Base64 BIP-322 signature over the canonical session message. */
  signatureBase64: string;
}

/**
 * Client-side error taxonomy for Bazaar mutations. Superset of the
 * backend's rejection codes plus transport-level failures. UI copy
 * maps from these; never from raw HTTP statuses.
 */
export type Cat21BazaarErrorCode =
  /** 401 — session token rejected; cache is cleared, caller may retry once. */
  | 'session-rejected'
  /** Backend ownership/bundle cross-check failed (422-class codes). */
  | 'not-current-owner'
  | 'cats-bundle-drift'
  | 'outpoint-mismatch'
  | 'cat-not-found'
  | 'network-mismatch'
  /** 429 — rate limited (5 mutations/min/IP). */
  | 'rate-limited'
  /** Anything else the backend rejected (bad DTO, unknown code). */
  | 'rejected'
  /** Fetch failed / backend unreachable. */
  | 'network-error';

export interface Cat21BazaarError {
  code: Cat21BazaarErrorCode;
  /** Human-readable detail for logs; UI renders from `code`. */
  detail?: string;
}

/**
 * State machine for the publish flow surfaced in the create-offer
 * confirm UI. Mirrors cat21.space's sell-modal states.
 */
export type Cat21BazaarPublishState =
  | { step: 'idle' }
  /** Resolving outpoint + cats bundle from cat21-ord. */
  | { step: 'resolving' }
  /** Signing the session message (first mutation in 24 h only). */
  | { step: 'signing-session' }
  /** POST in flight. */
  | { step: 'posting' }
  | { step: 'success'; catNumber: number }
  | { step: 'error'; error: Cat21BazaarError };

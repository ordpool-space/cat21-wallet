/**
 * HTTP client for the CAT-21 Bazaar (backend2.cat21.space).
 *
 * axios per repo HARD RULE #4 (Leather fork keeps axios). The
 * extension's `https://backend2.cat21.space/*` host permission
 * exempts these calls from CORS, so the backend's browser-origin
 * allowlist doesn't apply.
 *
 * Error mapping is exhaustive on our side: every failure lands in
 * the `Cat21BazaarErrorCode` union — UI copy renders from codes,
 * never raw HTTP statuses. On 401 the caller is expected to
 * `clearCat21Session` + optionally retry once with a fresh token.
 */
import axios, { isAxiosError } from 'axios';

import {
  CAT21_BAZAAR_BASE_URL,
  Cat21BazaarBidError,
  Cat21BazaarBidErrorCode,
  Cat21BazaarCreateBidRequest,
  Cat21BazaarCreateListingRequest,
  Cat21BazaarError,
  Cat21BazaarErrorCode,
  Cat21SessionHeaders,
} from './cat21-bazaar.types';

type Cat21BazaarResult<T> = { ok: true; value: T } | { ok: false; error: Cat21BazaarError };

/**
 * Backend rejection codes we surface verbatim; anything else maps
 * to the generic 'rejected' with the raw code in `detail`.
 */
const PASSTHROUGH_CODES: readonly Cat21BazaarErrorCode[] = [
  'not-current-owner',
  'cats-bundle-drift',
  'outpoint-mismatch',
  'cat-not-found',
  'network-mismatch',
];

function isPassthroughCode(code: string): code is Cat21BazaarErrorCode {
  return (PASSTHROUGH_CODES as readonly string[]).includes(code);
}

function mapHttpError(err: unknown): Cat21BazaarError {
  if (!isAxiosError(err) || !err.response) {
    return { code: 'network-error', detail: err instanceof Error ? err.message : String(err) };
  }
  const { status, data } = err.response;
  if (status === 401) return { code: 'session-rejected' };
  if (status === 429) return { code: 'rate-limited' };
  // NestJS error bodies carry the rejection code on `message` (string
  // or string[]) or a custom `code` field, depending on the layer that
  // threw. Probe both, verbatim-map the known ownership codes.
  const raw = (data ?? {}) as { message?: string | string[]; code?: string };
  const candidates = [
    ...(typeof raw.code === 'string' ? [raw.code] : []),
    ...(typeof raw.message === 'string' ? [raw.message] : []),
    ...(Array.isArray(raw.message) ? raw.message : []),
  ];
  const known = candidates.find(isPassthroughCode);
  if (known) return { code: known };
  return { code: 'rejected', detail: candidates[0] ?? `http-${status}` };
}

/**
 * Backend bid-rejection codes we surface verbatim; anything else maps
 * to the generic 'rejected' with the raw code in `detail`.
 */
const BID_PASSTHROUGH_CODES: readonly Cat21BazaarBidErrorCode[] = [
  'network-mismatch',
  'headline-not-in-bundle',
  'bid-below-marketplace-floor',
  'psbt-malformed',
  'psbt-shape-invalid',
  'psbt-input0-mismatch',
  'psbt-output0-mismatch',
  'psbt-output1-mismatch',
  'psbt-output2-mismatch',
  'psbt-price-mismatch',
  'ord-lookup-failed',
  'cat-not-found',
  'cats-bundle-drift',
];

function isBidPassthroughCode(code: string): code is Cat21BazaarBidErrorCode {
  return (BID_PASSTHROUGH_CODES as readonly string[]).includes(code);
}

function mapBidHttpError(err: unknown): Cat21BazaarBidError {
  if (!isAxiosError(err) || !err.response) {
    return { code: 'network-error', detail: err instanceof Error ? err.message : String(err) };
  }
  const { status, data } = err.response;
  if (status === 429) return { code: 'rate-limited' };
  const raw = (data ?? {}) as { message?: string | string[]; code?: string };
  const candidates = [
    ...(typeof raw.code === 'string' ? [raw.code] : []),
    ...(typeof raw.message === 'string' ? [raw.message] : []),
    ...(Array.isArray(raw.message) ? raw.message : []),
  ];
  const known = candidates.find(isBidPassthroughCode);
  if (known) return { code: known };
  return { code: 'rejected', detail: candidates[0] ?? `http-${status}` };
}

/**
 * POST /api/v1/bids — publish (or overwrite) a buyer's bid on a cat
 * UTXO. UNAUTHENTICATED: the half-signed PSBT's SIGHASH_ALL signatures
 * ARE the auth, so no session headers. Re-bidding at a new price from
 * the same buyer ordinals address overwrites the previous bid (backend
 * upserts on `(network, cat_txid, cat_vout, buyer_ordinals_address)`).
 */
export async function postBidToCat21Bazaar(args: {
  request: Cat21BazaarCreateBidRequest;
  baseUrl?: string;
}): Promise<{ ok: true } | { ok: false; error: Cat21BazaarBidError }> {
  const baseUrl = args.baseUrl ?? CAT21_BAZAAR_BASE_URL;
  try {
    await axios.post(`${baseUrl}/api/v1/bids`, args.request, {
      headers: { 'Content-Type': 'application/json' },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapBidHttpError(err) };
  }
}

/**
 * POST /api/v1/listings — create or overwrite the listing for
 * `request.catNumber`. Re-POSTing with a new price is the supported
 * "edit" path (backend upserts).
 */
export async function publishCat21Listing(args: {
  request: Cat21BazaarCreateListingRequest;
  headers: Cat21SessionHeaders;
  baseUrl?: string;
}): Promise<Cat21BazaarResult<void>> {
  const baseUrl = args.baseUrl ?? CAT21_BAZAAR_BASE_URL;
  try {
    await axios.post(`${baseUrl}/api/v1/listings`, args.request, {
      headers: { 'Content-Type': 'application/json', ...args.headers },
    });
    return { ok: true, value: undefined };
  } catch (err) {
    return { ok: false, error: mapHttpError(err) };
  }
}

/**
 * DELETE /api/v1/listings/cat/:catNumber — seller unlists. Same
 * session-header auth as POST; backend checks the session address
 * matches the listing's seller.
 */
export async function unlistCat21(args: {
  catNumber: number;
  headers: Cat21SessionHeaders;
  baseUrl?: string;
}): Promise<Cat21BazaarResult<void>> {
  const baseUrl = args.baseUrl ?? CAT21_BAZAAR_BASE_URL;
  try {
    await axios.delete(`${baseUrl}/api/v1/listings/cat/${args.catNumber}`, {
      headers: { ...args.headers },
    });
    return { ok: true, value: undefined };
  } catch (err) {
    return { ok: false, error: mapHttpError(err) };
  }
}

/**
 * GET /api/v1/listings/cat/:catNumber — public read, no auth.
 * `null` when the cat has no active listing (404). Used to render
 * the "already listed for X sats" state on the sell form.
 */
export async function fetchCat21ListingForCat(args: {
  catNumber: number;
  baseUrl?: string;
}): Promise<Cat21BazaarResult<{ askSats: number; payTo: string } | null>> {
  const baseUrl = args.baseUrl ?? CAT21_BAZAAR_BASE_URL;
  try {
    const res = await axios.get<{ askSats: number; payTo: string }>(
      `${baseUrl}/api/v1/listings/cat/${args.catNumber}`
    );
    return { ok: true, value: { askSats: res.data.askSats, payTo: res.data.payTo } };
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 404) {
      return { ok: true, value: null };
    }
    return { ok: false, error: mapHttpError(err) };
  }
}

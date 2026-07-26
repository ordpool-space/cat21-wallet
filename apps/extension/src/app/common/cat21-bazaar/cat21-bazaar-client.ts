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
import {
  Cat21BazaarCreateListingRequest,
  Cat21BazaarError,
  Cat21SessionHeaders,
} from './cat21-bazaar.types';

export type Cat21BazaarResult<T> = { ok: true; value: T } | { ok: false; error: Cat21BazaarError };

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
  throw new Error('not implemented — shapes-only commit');
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
  throw new Error('not implemented — shapes-only commit');
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
  throw new Error('not implemented — shapes-only commit');
}

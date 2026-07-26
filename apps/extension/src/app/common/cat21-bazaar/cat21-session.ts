/**
 * Session-token acquisition + caching for Bazaar mutations.
 *
 * A session token is a BIP-322 signature (ordinals / taproot key)
 * over the SDK's canonical message:
 *
 *   "Cat21 session: I control <address>, valid until <validUntilIso>"
 *
 * One signature authorises POST/DELETE mutations for
 * CAT21_SESSION_VALIDITY_MS (24 h). Cached in localStorage keyed by
 * address (the popup's chrome-extension origin persists it across
 * popup openings), re-signed only when missing / expired / rejected.
 *
 * The signer is dependency-injected: the caller provides an async
 * `signBip322` callback (wired to the wallet's own taproot keychain
 * via `signBip322MessageSimple` — NOT the dapp RPC popup; this is
 * the wallet's own UI, the user's consent is the sell-form submit).
 *
 * Mirrors cat21-indexer frontend/src/app/shared/cat21-session.service.ts.
 */
import { CachedCat21Session, Cat21SessionHeaders } from './cat21-bazaar.types';

/** Storage key per ordinals address. */
export function cat21SessionStorageKey(address: string): string {
  throw new Error('not implemented — shapes-only commit');
}

/**
 * Return valid session headers for `address`, signing a fresh
 * session message iff no cached session has > 60 s validity left
 * (grace window: a token that expires mid-flight helps nobody).
 */
export async function getOrCreateCat21Session(args: {
  address: string;
  /** Sign `message` BIP-322 with the taproot key owning `address`; resolve base64 witness. */
  signBip322(message: string): Promise<string>;
  /** Injectable clock for spec determinism. Defaults to Date.now. */
  nowMs?: number;
  /** Injectable storage for spec determinism. Defaults to window.localStorage. */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
}): Promise<Cat21SessionHeaders> {
  throw new Error('not implemented — shapes-only commit');
}

/**
 * Drop the cached session for `address`. Called on any 401 so the
 * next mutation re-signs instead of retrying a dead token.
 */
export function clearCat21Session(
  address: string,
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
): void {
  throw new Error('not implemented — shapes-only commit');
}

/** Exposed for specs: parse + validate a stored session entry. */
export function readCachedCat21Session(
  address: string,
  nowMs: number,
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
): CachedCat21Session | null {
  throw new Error('not implemented — shapes-only commit');
}

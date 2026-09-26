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
import {
  CAT21_SESSION_VALIDITY_MS,
  buildCat21SessionMessage,
  checkSessionValidity,
} from 'ordpool-sdk/core';

import { CachedCat21Session, Cat21SessionHeaders } from './cat21-bazaar.types';

/**
 * Discard a cached token with less than this much validity left —
 * a token that expires mid-flight helps nobody.
 */
const SESSION_GRACE_MS = 60_000;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): StorageLike {
  return window.localStorage;
}

/** Storage key per ordinals address. */
function cat21SessionStorageKey(address: string): string {
  return `cat21-session-${address}`;
}

/** Parse + validate a stored session entry; null on miss/expiry/corrupt. */
function readCachedCat21Session(
  address: string,
  nowMs: number,
  storage: StorageLike
): CachedCat21Session | null {
  const raw = storage.getItem(cat21SessionStorageKey(address));
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const entry = parsed as Partial<CachedCat21Session>;
  if (
    entry.address !== address ||
    typeof entry.validUntilIso !== 'string' ||
    typeof entry.signatureBase64 !== 'string'
  ) {
    return null;
  }
  // Same validity rule the backend applies, plus the grace window so
  // we never send a token that dies before the response comes back.
  if (checkSessionValidity(entry.validUntilIso, nowMs + SESSION_GRACE_MS) !== null) return null;
  return entry as CachedCat21Session;
}

function toHeaders(session: CachedCat21Session): Cat21SessionHeaders {
  return {
    'X-Cat21-Session-Address': session.address,
    'X-Cat21-Session-Valid-Until': session.validUntilIso,
    'X-Cat21-Session-Signature': session.signatureBase64,
  };
}

/**
 * Return valid session headers for `address`, signing a fresh
 * session message iff no cached session has > 60 s validity left.
 */
export async function getOrCreateCat21Session(args: {
  address: string;
  /** Sign `message` BIP-322 with the taproot key owning `address`; resolve base64 witness. */
  signBip322(message: string): Promise<string>;
  /** Injectable clock for spec determinism. Defaults to Date.now. */
  nowMs?: number;
  /** Injectable storage for spec determinism. Defaults to window.localStorage. */
  storage?: StorageLike;
}): Promise<Cat21SessionHeaders> {
  const nowMs = args.nowMs ?? Date.now();
  const storage = args.storage ?? defaultStorage();

  const cached = readCachedCat21Session(args.address, nowMs, storage);
  if (cached) return toHeaders(cached);

  const validUntilIso = new Date(nowMs + CAT21_SESSION_VALIDITY_MS).toISOString();
  const message = buildCat21SessionMessage({ address: args.address, validUntilIso });
  const signatureBase64 = await args.signBip322(message);

  const session: CachedCat21Session = { address: args.address, validUntilIso, signatureBase64 };
  storage.setItem(cat21SessionStorageKey(args.address), JSON.stringify(session));
  return toHeaders(session);
}

/**
 * Drop the cached session for `address`. Called on any 401 so the
 * next mutation re-signs instead of retrying a dead token.
 */
export function clearCat21Session(address: string, storage?: StorageLike): void {
  (storage ?? defaultStorage()).removeItem(cat21SessionStorageKey(address));
}

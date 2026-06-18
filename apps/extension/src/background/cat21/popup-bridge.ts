/**
 * Path 3 (NMH) ⇄ Path 2 (popup) bridge — the chrome.storage.session-
 * backed protocol that lets an external MCP agent's cat21_* call be
 * served by the same popup that serves Path 2's manual flows.
 *
 * Why this exists: Chrome MV3 service workers can be evicted, and the
 * unlocked-keychain state survives only in the popup's React tree
 * (Leather's pattern). The dispatcher cannot sign in the background.
 * Mirroring Leather's `triggerRequestPopupWindowOpen` flow for
 * signPsbt, the NMH listener stashes the inbound intent in
 * `chrome.storage.session`, opens the popup with an opaque
 * `cat21RequestId` URL param, and waits for the popup to message
 * back with the result.
 *
 * The protocol surface is tiny on purpose:
 *
 *   1. Background side
 *      - `stashCat21Request(intent, transport, requestId?)` writes
 *        the intent + transport tag to session storage under
 *        `cat21-request-<requestId>`, returns the URL params the
 *        popup should boot with.
 *      - `routeForIntent(intent)` chooses the matching confirmation
 *        route (mint / transfer / createOffer / acceptOffer).
 *      - Caller (the NMH listener, lands next) opens the popup via
 *        `triggerRequestPopupWindowOpen(route, urlParams)` and
 *        subscribes to the corresponding result-message via the
 *        background's internal-message channel.
 *
 *   2. Popup side
 *      - `fetchCat21Request(requestId)` reads the stashed intent
 *        + transport tag back out of session storage. The popup's
 *        `Cat21ConfirmRoute` reads `cat21RequestId` from URL search
 *        params and calls this helper as a fallback when
 *        `location.state.intent` is empty.
 *      - `clearCat21Request(requestId)` is the cleanup the popup
 *        runs after posting the result back (or on tab close).
 *
 * Request-id uniqueness: a coarse `Date.now() + crypto.randomUUID()`
 * combo. Collisions inside one wallet session are negligible; we
 * scope the storage key by the random part so two parallel agent
 * requests don't clobber each other.
 *
 * Why session storage (not local): `chrome.storage.session` is
 * cleared when the browser session ends and never persisted to disk.
 * Intent payloads can carry PSBT bytes the user has not yet signed;
 * leaking them across sessions or to disk is the wrong default.
 *
 * Testability: every external API (`chrome.storage.session`,
 * `crypto.randomUUID`) is read via a thin shim so specs can stub.
 */
import { RouteUrls } from '@shared/route-urls';

import type { Cat21Transport } from './mode-resolver';
import type { Cat21Intent } from './types';

/**
 * Shape persisted under `cat21-request-<id>` in
 * `chrome.storage.session`. The popup reads this back and reconstructs
 * the dispatcher-equivalent `{ intent, transport }` for
 * `Cat21RpcService`.
 *
 * The transport tag is what tells the popup whether to autoconfirm
 * (`'mcp-nmh'`) or wait for a user click (`'popup'`); the mode
 * resolver further gates whether autonomous signing is permitted.
 */
// HACK -- Cat21: removed `export` (pre-wired for iter 12 NMH listener + popup-side hook; restore on wire-up). HARD RULE #5 — restore on consumer wire-up.
interface Cat21StashedRequest {
  intent: Cat21Intent;
  transport: Cat21Transport;
  /** ms-since-epoch when the stash was written; cleanup uses this. */
  stashedAt: number;
}

/**
 * Minimal storage shim. Production passes the global
 * `chrome.storage.session`; specs pass an in-memory record. We deliberately
 * narrow the shape — only the three calls we use — so the production
 * type doesn't drag the whole `chrome` types into the test runtime.
 */
export interface SessionStorageLike {
  set(items: Record<string, unknown>): Promise<void>;
  get(keys: string | string[]): Promise<Record<string, unknown>>;
  remove(keys: string | string[]): Promise<void>;
}

/**
 * Storage-key format. Includes the opaque random part so two parallel
 * requests don't collide. The popup reads back via the same key.
 */
export function cat21RequestStorageKey(requestId: string): string {
  return `cat21-request-${requestId}`;
}

/**
 * The opaque request-id is generated here and returned to the caller
 * so the background can use the same id when later matching the
 * popup's result-message back to the original NMH request.
 *
 * The popup never sees the NMH-side request-id; only the storage id.
 * The background's NMH listener maintains a map
 * `popupRequestId → nmhRequestId` so it can write the result back
 * over the right NMH port-message id.
 */
// HACK -- Cat21: removed `export` (consumed inline by stashCat21Request; restore if the NMH listener wants the type directly). HARD RULE #5 — restore on consumer wire-up.
interface StashCat21RequestArgs {
  intent: Cat21Intent;
  transport: Cat21Transport;
  storage: SessionStorageLike;
  /** Optional injected id (specs); production calls `crypto.randomUUID`. */
  generateId?(): string;
  /** Optional injected clock (specs); defaults to `Date.now`. */
  now?(): number;
}

// HACK -- Cat21: removed `export` (return type of stashCat21Request; consumers read fields via inference). HARD RULE #5 — restore on consumer wire-up.
interface StashCat21RequestResult {
  /** The popup-side request id; goes into the URL as `cat21RequestId`. */
  requestId: string;
  /** Pre-built search params; pass to `triggerRequestPopupWindowOpen`. */
  urlParams: URLSearchParams;
}

export async function stashCat21Request(
  args: StashCat21RequestArgs
): Promise<StashCat21RequestResult> {
  const generateId = args.generateId ?? (() => crypto.randomUUID());
  const now = args.now ?? (() => Date.now());
  const requestId = generateId();
  const stashed: Cat21StashedRequest = {
    intent: args.intent,
    transport: args.transport,
    stashedAt: now(),
  };
  await args.storage.set({ [cat21RequestStorageKey(requestId)]: stashed });
  const urlParams = new URLSearchParams();
  urlParams.set('cat21RequestId', requestId);
  return { requestId, urlParams };
}

/**
 * Read back the stashed intent. The popup calls this from
 * `Cat21ConfirmRoute` when the URL carries a `cat21RequestId` query
 * param. Returns `null` when the key is missing — most often because
 * the wallet was restarted between popup-open and popup-load; the
 * route surfaces that as "request expired" rather than a crash.
 */
export async function fetchCat21Request(
  storage: SessionStorageLike,
  requestId: string
): Promise<Cat21StashedRequest | null> {
  const key = cat21RequestStorageKey(requestId);
  const result = await storage.get(key);
  const found = result[key];
  if (!found) return null;
  return found as Cat21StashedRequest;
}

export async function clearCat21Request(
  storage: SessionStorageLike,
  requestId: string
): Promise<void> {
  await storage.remove(cat21RequestStorageKey(requestId));
}

/**
 * Maps the inbound NMH method name to the corresponding Cat21 popup
 * confirmation route. Each one points at the same `Cat21ConfirmRoute`
 * container (registered four times in `app-routes.tsx`); the distinct
 * URLs exist only so an open popup can be visually identified by its
 * URL bar during dev.
 *
 * Throws on an unknown method — the NMH dispatcher checks the type
 * union upstream, but this is the second-line defence: a future MCP
 * tool the host adds (`cat21_burn`?) without updating this map would
 * crash here rather than silently navigating to the wrong popup.
 */
export function routeForCat21IntentType(
  intentType: 'cat21_mint' | 'cat21_transfer' | 'cat21_create_offer' | 'cat21_accept_offer'
): RouteUrls {
  switch (intentType) {
    case 'cat21_mint':
      return RouteUrls.Cat21MintConfirm;
    case 'cat21_transfer':
      return RouteUrls.Cat21TransferConfirm;
    case 'cat21_create_offer':
      return RouteUrls.Cat21CreateOfferConfirm;
    case 'cat21_accept_offer':
      return RouteUrls.Cat21AcceptOfferConfirm;
    default: {
      const exhaustive: never = intentType;
      throw new Error(`routeForCat21IntentType: unknown type ${String(exhaustive)}`);
    }
  }
}

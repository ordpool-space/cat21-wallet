/**
 * Bridges an inbound NMH cat21_* mutating request into the popup-side
 * Cat21RpcService that actually owns the keychain. Replaces the
 * iter-9 direct-dispatch path (`attachNativeHostToDispatcher`)
 * everywhere a real signing operation is required.
 *
 * Lifecycle of one cat21_* call from an MCP agent:
 *
 *   1. agent sends `{ id, type: 'cat21_*', payload: <intent> }` over
 *      the NMH connectNative port
 *   2. background's NMH listener calls `relayNmhMessageThroughPopup`
 *      (this module). It:
 *        a. stashes the intent in chrome.storage.session via
 *           `stashCat21Request`, getting back a `requestId` +
 *           `urlParams`
 *        b. calls the injected `triggerPopupOpen(route, urlParams)`
 *           (production wires `triggerRequestPopupWindowOpen` from
 *           `background/messaging/rpc-request-utils.ts`)
 *        c. awaits `waitForPopupResult(requestId)` — the listener for
 *           chrome.runtime messages carrying the popup's
 *           Cat21RpcResult (wired in iter 12d's background message
 *           handler)
 *        d. posts the result back over the NMH port with the
 *           agent-side `id` so the MCP host can resolve its pending
 *           promise
 *        e. clears the storage entry
 *
 * Why every step is dependency-injected: the production callbacks
 * (`triggerRequestPopupWindowOpen`, the chrome.runtime listener,
 * `chrome.storage.session`) all need a Chrome-extension environment.
 * Specs pass in-memory equivalents; without the seams every test
 * would have to monkey-patch the global `chrome` object.
 *
 * Error handling: any throw from the inner pipeline (popup open
 * fails, popup never replies, storage error) bubbles back to the
 * caller of `relayNmhMessageThroughPopup`, which is responsible for
 * posting an error reply over the NMH port (the listener wire-up in
 * `attachNativeHostToPopupRelay` does that translation).
 */
import { type RouteUrls } from '@shared/route-urls';

import {
  type SessionStorageLike,
  clearCat21Request,
  routeForCat21IntentType,
  stashCat21Request,
} from './popup-bridge';
import type { Cat21RpcResult } from './types';

/**
 * The four NMH mutating request types we relay. Mirrors
 * `Cat21DispatcherMessage['type']` from `cat21-dispatcher.ts`.
 */
// HACK -- Cat21: removed `export` (used as the parameter shape; consumers read fields via inference). HARD RULE #5 — restore on broader use.
interface RelayableNmhRequest {
  id: string;
  type: 'cat21_mint' | 'cat21_transfer' | 'cat21_create_offer' | 'cat21_accept_offer';
  payload: import('./types').Cat21Intent;
}

/**
 * The minimal NMH port surface this module touches — only
 * `postMessage`. Defined locally so tests can use the same
 * in-memory fake as `connect-native-host.spec.ts`.
 */
// HACK -- Cat21: removed `export` (internal port-fake contract). HARD RULE #5.
interface NmhPortPostMessage {
  postMessage(message: unknown): void;
}

/**
 * Signatures of the three Chrome-runtime-touching callbacks the
 * background needs to wire. Specs inject in-memory stand-ins.
 *
 *   - `triggerPopupOpen`: production = `triggerRequestPopupWindowOpen`
 *     from `background/messaging/rpc-request-utils.ts`.
 *   - `waitForPopupResult`: production = a one-shot subscription on
 *     `chrome.runtime.onMessage` filtered by `requestId`. Returns
 *     the `Cat21RpcResult` the popup posted.
 *   - `storage`: production = `chrome.storage.session` adapted to
 *     `SessionStorageLike` (same adapter the popup uses).
 */
// HACK -- Cat21: removed `export` (caller passes inline; restore on broader use). HARD RULE #5.
interface RelayNmhMessageDeps {
  storage: SessionStorageLike;
  triggerPopupOpen(route: RouteUrls, urlParams: URLSearchParams): Promise<void>;
  waitForPopupResult(requestId: string): Promise<Cat21RpcResult>;
}

/**
 * One cat21_* roundtrip. Caller-side error handling: any throw
 * bubbles up so the NMH listener can ship an error reply back over
 * the port. The storage entry is cleared in a `finally` so a popup
 * crash doesn't leak intents.
 */
export async function relayNmhMessageThroughPopup(
  msg: RelayableNmhRequest,
  port: NmhPortPostMessage,
  deps: RelayNmhMessageDeps
): Promise<void> {
  const { requestId, urlParams } = await stashCat21Request({
    intent: msg.payload,
    transport: 'mcp-nmh',
    storage: deps.storage,
  });
  try {
    await deps.triggerPopupOpen(routeForCat21IntentType(msg.type), urlParams);
    const result = await deps.waitForPopupResult(requestId);
    port.postMessage({
      type: `${msg.type}:result`,
      id: msg.id,
      payload: result,
    });
  } finally {
    await clearCat21Request(deps.storage, requestId);
  }
}

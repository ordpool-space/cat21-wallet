/**
 * Path 3 background entrypoint — listens on the NMH port and relays
 * every cat21_* mutating request through the popup-side
 * `Cat21RpcService`. Replaces the iter-9 `attachNativeHostToDispatcher`
 * everywhere a signing operation is required.
 *
 * Wires the three Chrome-runtime callbacks `relayNmhMessageThroughPopup`
 * needs:
 *
 *   - `storage` → `chrome.storage.session` adapted to `SessionStorageLike`
 *   - `triggerPopupOpen` → Leather's `triggerRequestPopupWindowOpen`
 *     from `background/messaging/rpc-request-utils.ts`
 *   - `waitForPopupResult` → `subscribeToCat21Result` against
 *     `chrome.runtime.onMessage`
 *
 * For dispatch, the function validates the inbound message shape
 * inline (same predicate as the iter-9 attach) — a non-cat21_*
 * envelope is silently dropped (the MCP host answers read-only
 * queries on its own).
 *
 * Error reply: any throw from the relay bubbles up here and is
 * translated into a typed denied result over the NMH port so the
 * agent learns the call failed rather than hanging.
 */
import { type RouteUrls } from '@shared/route-urls';

import { subscribeToCat21Result } from './cat21-result-bus';
import { type NativeHostPortLike } from './connect-native-host';
import { relayNmhMessageThroughPopup } from './nmh-popup-relay';
import { handleReadOnlyProbe, isReadOnlyProbeRequest } from './nmh-read-only-probes';
import { type SessionStorageLike } from './popup-bridge';
import type { Cat21Intent, Cat21RpcResult } from './types';

/**
 * Inbound MCP-host envelope. Same predicate as `connect-native-host.ts`
 * uses; kept here so the relay-attach is self-contained and the
 * iter-9 path can be retired in one delete.
 */
interface NmhMutatingRequest {
  type: 'cat21_mint' | 'cat21_transfer' | 'cat21_create_offer' | 'cat21_accept_offer';
  id: string;
  payload: Cat21Intent;
}

function isNmhMutatingRequest(msg: unknown): msg is NmhMutatingRequest {
  if (typeof msg !== 'object' || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return (
    (m.type === 'cat21_mint' ||
      m.type === 'cat21_transfer' ||
      m.type === 'cat21_create_offer' ||
      m.type === 'cat21_accept_offer') &&
    typeof m.id === 'string' &&
    typeof m.payload === 'object' &&
    m.payload !== null
  );
}

/**
 * Production wires:
 *
 *   - `storage`: thin adapter around `chrome.storage.session`
 *   - `triggerPopupOpen`: `triggerRequestPopupWindowOpen` (must
 *     match the type `(RouteUrls, URLSearchParams) => Promise<...>`
 *     — the relay only awaits the call, doesn't read the return)
 *   - `onMessage`: `chrome.runtime.onMessage` (the
 *     {addListener, removeListener} pair `subscribeToCat21Result`
 *     needs)
 */
/**
 * Read-only probe deps (iter 14): `list_cats` / `wallet_status` /
 * `cat21_ord_status` are answered inline by the background without
 * involving the popup. The handler is dependency-injected on these
 * three callbacks so specs drive the round-trip with in-memory
 * stand-ins; production wires:
 *
 *   - `listCatsAtActiveAccount` = cat21-ord
 *     `/address/{activeAccountAddress}` via getCat21OrdApiClient
 *   - `readWalletStatus`        = Redux getState snapshot
 *   - `readCat21OrdStatus`      = cat21-ord `/status`
 *
 * If a future read-only probe (`validate_intent` dry-run, etc.) lands,
 * it adds a method to this deps object plus a case in
 * `handleReadOnlyProbe` — the route shape here doesn't change.
 */
interface ReadOnlyProbeWires {
  listCatsAtActiveAccount(): Promise<string[]>;
  readWalletStatus(): {
    network: 'mainnet' | 'testnet';
    accountId: string;
    agentMode: { enabled: boolean };
  };
  readCat21OrdStatus(): Promise<{ reachable: boolean; height?: number; cats?: number }>;
}

interface AttachArgs {
  port: NativeHostPortLike;
  storage: SessionStorageLike;
  triggerPopupOpen(route: RouteUrls, urlParams: URLSearchParams): Promise<unknown>;
  onMessage: {
    addListener(listener: (msg: unknown) => void): void;
    removeListener(listener: (msg: unknown) => void): void;
  };
  readOnlyProbes: ReadOnlyProbeWires;
}

export function attachNativeHostToPopupRelay(args: AttachArgs): void {
  args.port.onMessage.addListener(msg => {
    // Route 1 — read-only probe (list_cats / wallet_status /
    // cat21_ord_status). No popup, no keychain, just a one-shot
    // reply over the port. The probe handler catches its own
    // throws and encodes them inline on the payload.
    if (isReadOnlyProbeRequest(msg)) {
      void (async () => {
        const reply = await handleReadOnlyProbe(msg, args.readOnlyProbes);
        args.port.postMessage({ ...reply, id: msg.id });
      })();
      return;
    }
    if (!isNmhMutatingRequest(msg)) {
      // Not a cat21_* mutating call and not a known read-only probe
      // — silently ignore. Future probes / mutating methods that
      // need wallet involvement get a branch here.
      return;
    }
    void (async () => {
      try {
        await relayNmhMessageThroughPopup(msg, args.port, {
          storage: args.storage,
          triggerPopupOpen: async (route, urlParams) => {
            await args.triggerPopupOpen(route, urlParams);
          },
          waitForPopupResult: requestId => subscribeToCat21Result(args.onMessage, requestId),
        });
      } catch (err) {
        // Translate any thrown error into a typed denial so the agent
        // sees a result rather than a hang. The reason string deliberately
        // uses the existing `broadcast-failed` union member so MCP
        // clients don't have to learn a new shape; `detail` carries the
        // human-readable text.
        const denied: Cat21RpcResult = {
          ok: false,
          value: {
            reason: 'broadcast-failed',
            detail: `relay-error: ${err instanceof Error ? err.message : String(err)}`,
          },
        };
        args.port.postMessage({
          type: `${msg.type}:result`,
          id: msg.id,
          payload: denied,
        });
      }
    })();
  });
}

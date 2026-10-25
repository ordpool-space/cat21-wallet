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
  type: 'cat21_mint' | 'cat21_transfer' | 'cat21_create_offer' | 'cat21_accept_offer' | 'cat21_buy';
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
      m.type === 'cat21_accept_offer' ||
      m.type === 'cat21_buy') &&
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
    addListener(
      listener: (msg: unknown, sender?: { id?: string; tab?: unknown; url?: string }) => void
    ): void;
    removeListener(
      listener: (msg: unknown, sender?: { id?: string; tab?: unknown; url?: string }) => void
    ): void;
  };
  readOnlyProbes: ReadOnlyProbeWires;
  /**
   * Integrity check on every cat21-result-bus message. Production
   * closes over `chrome.runtime.id` and asserts the sender is one of
   * our own extension pages (`sender.id === chrome.runtime.id` AND
   * `sender.tab === undefined`). Without this check, any extension
   * page or co-resident extension that learns the `requestId` could
   * inject a forged `result` and the relay would propagate the fake
   * reply to the MCP agent.
   */
  verifyResultBusSender(sender: { id?: string; tab?: unknown; url?: string } | undefined): boolean;
}

/**
 * Upper bound on a QUEUED (autonomous) round-trip. Past this it is treated as
 * an abandoned popup (crashed or killed, never posting a result), the
 * serialization queue is freed, and the agent gets a typed denial instead of a
 * stuck queue. Set above the MCP host's own 60s `MUTATION_TIMEOUT_MS` so it
 * never preempts a round-trip the host still legitimately awaits. Only
 * autonomous requests are bounded: they auto-confirm and never wait for a
 * human, so a timeout here means a genuine stall, never a slow human whose real
 * broadcast would then be mis-reported as failed.
 */
const RELAY_AUTONOMOUS_ROUNDTRIP_TIMEOUT_MS = 120_000;

function relayDeps(args: AttachArgs) {
  return {
    storage: args.storage,
    triggerPopupOpen: async (route: RouteUrls, urlParams: URLSearchParams) => {
      await args.triggerPopupOpen(route, urlParams);
    },
    waitForPopupResult: (requestId: string) =>
      subscribeToCat21Result(args.onMessage, requestId, args.verifyResultBusSender),
  };
}

/**
 * One mutating round-trip that NEVER rejects, so it is safe to chain onto the
 * autonomous serialization queue. A throw (or, when `bounded`, the timeout)
 * becomes a typed `broadcast-failed` denial over the port — the agent sees a
 * result rather than a hang, and the queue advances.
 */
async function relayOneMutatingRequest(
  msg: NmhMutatingRequest,
  args: AttachArgs,
  bounded: boolean
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const roundTrip = relayNmhMessageThroughPopup(msg, args.port, relayDeps(args));
    if (!bounded) {
      await roundTrip;
      return;
    }
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(new Error(`relay round-trip exceeded ${RELAY_AUTONOMOUS_ROUNDTRIP_TIMEOUT_MS}ms`)),
        RELAY_AUTONOMOUS_ROUNDTRIP_TIMEOUT_MS
      );
    });
    await Promise.race([roundTrip, timeout]);
  } catch (err) {
    const denied: Cat21RpcResult = {
      ok: false,
      value: {
        reason: 'broadcast-failed',
        detail: `relay-error: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
    try {
      args.port.postMessage({ type: `${msg.type}:result`, id: msg.id, payload: denied });
    } catch {
      // The NMH port is gone (a disconnected port throws synchronously on
      // postMessage). There is no one to deliver to; swallow it so this
      // function keeps its never-reject contract and a dead port cannot
      // poison the autonomous serialization queue for later requests.
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function attachNativeHostToPopupRelay(args: AttachArgs): void {
  // Autonomous mutating round-trips are drained one at a time. The per-account
  // daily-spend cap is checked in the popup against a persisted `spentToday`
  // snapshot and recorded only after broadcast, so two concurrent autonomous
  // popups would both read a stale snapshot and could jointly breach the cap
  // (HARD RULE #12). The background is the single point every Path-3 call
  // passes through and is single-threaded, so serializing here closes that
  // window at the source. Only `mode: 'autonomous'` requests are queued: they
  // auto-confirm and reliably post a result, so the queue never
  // head-of-line-blocks on a human. Manual (human-confirmed) NMH requests and
  // read-only probes stay concurrent — a human cannot rapid-fire concurrent
  // approvals, and a timeout on a human-paced popup could mis-report a real
  // broadcast as failed.
  let autonomousQueue: Promise<void> = Promise.resolve();

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
    if (msg.payload.mode === 'autonomous') {
      // `relayOneMutatingRequest` is written to never reject; the trailing
      // `.catch` is defence in depth so no unforeseen rejection can poison the
      // chain and silently drop every later autonomous request.
      autonomousQueue = autonomousQueue
        .then(() => relayOneMutatingRequest(msg, args, true))
        .catch(() => undefined);
      return;
    }
    void relayOneMutatingRequest(msg, args, false);
  });
}

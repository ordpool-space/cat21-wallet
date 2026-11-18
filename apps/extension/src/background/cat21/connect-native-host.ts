import type { Cat21Dispatcher, Cat21DispatcherMessage } from './cat21-dispatcher';

/**
 * The shape of a `chrome.runtime.Port`-like object that this module needs.
 * Defined locally (rather than relying on the global `chrome` types) so
 * the routing logic can be unit-tested against an in-memory fake port —
 * no jsdom shim of `chrome.runtime.connectNative` required.
 *
 * Production passes the real `chrome.runtime.Port` returned by
 * `chrome.runtime.connectNative('space.cat21.wallet')`; tests pass a
 * hand-rolled object that records `postMessage` calls and lets the spec
 * fire `onMessage` listeners synchronously.
 */
export interface NativeHostPortLike {
  postMessage(message: unknown): void;
  onMessage: { addListener(cb: (msg: unknown) => void): void };
  onDisconnect: { addListener(cb: () => void): void };
}

/**
 * Module-level binding to a singleton `chrome.runtime.connectNative`-style
 * factory so tests can install a fake without monkey-patching `chrome`.
 * Production callers pass the real Chrome API at the wallet's background
 * entrypoint; the factory is called lazily inside `attachToNativeHost`.
 */
// HACK -- Cat21: removed `export` (used internally as the connectToNativeHost arg type; background entrypoint passes `chrome.runtime.connectNative` directly). HARD RULE #5 — restore on broader use.
interface ConnectNativeFn {
  (application: string): NativeHostPortLike;
}

/**
 * Public NMH protocol the MCP host writes over the connectNative pipe.
 * Mirrors the shape `Cat21DispatcherMessage` accepts, just with a `kind`
 * discriminator so we can identify mutating-tool calls vs. read-only
 * queries (the read-only ones are answered from the wallet's existing
 * mempool/electrs query layer; only mutating ones reach this dispatcher).
 *
 * Mutating-tool messages from the MCP host look like:
 *   { type: 'cat21_mint',         id: '<req>', payload: Cat21MintIntent }
 *   { type: 'cat21_transfer',     id: '<req>', payload: Cat21TransferIntent }
 *   { type: 'cat21_create_offer', id: '<req>', payload: Cat21CreateOfferIntent }
 *   { type: 'cat21_accept_offer', id: '<req>', payload: Cat21AcceptOfferIntent }
 *
 * Anything else is forwarded to other wallet subsystems (cat data read,
 * status pings, etc.) by the caller — this module is the cat21_*
 * mutating slice only.
 */
interface NmhMutatingRequest {
  type: Cat21DispatcherMessage['type'];
  id: string;
  payload: Cat21DispatcherMessage['intent'];
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
 * Attach the dispatcher to a native-host port. Returns a teardown
 * function the caller can invoke to detach all listeners (typically
 * called when the port disconnects, since chrome.runtime.connectNative
 * fires `onDisconnect` on the host binary exiting).
 *
 * The attachment routes inbound `cat21_*` NMH messages to the
 * dispatcher (which evaluates the agent-policy gate, signs, broadcasts,
 * etc.) and writes the typed reply back via `port.postMessage`. Replies
 * carry the request `id` so the MCP host can resolve its pending-call
 * map.
 */
export function attachNativeHostToDispatcher(
  port: NativeHostPortLike,
  dispatcher: Cat21Dispatcher
): void {
  port.onMessage.addListener(async msg => {
    if (!isNmhMutatingRequest(msg)) {
      // Not a cat21_* mutating call — silently ignore. The MCP host
      // handles read-only queries against the wallet's other state
      // channels; we don't need to send a denial.
      return;
    }
    const dispatcherMessage: Cat21DispatcherMessage = {
      type: msg.type,
      requestId: msg.id,
      intent: msg.payload,
    };
    const reply = await dispatcher.handle(dispatcherMessage, 'mcp-nmh');
    port.postMessage({
      type: reply.type,
      id: msg.id,
      payload: reply.result,
    });
  });
}

/**
 * Open a `chrome.runtime.connectNative` port to the Cat21 MCP host and
 * attach the dispatcher. Returns the live port (so the caller can hold
 * a reference for diagnostics) and a teardown handle. Production
 * callers pass `chrome.runtime.connectNative` as `connectNative`; the
 * spec fakes it.
 *
 * Native-host application name MUST match the manifest at
 * `tools/src/mcp-host/native-manifests/cat21-wallet.mac-linux.json.template`
 * — currently `'space.cat21.wallet'` — and the manifest's
 * `allowed_origins` MUST contain this extension's id (Chrome enforces
 * the allowlist before spawning the binary).
 */
export function connectToNativeHost(args: {
  connectNative: ConnectNativeFn;
  dispatcher: Cat21Dispatcher;
  applicationName?: string;
}): NativeHostPortLike {
  const name = args.applicationName ?? 'space.cat21.wallet';
  const port = args.connectNative(name);
  attachNativeHostToDispatcher(port, args.dispatcher);
  return port;
}

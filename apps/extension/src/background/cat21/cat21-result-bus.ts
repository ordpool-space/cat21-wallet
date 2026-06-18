/**
 * Two halves of the cat21_* result channel:
 *
 *   Popup side (`postCat21Result`) — when `Cat21ConfirmRoute`
 *     finishes running the rpc service for a request that came in
 *     via the NMH bridge (URL carried `cat21RequestId`), it shouts
 *     the result via `chrome.runtime.sendMessage` with a tagged
 *     envelope.
 *
 *   Background side (`subscribeToCat21Result`) — the NMH relay
 *     (`nmh-popup-relay.ts → relayNmhMessageThroughPopup`) awaits
 *     this. It returns a Promise that resolves on the first matching
 *     envelope and tears down the listener.
 *
 * Why a tagged envelope rather than chrome.runtime.connect ports:
 * the popup opens fresh per request, the NMH relay opens its
 * waiter before that — using a port would force a handshake. A
 * one-shot `sendMessage` from the popup is single-step and
 * matches Leather's finalize-* messaging pattern.
 *
 * Envelope shape:
 *
 *   {
 *     source: 'cat21-result-bus',
 *     requestId: '<the popup-side request id>',
 *     result: Cat21RpcResult
 *   }
 *
 * The `source` tag is the second-line defence against unrelated
 * `chrome.runtime` traffic colliding (the wallet sends many other
 * internal messages). The listener ignores anything else.
 *
 * Both halves are dependency-injected on their Chrome surfaces so
 * specs drive the round-trip with in-memory fakes.
 */
import type { Cat21RpcResult } from './types';

/**
 * Envelope written by the popup, read by the background. Inline-typed
 * because consumers either dispatch on `source` (background) or
 * construct it once (popup) — the type doesn't need to be exported.
 */
const CAT21_RESULT_BUS_SOURCE = 'cat21-result-bus' as const;

/**
 * Minimal `chrome.runtime.sendMessage` shape — only the call we make.
 * Production passes `(msg) => chrome.runtime.sendMessage(msg)`. Specs
 * pass an in-memory fanout that the matching `RuntimeOnMessageLike`
 * subscriber pulls from.
 */
// HACK -- Cat21: removed `export` (internal seam — caller wires inline). HARD RULE #5.
type RuntimeSendMessageLike = (msg: unknown) => Promise<void>;

/**
 * Minimal `chrome.runtime.onMessage` shape — `addListener` /
 * `removeListener`. Production passes
 * `{ addListener: chrome.runtime.onMessage.addListener.bind(chrome.runtime.onMessage), removeListener: ... }`.
 */
// HACK -- Cat21: removed `export` (internal seam — caller wires inline). HARD RULE #5.
interface RuntimeOnMessageLike {
  addListener(listener: (msg: unknown) => void): void;
  removeListener(listener: (msg: unknown) => void): void;
}

/**
 * Popup → background. Resolves once `sendMessage` returns; the
 * background's listener is fire-and-forget from the popup's
 * perspective. If sendMessage rejects (eg. background unresponsive),
 * caller decides what to do — typically the popup just navigates
 * back; the NMH-side caller times out separately.
 */
export async function postCat21Result(
  sendMessage: RuntimeSendMessageLike,
  requestId: string,
  result: Cat21RpcResult
): Promise<void> {
  await sendMessage({
    source: CAT21_RESULT_BUS_SOURCE,
    requestId,
    result,
  });
}

/**
 * Background-side waiter. Returns a Promise that resolves when the
 * first envelope with the matching `requestId` arrives, and removes
 * the listener afterwards (no leak). The caller can race this against
 * a timeout or a popup-closed event for hardening; this module
 * stays minimal.
 */
export function subscribeToCat21Result(
  onMessage: RuntimeOnMessageLike,
  requestId: string
): Promise<Cat21RpcResult> {
  return new Promise<Cat21RpcResult>(resolve => {
    function listener(msg: unknown) {
      if (typeof msg !== 'object' || msg === null) return;
      const m = msg as Record<string, unknown>;
      if (m.source !== CAT21_RESULT_BUS_SOURCE) return;
      if (m.requestId !== requestId) return;
      onMessage.removeListener(listener);
      resolve(m.result as Cat21RpcResult);
    }
    onMessage.addListener(listener);
  });
}

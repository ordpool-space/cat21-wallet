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
 *
 * The 2-arg listener form mirrors Chrome's real signature; the
 * second arg is `chrome.runtime.MessageSender` (or a spec fake).
 * Subscribers can use it for sender verification — see
 * `subscribeToCat21Result`'s `verifySender` arg.
 */
// HACK -- Cat21: removed `export` (internal seam — caller wires inline). HARD RULE #5.
interface RuntimeOnMessageLike {
  addListener(listener: (msg: unknown, sender?: SenderLike) => void): void;
  removeListener(listener: (msg: unknown, sender?: SenderLike) => void): void;
}

/**
 * Narrow shape of `chrome.runtime.MessageSender` — only the fields we
 * actually inspect for the same-extension-page integrity check.
 *
 * - `id`: extension id of the SENDING extension. For a message sent
 *   from one of OUR own extension pages via `chrome.runtime.sendMessage`,
 *   this equals `chrome.runtime.id`. For a message sent from a
 *   *different* extension, this is that other extension's id.
 * - `tab`: defined ONLY when the sender is a content script running
 *   in a tab. Our popup is an extension page (not a content script),
 *   so a legitimate cat21-result-bus message has `tab === undefined`.
 * - `url`: the sender page's URL. For our popup this starts with
 *   `chrome-extension://<our-id>/index.html`. For a content script
 *   on a dapp page, this would be the dapp's `https://...` URL.
 */
export interface SenderLike {
  id?: string;
  tab?: unknown;
  url?: string;
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
 * first envelope with the matching `requestId` arrives AND passes
 * the `verifySender` integrity check, and removes the listener
 * afterwards (no leak). The caller can race this against a timeout
 * or a popup-closed event for hardening; this module stays minimal.
 *
 * **`verifySender` is the load-bearing integrity check.** Without
 * it, any extension page or co-resident extension that knows the
 * `requestId` can inject a forged `result` envelope and the NMH
 * relay forwards the fake reply to the agent. With it, the listener
 * rejects messages whose sender isn't our own extension's popup
 * page.
 *
 * Production wires it via
 *
 *   ```ts
 *   subscribeToCat21Result(onMessage, requestId, sender =>
 *     sender?.id === chrome.runtime.id && sender?.tab === undefined
 *   )
 *   ```
 *
 * Specs pass `() => true` when they don't care about sender, or a
 * custom predicate when they want to exercise rejection paths.
 */
export function subscribeToCat21Result(
  onMessage: RuntimeOnMessageLike,
  requestId: string,
  verifySender: (sender: SenderLike | undefined) => boolean
): Promise<Cat21RpcResult> {
  return new Promise<Cat21RpcResult>(resolve => {
    function listener(msg: unknown, sender?: SenderLike) {
      if (!verifySender(sender)) return;
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

import type { Cat21Dispatcher, Cat21DispatcherMessage } from './cat21-dispatcher';

/**
 * Background-side counterpart of `dispatchCat21Intent`. Listens on
 * `chrome.runtime.onMessage` for the popup → background envelope and
 * routes through the supplied `Cat21Dispatcher`.
 *
 * Message envelope (from `dispatch-cat21-intent.ts`):
 *
 *   { kind: 'cat21-dispatch',
 *     type: 'cat21_mint' | 'cat21_transfer' | 'cat21_create_offer' |
 *           'cat21_accept_offer',
 *     requestId: <uuid>,
 *     intent: <Cat21Intent> }
 *
 * Reply envelope (back over `sendResponse`):
 *
 *   { kind: 'cat21-dispatch:result',
 *     requestId: <same uuid>,
 *     result: Cat21RpcResult }
 *
 * The listener is added in addition to the existing wallet message
 * handlers (Leather's `internalBackgroundMessageHandler` etc.).
 * Messages whose `kind` isn't `'cat21-dispatch'` fall through to the
 * other handlers untouched.
 *
 * Transport is `'popup'` for this path — the popup is Path 2 (manual)
 * by definition. Path 3 (autonomous / MCP-host) reaches the dispatcher
 * via the connectNative bridge in `connect-native-host.ts` instead.
 */

/**
 * Minimum `chrome.runtime` surface this module touches. Defined
 * locally so the spec can pass an in-memory fake instead of mocking
 * the global `chrome` object.
 */
export interface ChromeRuntimeOnMessageLike {
  onMessage: {
    addListener(
      cb: (
        message: unknown,
        sender: unknown,
        sendResponse: (response: unknown) => void
      ) => boolean | void
    ): void;
  };
}

interface Cat21DispatchEnvelope {
  kind: 'cat21-dispatch';
  type: Cat21DispatcherMessage['type'];
  requestId: string;
  intent: Cat21DispatcherMessage['intent'];
}

function isCat21DispatchEnvelope(msg: unknown): msg is Cat21DispatchEnvelope {
  if (typeof msg !== 'object' || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return (
    m.kind === 'cat21-dispatch' &&
    (m.type === 'cat21_mint' ||
      m.type === 'cat21_transfer' ||
      m.type === 'cat21_create_offer' ||
      m.type === 'cat21_accept_offer') &&
    typeof m.requestId === 'string' &&
    typeof m.intent === 'object' &&
    m.intent !== null
  );
}

/**
 * Install the listener. `getDispatcher` is a thunk (rather than the
 * dispatcher itself) so the caller can defer dispatcher construction
 * until the store has rehydrated. The thunk is called fresh on each
 * incoming message, so a future account switch that rebuilds the
 * dispatcher takes effect on the next message without re-installing
 * the listener.
 *
 * Returns nothing — chrome's listener registry is the source of truth.
 * Chrome auto-cleans listeners when the service worker is torn down.
 */
export function installCat21DispatchListener(args: {
  chromeApi: ChromeRuntimeOnMessageLike;
  getDispatcher(): Cat21Dispatcher;
}): void {
  args.chromeApi.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isCat21DispatchEnvelope(message)) {
      // Not our envelope — let other listeners handle it.
      return undefined;
    }

    // Promise-returning handler. Chrome's async-response contract
    // requires `return true` AND `sendResponse` called later (or the
    // listener becomes a "no response" error in the caller).
    const dispatcherMessage: Cat21DispatcherMessage = {
      type: message.type,
      requestId: message.requestId,
      intent: message.intent,
    };
    args
      .getDispatcher()
      .handle(dispatcherMessage, 'popup')
      .then(reply => {
        sendResponse({
          kind: 'cat21-dispatch:result',
          requestId: message.requestId,
          result: reply.result,
        });
      })
      .catch(err => {
        // Defensive: dispatcher.handle should never throw (it
        // catches into typed denials internally), but a bug-level
        // exception MUST still produce a reply so the popup doesn't
        // hang on a never-resolving promise.
        sendResponse({
          kind: 'cat21-dispatch:result',
          requestId: message.requestId,
          result: {
            ok: false as const,
            value: {
              reason: 'broadcast-failed',
              detail: err instanceof Error ? err.message : String(err),
            },
          },
        });
      });

    // `true` keeps the message channel open until sendResponse fires.
    return true;
  });
}

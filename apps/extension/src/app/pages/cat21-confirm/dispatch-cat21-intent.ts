import type { Cat21Intent } from '@background/cat21/types';

/**
 * Bridge from the popup UI to the background-side `Cat21Dispatcher`.
 *
 * Sends a `chrome.runtime.sendMessage` (extension-internal channel,
 * NOT cross-extension or NMH) and awaits the typed reply. The
 * background script's listener routes the message into
 * `wireCat21Dispatcher` and posts the result back; this helper is the
 * one-way-trip caller.
 *
 * Message envelope:
 *
 *   { kind: 'cat21-dispatch',
 *     type: 'cat21_mint' | 'cat21_transfer' | 'cat21_create_offer' |
 *           'cat21_accept_offer',
 *     requestId: <uuid>,
 *     intent: <Cat21Intent> }
 *
 * Reply envelope:
 *
 *   { kind: 'cat21-dispatch:result',
 *     requestId: <same uuid>,
 *     result: Cat21RpcResult }
 *
 * The popup-side container uses the reply's `result.ok` to decide:
 *   - ok: navigate(-1) to dismiss the popup
 *   - !ok: surface result.value.reason via the dialog's submitError
 *
 * `chromeApi` is injected so the spec can drive the message round-trip
 * with an in-memory fake. Production passes the `chrome` global.
 */

// HACK -- Cat21: removed `export` (return type of dispatchCat21Intent; consumer infers it). HARD RULE #5 — restore if a typed import is needed.
interface DispatchCat21IntentResult {
  ok: boolean;
  /** Set on !ok. Carries the rpc-deny reason for surfacing in the dialog. */
  errorMessage: string | null;
}

/** @knipignore -- HACK Cat21: consumed by dispatch-cat21-intent.spec.ts which knip treats as a non-consumer. */
export interface ChromeRuntimeLike {
  sendMessage<TReply>(message: unknown): Promise<TReply>;
}

interface Cat21DispatchEnvelope {
  kind: 'cat21-dispatch';
  type: 'cat21_mint' | 'cat21_transfer' | 'cat21_create_offer' | 'cat21_accept_offer';
  requestId: string;
  intent: Cat21Intent;
}

interface Cat21DispatchReply {
  kind: 'cat21-dispatch:result';
  requestId: string;
  result:
    | { ok: true; value: { kind: 'broadcast'; txid: string; channel: 'mempool' | 'slipstream' } }
    | { ok: true; value: { kind: 'listing'; listing: unknown } }
    | { ok: false; value: { reason: string; detail?: string } };
}

function detectIntentType(intent: Cat21Intent): Cat21DispatchEnvelope['type'] {
  if ('priceSats' in intent) return 'cat21_create_offer';
  if ('offerPsbt' in intent) return 'cat21_accept_offer';
  if ('catId' in intent) return 'cat21_transfer';
  return 'cat21_mint';
}

/**
 * Send the intent to the background dispatcher and translate the reply
 * to the shape the dialog container consumes. Network/IPC failures and
 * malformed replies become an `errorMessage`; the dialog stays open so
 * the user can retry.
 */
export async function dispatchCat21Intent(args: {
  chromeApi: ChromeRuntimeLike;
  intent: Cat21Intent;
  /** Stable identifier so the background can correlate; tests pin it. */
  requestId: string;
}): Promise<DispatchCat21IntentResult> {
  const envelope: Cat21DispatchEnvelope = {
    kind: 'cat21-dispatch',
    type: detectIntentType(args.intent),
    requestId: args.requestId,
    intent: args.intent,
  };

  let reply: Cat21DispatchReply;
  try {
    reply = await args.chromeApi.sendMessage<Cat21DispatchReply>(envelope);
  } catch (err) {
    return {
      ok: false,
      errorMessage: `Background channel failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (
    typeof reply !== 'object' ||
    reply === null ||
    reply.kind !== 'cat21-dispatch:result' ||
    reply.requestId !== args.requestId
  ) {
    return {
      ok: false,
      errorMessage: 'Malformed reply from background.',
    };
  }

  if (reply.result.ok === true) {
    return { ok: true, errorMessage: null };
  }

  const { reason, detail } = reply.result.value;
  return {
    ok: false,
    errorMessage: detail ? `${reason}: ${detail}` : reason,
  };
}

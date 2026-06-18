import { describe, expect, it, vi } from 'vitest';

import {
  type ChromeRuntimeOnMessageLike,
  installCat21DispatchListener,
} from './cat21-dispatch-listener';
import type { Cat21Dispatcher } from './cat21-dispatcher';

function makeFakeChrome(): {
  api: ChromeRuntimeOnMessageLike;
  /** Push a message through the registered listener; returns the keep-open flag the listener returned, plus the sendResponse spy. */
  fire(message: unknown): { keepOpen: boolean | void; sendResponse: ReturnType<typeof vi.fn> };
} {
  let registered:
    | ((m: unknown, sender: unknown, sendResponse: (r: unknown) => void) => boolean | void)
    | undefined;
  const api: ChromeRuntimeOnMessageLike = {
    onMessage: {
      addListener(cb) {
        registered = cb;
      },
    },
  };
  return {
    api,
    fire(message: unknown) {
      const sendResponse = vi.fn();
      const keepOpen = registered?.(message, {}, sendResponse);
      return { keepOpen, sendResponse };
    },
  };
}

function makeFakeDispatcher(
  result:
    | { ok: true; value: { kind: 'broadcast'; txid: string; channel: 'mempool' } }
    | { ok: false; value: { reason: string } }
): Cat21Dispatcher {
  return {
    handle: vi.fn(msg =>
      Promise.resolve({
        type: `${msg.type}:result` as
          | 'cat21_mint:result'
          | 'cat21_transfer:result'
          | 'cat21_create_offer:result'
          | 'cat21_accept_offer:result',
        requestId: msg.requestId,
        result,
      })
    ),
  } as unknown as Cat21Dispatcher;
}

describe('installCat21DispatchListener', () => {
  it('routes a cat21_mint envelope to the dispatcher and sends a typed reply', async () => {
    const dispatcher = makeFakeDispatcher({
      ok: true,
      value: { kind: 'broadcast', txid: 'tx1', channel: 'mempool' },
    });
    const { api, fire } = makeFakeChrome();
    installCat21DispatchListener({ chromeApi: api, getDispatcher: () => dispatcher });

    const { keepOpen, sendResponse } = fire({
      kind: 'cat21-dispatch',
      type: 'cat21_mint',
      requestId: 'r1',
      intent: { recipient: 'bc1q', feeRate: 5, mode: 'manual' },
    });

    expect(keepOpen).toBe(true);
    expect(dispatcher.handle).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'cat21_mint', requestId: 'r1' }),
      'popup'
    );
    // Let the promise chain finish.
    await Promise.resolve();
    await Promise.resolve();
    expect(sendResponse).toHaveBeenCalledWith({
      kind: 'cat21-dispatch:result',
      requestId: 'r1',
      result: { ok: true, value: { kind: 'broadcast', txid: 'tx1', channel: 'mempool' } },
    });
  });

  it('passes transport=popup (Path 2) — not mcp-nmh (Path 3)', () => {
    const dispatcher = makeFakeDispatcher({
      ok: true,
      value: { kind: 'broadcast', txid: 'tx1', channel: 'mempool' },
    });
    const { api, fire } = makeFakeChrome();
    installCat21DispatchListener({ chromeApi: api, getDispatcher: () => dispatcher });

    fire({
      kind: 'cat21-dispatch',
      type: 'cat21_mint',
      requestId: 'r1',
      intent: { recipient: 'bc1q', feeRate: 5, mode: 'manual' },
    });
    expect(dispatcher.handle).toHaveBeenCalledWith(expect.any(Object), 'popup');
  });

  it('preserves the requestId verbatim across the round-trip', async () => {
    const dispatcher = makeFakeDispatcher({
      ok: true,
      value: { kind: 'broadcast', txid: 'tx', channel: 'mempool' },
    });
    const { api, fire } = makeFakeChrome();
    installCat21DispatchListener({ chromeApi: api, getDispatcher: () => dispatcher });

    const { sendResponse } = fire({
      kind: 'cat21-dispatch',
      type: 'cat21_transfer',
      requestId: 'unique-id-from-popup',
      intent: { catId: 'xi0', recipient: 'bc1q', feeRate: 5, mode: 'manual' },
    });
    await Promise.resolve();
    await Promise.resolve();
    const reply = sendResponse.mock.calls[0]?.[0] as { requestId: string };
    expect(reply.requestId).toBe('unique-id-from-popup');
  });

  it('forwards a typed denial back as-is', async () => {
    const dispatcher = makeFakeDispatcher({
      ok: false,
      value: { reason: 'agent-disabled' },
    });
    const { api, fire } = makeFakeChrome();
    installCat21DispatchListener({ chromeApi: api, getDispatcher: () => dispatcher });

    const { sendResponse } = fire({
      kind: 'cat21-dispatch',
      type: 'cat21_mint',
      requestId: 'r1',
      intent: { recipient: 'bc1q', feeRate: 5, mode: 'manual' },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(sendResponse).toHaveBeenCalledWith({
      kind: 'cat21-dispatch:result',
      requestId: 'r1',
      result: { ok: false, value: { reason: 'agent-disabled' } },
    });
  });

  it('lets non-cat21 messages fall through (return undefined, no sendResponse)', () => {
    const dispatcher = makeFakeDispatcher({
      ok: true,
      value: { kind: 'broadcast', txid: 'tx', channel: 'mempool' },
    });
    const { api, fire } = makeFakeChrome();
    installCat21DispatchListener({ chromeApi: api, getDispatcher: () => dispatcher });

    const { keepOpen, sendResponse } = fire({ kind: 'something-else', payload: {} });

    expect(keepOpen).toBeUndefined();
    expect(dispatcher.handle).not.toHaveBeenCalled();
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('drops malformed envelopes silently (unknown type, missing requestId, etc.)', () => {
    const dispatcher = makeFakeDispatcher({
      ok: true,
      value: { kind: 'broadcast', txid: 'tx', channel: 'mempool' },
    });
    const { api, fire } = makeFakeChrome();
    installCat21DispatchListener({ chromeApi: api, getDispatcher: () => dispatcher });

    // Unknown type.
    fire({ kind: 'cat21-dispatch', type: 'cat21_bogus', requestId: 'r1', intent: {} });
    // Missing requestId.
    fire({ kind: 'cat21-dispatch', type: 'cat21_mint', intent: {} });
    // Non-object.
    fire('hello');
    fire(null);

    expect(dispatcher.handle).not.toHaveBeenCalled();
  });

  it('synthesises a broadcast-failed reply if dispatcher.handle throws', async () => {
    const dispatcher = {
      handle: vi.fn(() => Promise.reject(new Error('boom'))),
    } as unknown as Cat21Dispatcher;
    const { api, fire } = makeFakeChrome();
    installCat21DispatchListener({ chromeApi: api, getDispatcher: () => dispatcher });

    const { sendResponse } = fire({
      kind: 'cat21-dispatch',
      type: 'cat21_mint',
      requestId: 'r1',
      intent: { recipient: 'bc1q', feeRate: 5, mode: 'manual' },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(sendResponse).toHaveBeenCalledWith({
      kind: 'cat21-dispatch:result',
      requestId: 'r1',
      result: { ok: false, value: { reason: 'broadcast-failed', detail: 'boom' } },
    });
  });

  it('calls getDispatcher() fresh per message (so account switches take effect)', () => {
    const dispatcherA = makeFakeDispatcher({
      ok: true,
      value: { kind: 'broadcast', txid: 'a', channel: 'mempool' },
    });
    const dispatcherB = makeFakeDispatcher({
      ok: true,
      value: { kind: 'broadcast', txid: 'b', channel: 'mempool' },
    });
    let current = dispatcherA;
    const { api, fire } = makeFakeChrome();
    installCat21DispatchListener({ chromeApi: api, getDispatcher: () => current });

    fire({
      kind: 'cat21-dispatch',
      type: 'cat21_mint',
      requestId: 'r1',
      intent: { recipient: 'bc1q', feeRate: 5, mode: 'manual' },
    });
    current = dispatcherB;
    fire({
      kind: 'cat21-dispatch',
      type: 'cat21_mint',
      requestId: 'r2',
      intent: { recipient: 'bc1q', feeRate: 5, mode: 'manual' },
    });

    expect(dispatcherA.handle).toHaveBeenCalledTimes(1);
    expect(dispatcherB.handle).toHaveBeenCalledTimes(1);
  });
});

import { describe, expect, it, vi } from 'vitest';

import type { Cat21Dispatcher } from './cat21-dispatcher';
import {
  type NativeHostPortLike,
  attachNativeHostToDispatcher,
  connectToNativeHost,
} from './connect-native-host';

/**
 * Hand-rolled fake port. Records every `postMessage` for assertions
 * and lets the spec drive `onMessage` listeners synchronously via the
 * returned `fire` callback.
 */
function makeFakePort(): {
  port: NativeHostPortLike;
  sent: unknown[];
  fire(msg: unknown): void;
  disconnect(): void;
} {
  const sent: unknown[] = [];
  let onMessage: ((msg: unknown) => void) | undefined;
  let onDisconnect: (() => void) | undefined;
  const port: NativeHostPortLike = {
    postMessage(message) {
      sent.push(message);
    },
    onMessage: {
      addListener(cb) {
        onMessage = cb;
      },
    },
    onDisconnect: {
      addListener(cb) {
        onDisconnect = cb;
      },
    },
  };
  return {
    port,
    sent,
    fire(msg) {
      onMessage?.(msg);
    },
    disconnect() {
      onDisconnect?.();
    },
  };
}

function makeFakeDispatcher(
  result: { ok: true; value: { txid: string } } | { ok: false; value: { reason: string } }
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

describe('attachNativeHostToDispatcher', () => {
  it('routes a cat21_mint NMH message to the dispatcher and posts a typed reply', async () => {
    const dispatcher = makeFakeDispatcher({ ok: true, value: { txid: 'tx-1' } });
    const { port, sent, fire } = makeFakePort();
    attachNativeHostToDispatcher(port, dispatcher);

    fire({
      type: 'cat21_mint',
      id: 'req-1',
      payload: {
        recipient: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        feeRate: 5,
        mode: 'autonomous',
      },
    });

    // dispatcher.handle is async; let the microtask queue drain.
    await Promise.resolve();
    await Promise.resolve();

    expect(dispatcher.handle).toHaveBeenCalledTimes(1);
    expect(dispatcher.handle).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'cat21_mint',
        requestId: 'req-1',
      }),
      'mcp-nmh'
    );
    expect(sent).toEqual([
      {
        type: 'cat21_mint:result',
        id: 'req-1',
        payload: { ok: true, value: { txid: 'tx-1' } },
      },
    ]);
  });

  it('preserves the request id so the MCP host can resolve its pending-call map', async () => {
    const dispatcher = makeFakeDispatcher({ ok: false, value: { reason: 'agent-disabled' } });
    const { port, sent, fire } = makeFakePort();
    attachNativeHostToDispatcher(port, dispatcher);

    fire({
      type: 'cat21_transfer',
      id: 'req-abc',
      payload: {
        catId: 'xyz',
        recipient: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        feeRate: 5,
        mode: 'autonomous',
      },
    });

    await Promise.resolve();
    await Promise.resolve();

    const reply = sent[0] as { id: string };
    expect(reply.id).toBe('req-abc');
  });

  it('silently ignores non-cat21_* messages (e.g. read-only queries handled elsewhere)', async () => {
    const dispatcher = makeFakeDispatcher({ ok: true, value: { txid: 'tx-1' } });
    const { port, sent, fire } = makeFakePort();
    attachNativeHostToDispatcher(port, dispatcher);

    fire({ type: 'cat21_status_ping', id: 'q-1', payload: {} });
    fire('not even an object');
    fire(null);
    fire({ type: 'cat21_mint', id: 42, payload: {} }); // id wrong type

    await Promise.resolve();
    await Promise.resolve();

    expect(dispatcher.handle).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it('routes all four cat21_* mutating types', async () => {
    const dispatcher = makeFakeDispatcher({ ok: true, value: { txid: 'tx-x' } });
    const { port, fire } = makeFakePort();
    attachNativeHostToDispatcher(port, dispatcher);

    for (const type of [
      'cat21_mint',
      'cat21_transfer',
      'cat21_create_offer',
      'cat21_accept_offer',
    ] as const) {
      fire({ type, id: `${type}-id`, payload: {} });
    }
    await Promise.resolve();
    await Promise.resolve();

    expect(dispatcher.handle).toHaveBeenCalledTimes(4);
  });
});

describe('connectToNativeHost', () => {
  it('opens the port with the default application name and attaches the dispatcher', () => {
    const { port } = makeFakePort();
    const connectNative = vi.fn(() => port);
    const dispatcher = makeFakeDispatcher({ ok: true, value: { txid: 'tx-1' } });

    const returned = connectToNativeHost({ connectNative, dispatcher });

    expect(connectNative).toHaveBeenCalledWith('space.cat21.wallet');
    expect(returned).toBe(port);
  });

  it('honours an explicit applicationName override (for staging hosts)', () => {
    const { port } = makeFakePort();
    const connectNative = vi.fn(() => port);
    const dispatcher = makeFakeDispatcher({ ok: true, value: { txid: 'tx-1' } });

    connectToNativeHost({
      connectNative,
      dispatcher,
      applicationName: 'space.cat21.wallet.staging',
    });

    expect(connectNative).toHaveBeenCalledWith('space.cat21.wallet.staging');
  });
});

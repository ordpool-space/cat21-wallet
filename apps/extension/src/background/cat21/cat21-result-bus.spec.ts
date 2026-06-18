import { describe, expect, it, vi } from 'vitest';

import { postCat21Result, subscribeToCat21Result } from './cat21-result-bus';
import type { Cat21RpcResult } from './types';

/**
 * In-memory broadcast that mirrors the relevant slice of
 * chrome.runtime.onMessage / sendMessage. Specs wire `send` →
 * `onMessage.addListener`-registered listeners so the round-trip
 * behaves like the real Chrome plumbing without any global mocks.
 */
function makeRuntimeFake() {
  const listeners = new Set<(msg: unknown) => void>();
  return {
    sendMessage(msg: unknown): Promise<void> {
      for (const l of [...listeners]) l(msg);
      return Promise.resolve();
    },
    onMessage: {
      addListener(l: (msg: unknown) => void) {
        listeners.add(l);
      },
      removeListener(l: (msg: unknown) => void) {
        listeners.delete(l);
      },
    },
    listenerCount() {
      return listeners.size;
    },
  };
}

const okResult: Cat21RpcResult = {
  ok: true,
  value: { kind: 'broadcast', txid: 'deadbeef', channel: 'mempool' },
};

describe('cat21-result-bus round-trip', () => {
  it('subscribe resolves with the result the popup posted for the matching requestId', async () => {
    const bus = makeRuntimeFake();
    const waiter = subscribeToCat21Result(bus.onMessage, 'req-1');
    await postCat21Result(bus.sendMessage, 'req-1', okResult);
    await expect(waiter).resolves.toEqual(okResult);
  });

  it('subscribe ignores envelopes for other requestIds (concurrent requests dont collide)', async () => {
    const bus = makeRuntimeFake();
    const waiter = subscribeToCat21Result(bus.onMessage, 'req-1');
    await postCat21Result(bus.sendMessage, 'req-other', {
      ok: false,
      value: { reason: 'agent-disabled' },
    });
    // Still pending — racing it with an immediate timeout proves so.
    const won = await Promise.race([waiter, Promise.resolve('still-pending')]);
    expect(won).toBe('still-pending');
  });

  it('subscribe ignores envelopes from unrelated sources (any other chrome.runtime traffic)', async () => {
    const bus = makeRuntimeFake();
    const waiter = subscribeToCat21Result(bus.onMessage, 'req-1');
    bus.onMessage.addListener(() => {});
    await bus.sendMessage({
      source: 'leather-finalize-psbt',
      requestId: 'req-1',
      result: okResult,
    });
    const won = await Promise.race([waiter, Promise.resolve('still-pending')]);
    expect(won).toBe('still-pending');
  });

  it('subscribe removes its listener after the matching envelope arrives (no leak)', async () => {
    const bus = makeRuntimeFake();
    const before = bus.listenerCount();
    const waiter = subscribeToCat21Result(bus.onMessage, 'req-1');
    expect(bus.listenerCount()).toBe(before + 1);
    await postCat21Result(bus.sendMessage, 'req-1', okResult);
    await waiter;
    expect(bus.listenerCount()).toBe(before);
  });

  it('subscribe handles a denied result identically — round-trip works for failure outcomes too', async () => {
    const bus = makeRuntimeFake();
    const denied: Cat21RpcResult = {
      ok: false,
      value: { reason: 'policy-denied', detail: 'per-action: 21000 > 1000' },
    };
    const waiter = subscribeToCat21Result(bus.onMessage, 'req-1');
    await postCat21Result(bus.sendMessage, 'req-1', denied);
    await expect(waiter).resolves.toEqual(denied);
  });

  it('postCat21Result calls sendMessage exactly once with the tagged envelope', async () => {
    const send = vi.fn(() => Promise.resolve());
    await postCat21Result(send, 'req-1', okResult);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      source: 'cat21-result-bus',
      requestId: 'req-1',
      result: okResult,
    });
  });
});

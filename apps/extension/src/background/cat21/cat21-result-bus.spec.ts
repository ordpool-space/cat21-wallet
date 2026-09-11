import { describe, expect, it, vi } from 'vitest';

import { type SenderLike, postCat21Result, subscribeToCat21Result } from './cat21-result-bus';
import type { Cat21RpcResult } from './types';

/**
 * In-memory broadcast that mirrors the relevant slice of
 * chrome.runtime.onMessage / sendMessage. Specs wire `send` →
 * `onMessage.addListener`-registered listeners so the round-trip
 * behaves like the real Chrome plumbing without any global mocks.
 *
 * `sendMessage` accepts an optional `sender` so tests can simulate
 * messages arriving from different origins (own popup vs another
 * extension vs a content script).
 */
function makeRuntimeFake(defaultSender: SenderLike = { id: 'own-ext-id' }) {
  const listeners = new Set<(msg: unknown, sender?: SenderLike) => void>();
  return {
    sendMessage(msg: unknown, sender: SenderLike = defaultSender): Promise<void> {
      for (const l of [...listeners]) l(msg, sender);
      return Promise.resolve();
    },
    onMessage: {
      addListener(l: (msg: unknown, sender?: SenderLike) => void) {
        listeners.add(l);
      },
      removeListener(l: (msg: unknown, sender?: SenderLike) => void) {
        listeners.delete(l);
      },
    },
    listenerCount() {
      return listeners.size;
    },
  };
}

/** Production-shaped verifier closure: accepts only own-extension page senders. */
function acceptOwnExtensionOnly(sender: SenderLike | undefined): boolean {
  return sender?.id === 'own-ext-id' && sender?.tab === undefined;
}

const okResult: Cat21RpcResult = {
  ok: true,
  value: { kind: 'broadcast', txid: 'deadbeef', channel: 'mempool' },
};

describe('cat21-result-bus round-trip', () => {
  it('subscribe resolves with the result the popup posted for the matching requestId', async () => {
    const bus = makeRuntimeFake();
    const waiter = subscribeToCat21Result(bus.onMessage, 'req-1', acceptOwnExtensionOnly);
    await postCat21Result(bus.sendMessage, 'req-1', okResult);
    await expect(waiter).resolves.toEqual(okResult);
  });

  it('subscribe ignores envelopes for other requestIds (concurrent requests dont collide)', async () => {
    const bus = makeRuntimeFake();
    const waiter = subscribeToCat21Result(bus.onMessage, 'req-1', acceptOwnExtensionOnly);
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
    const waiter = subscribeToCat21Result(bus.onMessage, 'req-1', acceptOwnExtensionOnly);
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
    const waiter = subscribeToCat21Result(bus.onMessage, 'req-1', acceptOwnExtensionOnly);
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
    const waiter = subscribeToCat21Result(bus.onMessage, 'req-1', acceptOwnExtensionOnly);
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

describe('cat21-result-bus sender integrity check (audit C2)', () => {
  /**
   * Without `verifySender`, any extension page or co-resident extension
   * that learns the `requestId` could inject a forged broadcast result
   * and the NMH relay would propagate the fake reply to the MCP agent.
   * These specs pin the rejection paths.
   */

  it('rejects envelopes from a different extension id (cross-extension injection)', async () => {
    const bus = makeRuntimeFake();
    const waiter = subscribeToCat21Result(bus.onMessage, 'req-1', acceptOwnExtensionOnly);
    await bus.sendMessage(
      { source: 'cat21-result-bus', requestId: 'req-1', result: okResult },
      { id: 'other-ext-id' }
    );
    const won = await Promise.race([waiter, Promise.resolve('still-pending')]);
    expect(won).toBe('still-pending');
  });

  it('rejects envelopes from a content script (sender.tab defined)', async () => {
    const bus = makeRuntimeFake();
    const waiter = subscribeToCat21Result(bus.onMessage, 'req-1', acceptOwnExtensionOnly);
    await bus.sendMessage(
      { source: 'cat21-result-bus', requestId: 'req-1', result: okResult },
      { id: 'own-ext-id', tab: { id: 42, url: 'https://evil.example' } }
    );
    const won = await Promise.race([waiter, Promise.resolve('still-pending')]);
    expect(won).toBe('still-pending');
  });

  it('rejects envelopes when sender lacks id metadata (defensive: never trust missing metadata)', async () => {
    const bus = makeRuntimeFake();
    const waiter = subscribeToCat21Result(bus.onMessage, 'req-1', acceptOwnExtensionOnly);
    // Simulate Chrome delivering a sender object without `id` (shouldn't
    // happen in practice but the predicate must fail closed).
    await bus.sendMessage(
      { source: 'cat21-result-bus', requestId: 'req-1', result: okResult },
      {} // no id, no tab
    );
    const won = await Promise.race([waiter, Promise.resolve('still-pending')]);
    expect(won).toBe('still-pending');
  });

  it('verifySender is consulted before the source / requestId predicates', async () => {
    // If the order was reversed, the rejection wouldn't matter for
    // garbage envelopes — but for the *correct* envelope shape from
    // the wrong sender it does. This is the load-bearing case.
    const bus = makeRuntimeFake();
    let verifierCalls = 0;
    function verifier(s: SenderLike | undefined): boolean {
      verifierCalls++;
      return s?.id === 'own-ext-id' && s?.tab === undefined;
    }
    const waiter = subscribeToCat21Result(bus.onMessage, 'req-1', verifier);

    // Attempt: forged sender with our extension id but content-script tab.
    await bus.sendMessage(
      { source: 'cat21-result-bus', requestId: 'req-1', result: okResult },
      { id: 'own-ext-id', tab: { id: 1 } }
    );
    expect(verifierCalls).toBe(1);

    // The waiter is still pending; now the legitimate sender wins.
    await postCat21Result(bus.sendMessage, 'req-1', okResult);
    await expect(waiter).resolves.toEqual(okResult);
    expect(verifierCalls).toBe(2);
  });
});

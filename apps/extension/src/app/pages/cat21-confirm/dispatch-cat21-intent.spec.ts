import { describe, expect, it, vi } from 'vitest';

import { type ChromeRuntimeLike, dispatchCat21Intent } from './dispatch-cat21-intent';

function makeFakeChrome(reply: unknown): {
  api: ChromeRuntimeLike;
  sent: unknown[];
} {
  const sent: unknown[] = [];
  return {
    sent,
    api: {
      sendMessage: vi.fn((msg: unknown) => {
        sent.push(msg);
        return Promise.resolve(reply);
      }),
    } as ChromeRuntimeLike,
  };
}

describe('dispatchCat21Intent', () => {
  describe('intent kind detection', () => {
    it('routes a mint intent as cat21_mint', async () => {
      const { api, sent } = makeFakeChrome({
        kind: 'cat21-dispatch:result',
        requestId: 'r1',
        result: { ok: true, value: { kind: 'broadcast', txid: 'tx1', channel: 'mempool' } },
      });
      await dispatchCat21Intent({
        chromeApi: api,
        intent: { recipient: 'bc1q', feeRate: 5, mode: 'manual' },
        requestId: 'r1',
      });
      expect((sent[0] as { type: string }).type).toBe('cat21_mint');
    });

    it('routes a transfer intent as cat21_transfer', async () => {
      const { api, sent } = makeFakeChrome({
        kind: 'cat21-dispatch:result',
        requestId: 'r2',
        result: { ok: true, value: { kind: 'broadcast', txid: 'tx2', channel: 'mempool' } },
      });
      await dispatchCat21Intent({
        chromeApi: api,
        intent: { catId: 'xi0', recipient: 'bc1q', feeRate: 5, mode: 'manual' },
        requestId: 'r2',
      });
      expect((sent[0] as { type: string }).type).toBe('cat21_transfer');
    });

    it('routes a create-offer intent as cat21_create_offer', async () => {
      const { api, sent } = makeFakeChrome({
        kind: 'cat21-dispatch:result',
        requestId: 'r3',
        result: { ok: true, value: { kind: 'listing', listing: {} } },
      });
      await dispatchCat21Intent({
        chromeApi: api,
        intent: { catId: 'xi0', priceSats: 100, paymentAddress: 'bc1q', mode: 'manual' },
        requestId: 'r3',
      });
      expect((sent[0] as { type: string }).type).toBe('cat21_create_offer');
    });

    it('routes an accept-offer intent as cat21_accept_offer', async () => {
      const { api, sent } = makeFakeChrome({
        kind: 'cat21-dispatch:result',
        requestId: 'r4',
        result: { ok: true, value: { kind: 'broadcast', txid: 'tx4', channel: 'mempool' } },
      });
      await dispatchCat21Intent({
        chromeApi: api,
        intent: {
          offerPsbt: 'ab',
          expectedCatId: 'xi0',
          expectedPriceSats: 100,
          expectedSellerUtxo: { txid: 'x', vout: 0 },
          mode: 'manual',
        },
        requestId: 'r4',
      });
      expect((sent[0] as { type: string }).type).toBe('cat21_accept_offer');
    });
  });

  describe('reply handling', () => {
    it('returns ok=true on a broadcast success', async () => {
      const { api } = makeFakeChrome({
        kind: 'cat21-dispatch:result',
        requestId: 'r1',
        result: { ok: true, value: { kind: 'broadcast', txid: 'tx', channel: 'mempool' } },
      });
      const result = await dispatchCat21Intent({
        chromeApi: api,
        intent: { recipient: 'bc1q', feeRate: 5, mode: 'manual' },
        requestId: 'r1',
      });
      expect(result).toEqual({ ok: true, errorMessage: null });
    });

    it('returns ok=false with the reason on a typed denial', async () => {
      const { api } = makeFakeChrome({
        kind: 'cat21-dispatch:result',
        requestId: 'r1',
        result: { ok: false, value: { reason: 'agent-disabled' } },
      });
      const result = await dispatchCat21Intent({
        chromeApi: api,
        intent: { recipient: 'bc1q', feeRate: 5, mode: 'manual' },
        requestId: 'r1',
      });
      expect(result).toEqual({ ok: false, errorMessage: 'agent-disabled' });
    });

    it('includes `detail` in the errorMessage when present', async () => {
      const { api } = makeFakeChrome({
        kind: 'cat21-dispatch:result',
        requestId: 'r1',
        result: {
          ok: false,
          value: { reason: 'policy-denied', detail: 'fee-rate-above-ceiling: 100 > 50' },
        },
      });
      const result = await dispatchCat21Intent({
        chromeApi: api,
        intent: { recipient: 'bc1q', feeRate: 100, mode: 'manual' },
        requestId: 'r1',
      });
      expect(result.errorMessage).toBe('policy-denied: fee-rate-above-ceiling: 100 > 50');
    });

    it('returns ok=false on a malformed reply (wrong kind)', async () => {
      const { api } = makeFakeChrome({
        kind: 'something-else',
        requestId: 'r1',
        result: { ok: true, value: { kind: 'broadcast', txid: 'tx', channel: 'mempool' } },
      });
      const result = await dispatchCat21Intent({
        chromeApi: api,
        intent: { recipient: 'bc1q', feeRate: 5, mode: 'manual' },
        requestId: 'r1',
      });
      expect(result.ok).toBe(false);
      expect(result.errorMessage).toMatch(/Malformed reply/);
    });

    it('returns ok=false on a malformed reply (mismatched requestId)', async () => {
      const { api } = makeFakeChrome({
        kind: 'cat21-dispatch:result',
        requestId: 'WRONG',
        result: { ok: true, value: { kind: 'broadcast', txid: 'tx', channel: 'mempool' } },
      });
      const result = await dispatchCat21Intent({
        chromeApi: api,
        intent: { recipient: 'bc1q', feeRate: 5, mode: 'manual' },
        requestId: 'r1',
      });
      expect(result.ok).toBe(false);
      expect(result.errorMessage).toMatch(/Malformed reply/);
    });

    it('returns ok=false with the thrown message on channel failure', async () => {
      const api: ChromeRuntimeLike = {
        sendMessage: vi.fn(() => Promise.reject(new Error('disconnected'))),
      };
      const result = await dispatchCat21Intent({
        chromeApi: api,
        intent: { recipient: 'bc1q', feeRate: 5, mode: 'manual' },
        requestId: 'r1',
      });
      expect(result.ok).toBe(false);
      expect(result.errorMessage).toMatch(/Background channel failed: disconnected/);
    });
  });
});

import { describe, expect, it, vi } from 'vitest';

import { RouteUrls } from '@shared/route-urls';

import { relayNmhMessageThroughPopup } from './nmh-popup-relay';
import { type SessionStorageLike } from './popup-bridge';
import type { Cat21MintIntent, Cat21RpcResult } from './types';

/**
 * Same in-memory storage shape as `popup-bridge.spec.ts`. Kept local
 * so the spec stays single-file readable.
 */
function makeFakeStorage(): SessionStorageLike & { state: Record<string, unknown> } {
  const state: Record<string, unknown> = {};
  return {
    state,
    set(items) {
      for (const [k, v] of Object.entries(items)) state[k] = v;
      return Promise.resolve();
    },
    get(keys) {
      const want = Array.isArray(keys) ? keys : [keys];
      const out: Record<string, unknown> = {};
      for (const k of want) if (k in state) out[k] = state[k];
      return Promise.resolve(out);
    },
    remove(keys) {
      const want = Array.isArray(keys) ? keys : [keys];
      for (const k of want) delete state[k];
      return Promise.resolve();
    },
  };
}

const mintIntent: Cat21MintIntent = {
  recipient: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
  feeRate: 7,
};

const mintResult: Cat21RpcResult = {
  ok: true,
  value: { kind: 'broadcast', txid: 'deadbeef', channel: 'mempool' },
};

describe('relayNmhMessageThroughPopup', () => {
  it('stashes the intent in storage before opening the popup', async () => {
    const storage = makeFakeStorage();
    const calls: string[] = [];
    const port = { postMessage: vi.fn() };

    await relayNmhMessageThroughPopup(
      { id: 'nmh-1', type: 'cat21_mint', payload: mintIntent },
      port,
      {
        storage,
        triggerPopupOpen(route, urlParams) {
          // At this point the stash MUST already be on disk —
          // otherwise the popup races and reads `{}` from storage.
          const stashedKeys = Object.keys(storage.state);
          calls.push(`open(${route},${urlParams.get('cat21RequestId')})`);
          expect(stashedKeys.length).toBe(1);
          return Promise.resolve();
        },
        waitForPopupResult() {
          calls.push('wait');
          return Promise.resolve(mintResult);
        },
      }
    );

    expect(calls).toEqual([expect.stringContaining(`open(${RouteUrls.Cat21MintConfirm},`), 'wait']);
  });

  it('posts the cat21_mint:result message with the inbound nmh id', async () => {
    const storage = makeFakeStorage();
    const port = { postMessage: vi.fn() };

    await relayNmhMessageThroughPopup(
      { id: 'nmh-abc', type: 'cat21_mint', payload: mintIntent },
      port,
      {
        storage,
        triggerPopupOpen: () => Promise.resolve(),
        waitForPopupResult: () => Promise.resolve(mintResult),
      }
    );

    expect(port.postMessage).toHaveBeenCalledTimes(1);
    expect(port.postMessage).toHaveBeenCalledWith({
      type: 'cat21_mint:result',
      id: 'nmh-abc',
      payload: mintResult,
    });
  });

  it('clears the storage entry after success so the cleared key is gone', async () => {
    const storage = makeFakeStorage();
    const port = { postMessage: vi.fn() };

    await relayNmhMessageThroughPopup(
      { id: 'nmh-1', type: 'cat21_mint', payload: mintIntent },
      port,
      {
        storage,
        triggerPopupOpen: () => Promise.resolve(),
        waitForPopupResult: () => Promise.resolve(mintResult),
      }
    );

    expect(Object.keys(storage.state)).toEqual([]);
  });

  it('clears the storage entry even when popup fails (no intent leak across calls)', async () => {
    const storage = makeFakeStorage();
    const port = { postMessage: vi.fn() };

    await expect(
      relayNmhMessageThroughPopup({ id: 'nmh-1', type: 'cat21_mint', payload: mintIntent }, port, {
        storage,
        triggerPopupOpen: () => Promise.reject(new Error('popup blocked')),
        waitForPopupResult: () => Promise.resolve(mintResult),
      })
    ).rejects.toThrow('popup blocked');

    expect(Object.keys(storage.state)).toEqual([]);
    expect(port.postMessage).not.toHaveBeenCalled();
  });

  it('routes each cat21_* type to its dedicated confirm URL', async () => {
    const storage = makeFakeStorage();
    const opened: RouteUrls[] = [];
    const port = { postMessage: vi.fn() };
    const deps = {
      storage,
      triggerPopupOpen(route: RouteUrls) {
        opened.push(route);
        return Promise.resolve();
      },
      waitForPopupResult: () => Promise.resolve(mintResult),
    };

    await relayNmhMessageThroughPopup(
      { id: '1', type: 'cat21_mint', payload: mintIntent },
      port,
      deps
    );
    await relayNmhMessageThroughPopup(
      {
        id: '2',
        type: 'cat21_transfer',
        payload: {
          catId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaai0',
          recipient: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
          feeRate: 7,
        },
      },
      port,
      deps
    );
    await relayNmhMessageThroughPopup(
      {
        id: '3',
        type: 'cat21_create_offer',
        payload: {
          catId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaai0',
          priceSats: 21000,
          paymentAddress: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        },
      },
      port,
      deps
    );
    await relayNmhMessageThroughPopup(
      {
        id: '4',
        type: 'cat21_accept_offer',
        payload: {
          offerPsbt: 'deadbeef',
          expectedCatId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaai0',
          expectedPriceSats: 21000,
          expectedSellerUtxo: { txid: 'a'.repeat(64), vout: 0 },
        },
      },
      port,
      deps
    );

    expect(opened).toEqual([
      RouteUrls.Cat21MintConfirm,
      RouteUrls.Cat21TransferConfirm,
      RouteUrls.Cat21CreateOfferConfirm,
      RouteUrls.Cat21AcceptOfferConfirm,
    ]);
  });
});

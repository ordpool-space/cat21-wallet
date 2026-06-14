import { describe, expect, it, vi } from 'vitest';

import {
  Cat21Dispatcher,
  Cat21DispatcherMessage,
  createCat21Dispatcher,
  makeWiringPendingDeps,
} from './cat21-dispatcher';
import type { Cat21RpcResult } from './types';

const VALID_CAT_ID = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefi0';
const VALID_TXID = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

function makeMintMessage(): Cat21DispatcherMessage {
  return {
    type: 'cat21_mint',
    requestId: 'req-1',
    intent: { recipient: 'bc1qfoo', feeRate: 5 },
  };
}

describe('Cat21Dispatcher', () => {

  it('routes cat21_mint to service.mint and tags reply type with :result', async () => {
    const okResult: Cat21RpcResult = {
      ok: true,
      value: { kind: 'broadcast', txid: 'tx-1', channel: 'mempool' },
    };
    const service = {
      mint: vi.fn(() => Promise.resolve(okResult)),
      transfer: vi.fn(),
      createOffer: vi.fn(),
      acceptOffer: vi.fn(),
    };
    const dispatcher = new Cat21Dispatcher(service as never);
    const reply = await dispatcher.handle(makeMintMessage(), 'mcp-nmh');
    expect(service.mint).toHaveBeenCalledWith({ recipient: 'bc1qfoo', feeRate: 5 }, 'mcp-nmh');
    expect(reply).toEqual({
      type: 'cat21_mint:result',
      requestId: 'req-1',
      result: okResult,
    });
  });

  it.each([
    ['cat21_transfer', 'transfer'],
    ['cat21_create_offer', 'createOffer'],
    ['cat21_accept_offer', 'acceptOffer'],
  ] as const)('routes %s to service.%s', async (msgType, methodName) => {
    const okResult: Cat21RpcResult = {
      ok: true,
      value: { kind: 'broadcast', txid: 'tx-2', channel: 'mempool' },
    };
    const service = {
      mint: vi.fn(),
      transfer: vi.fn(() => Promise.resolve(okResult)),
      createOffer: vi.fn(() => Promise.resolve(okResult)),
      acceptOffer: vi.fn(() => Promise.resolve(okResult)),
    };
    const dispatcher = new Cat21Dispatcher(service as never);
    const reply = await dispatcher.handle(
      {
        type: msgType,
        requestId: 'req-x',
        intent: {
          catId: VALID_CAT_ID,
          recipient: 'bc1qfoo',
          feeRate: 5,
          priceSats: 100_000,
          paymentAddress: 'bc1qfoo',
          offerPsbt: 'deadbeef',
          expectedCatId: VALID_CAT_ID,
          expectedPriceSats: 100_000,
          expectedSellerUtxo: { txid: VALID_TXID, vout: 0 },
        },
      },
      'mcp-nmh'
    );
    expect(service[methodName]).toHaveBeenCalled();
    expect(reply.type).toBe(`${msgType}:result`);
    expect(reply.requestId).toBe('req-x');
  });

  it('passes transport verbatim to the service (popup vs mcp-nmh)', async () => {
    const service = {
      mint: vi.fn(() =>
        Promise.resolve({
          ok: true,
          value: { kind: 'broadcast', txid: 'tx', channel: 'mempool' },
        } as Cat21RpcResult)
      ),
      transfer: vi.fn(),
      createOffer: vi.fn(),
      acceptOffer: vi.fn(),
    };
    const dispatcher = new Cat21Dispatcher(service as never);
    await dispatcher.handle(makeMintMessage(), 'popup');
    expect(service.mint).toHaveBeenCalledWith(expect.any(Object), 'popup');
  });

  it('createCat21Dispatcher with wiring-pending deps returns broadcast-failed denials, not throws', async () => {
    const dispatcher = createCat21Dispatcher(makeWiringPendingDeps());
    const reply = await dispatcher.handle(makeMintMessage(), 'popup');
    expect(reply.result.ok).toBe(false);
    if (!reply.result.ok) {
      // The wiring-pending deps throw from getAccountContext, which the
      // service catches into intent-invariant-violated. The exact mapping
      // is a service-layer concern; the dispatcher reply just confirms it
      // doesn't crash and surfaces a typed denial.
      expect(['intent-invariant-violated', 'broadcast-failed']).toContain(
        reply.result.value.reason
      );
    }
  });

  it('wiring-pending deps reject autonomous mode through the policy gate', async () => {
    const dispatcher = createCat21Dispatcher(makeWiringPendingDeps());
    const reply = await dispatcher.handle(
      {
        type: 'cat21_mint',
        requestId: 'req-auto',
        intent: { recipient: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', feeRate: 5, mode: 'autonomous' },
      },
      'mcp-nmh'
    );
    expect(reply.result.ok).toBe(false);
    if (!reply.result.ok) {
      // wiring-pending agentMode.enabled=false → 'agent-disabled' denial.
      expect(reply.result.value.reason).toBe('agent-disabled');
    }
  });
});

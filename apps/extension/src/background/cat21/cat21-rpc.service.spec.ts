import { hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BroadcastResult,
  Cat21AccountContext,
  Cat21FundingUtxo,
  Cat21RpcDeps,
  Cat21RpcService,
  SignedTx,
} from './cat21-rpc.service';
import type { Cat21Intent, Cat21MintIntent } from './types';

const publicKey = hex.decode('030000000000000000000000000000000000000000000000000000000000000001');
const p2wpkhMainnet = btc.p2wpkh(publicKey, btc.NETWORK);

function defaultAccountCtx(): Cat21AccountContext {
  return {
    paymentAddress: p2wpkhMainnet.address!,
    network: 'mainnet',
  };
}

function defaultUtxo(): Cat21FundingUtxo {
  return {
    txid: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    vout: 0,
    value: 50_000,
    scriptPubKey: p2wpkhMainnet.script,
  };
}

function makeIntent(overrides: Partial<Cat21MintIntent> = {}): Cat21MintIntent {
  return {
    recipient: p2wpkhMainnet.address!,
    feeRate: 5,
    ...overrides,
  };
}

interface SpyDeps extends Cat21RpcDeps {
  getAccountContext: ReturnType<typeof vi.fn> & Cat21RpcDeps['getAccountContext'];
  evaluateAgentPolicy: ReturnType<typeof vi.fn> & Cat21RpcDeps['evaluateAgentPolicy'];
  pickFundingUtxo: ReturnType<typeof vi.fn> & Cat21RpcDeps['pickFundingUtxo'];
  signWithConfirmation: ReturnType<typeof vi.fn> & Cat21RpcDeps['signWithConfirmation'];
  signSilently: ReturnType<typeof vi.fn> & Cat21RpcDeps['signSilently'];
  broadcast: ReturnType<typeof vi.fn> & Cat21RpcDeps['broadcast'];
  recordSpend: ReturnType<typeof vi.fn> & Cat21RpcDeps['recordSpend'];
}

function makeDeps(overrides: Partial<Cat21RpcDeps> = {}): SpyDeps {
  const signedTx: SignedTx = { hex: 'deadbeef', weight: 600 };
  const broadcastResult: BroadcastResult = { txid: 'tx-abc', channel: 'mempool' };
  const deps = {
    getAccountContext: vi.fn(() => defaultAccountCtx()),
    agentMode: { enabled: true },
    evaluateAgentPolicy: vi.fn(() => ({ allowed: true as const })),
    pickFundingUtxo: vi.fn(() => defaultUtxo()),
    signWithConfirmation: vi.fn(() => Promise.resolve(signedTx)),
    signSilently: vi.fn(() => Promise.resolve(signedTx)),
    broadcast: vi.fn(() => Promise.resolve(broadcastResult)),
    recordSpend: vi.fn(),
    ...overrides,
  };
  return deps as SpyDeps;
}

describe('Cat21RpcService.mint', () => {

  let deps: SpyDeps;
  let service: Cat21RpcService;

  beforeEach(() => {
    deps = makeDeps();
    service = new Cat21RpcService(deps);
  });

  describe('happy paths', () => {

    it('mints in manual mode through popup-confirm signer', async () => {
      const result = await service.mint(makeIntent(), 'popup');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.txid).toBe('tx-abc');
        expect(result.value.channel).toBe('mempool');
      }
      expect(deps.signWithConfirmation).toHaveBeenCalled();
      expect(deps.signSilently).not.toHaveBeenCalled();
    });

    it('mints in autonomous mode through silent signer', async () => {
      const result = await service.mint(
        makeIntent({ mode: 'autonomous' }),
        'mcp-nmh'
      );
      expect(result.ok).toBe(true);
      expect(deps.signSilently).toHaveBeenCalled();
      expect(deps.signWithConfirmation).not.toHaveBeenCalled();
    });

    it('records the spend (postage + tip + fee) on success', async () => {
      await service.mint(makeIntent({ feeRate: 5 }), 'popup');
      // 546 postage + 0 tip + (5 × 150) fee = 1296
      expect(deps.recordSpend).toHaveBeenCalledWith(1296);
    });
  });

  describe('autonomous rejections surface as typed RPC denials (no downgrade)', () => {

    it('returns "transport-not-trusted-for-autonomous" when caller declared autonomous from popup', async () => {
      const result = await service.mint(
        makeIntent({ mode: 'autonomous' }),
        'popup'
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.value.reason).toBe('transport-not-trusted-for-autonomous');
      // The popup-confirm signer must NOT have fired.
      expect(deps.signWithConfirmation).not.toHaveBeenCalled();
      expect(deps.signSilently).not.toHaveBeenCalled();
    });

    it('returns "agent-disabled" when caller declared autonomous but agent mode is off', async () => {
      deps = makeDeps({ agentMode: { enabled: false } });
      service = new Cat21RpcService(deps);
      const result = await service.mint(
        makeIntent({ mode: 'autonomous' }),
        'mcp-nmh'
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.value.reason).toBe('agent-disabled');
    });

    it('returns "policy-denied" with detail when policy gate denies', async () => {
      deps = makeDeps({
        evaluateAgentPolicy: vi.fn(() => ({
          allowed: false as const,
          reason: 'spend-above-action-cap',
          detail: '21000 > 10000',
        })),
      });
      service = new Cat21RpcService(deps);
      const result = await service.mint(
        makeIntent({ mode: 'autonomous' }),
        'mcp-nmh'
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.reason).toBe('policy-denied');
        expect(result.value.detail).toContain('spend-above-action-cap');
      }
    });

    it('does NOT fall through to the popup-confirmation path on autonomous rejection', async () => {
      const result = await service.mint(
        makeIntent({ mode: 'autonomous' }),
        'popup' // wrong transport for autonomous
      );
      expect(result.ok).toBe(false);
      expect(deps.signWithConfirmation).not.toHaveBeenCalled();
      expect(deps.signSilently).not.toHaveBeenCalled();
    });
  });

  describe('intent-invariant violations bubble up as typed denials', () => {

    it('returns "intent-invariant-violated" on bad recipient address', async () => {
      const result = await service.mint(
        makeIntent({ recipient: 'not-a-real-address' }),
        'popup'
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.reason).toBe('intent-invariant-violated');
        expect(result.value.detail).toContain('recipient-not-a-bitcoin-address');
      }
    });

    it('returns "intent-invariant-violated" on non-positive feeRate', async () => {
      const result = await service.mint(makeIntent({ feeRate: 0 }), 'popup');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.reason).toBe('intent-invariant-violated');
        expect(result.value.detail).toContain('fee-rate-not-positive');
      }
    });

    it('returns "intent-invariant-violated" when funding picker throws', async () => {
      deps = makeDeps({
        pickFundingUtxo: vi.fn(() => {
          throw new Error('no UTXO covers 1296 sats');
        }),
      });
      service = new Cat21RpcService(deps);
      const result = await service.mint(makeIntent(), 'popup');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.reason).toBe('intent-invariant-violated');
        expect(result.value.detail).toContain('funding-pick-failed');
      }
    });
  });

  describe('signer / broadcast failures surface as broadcast-failed', () => {

    it('returns "broadcast-failed" when the signer throws', async () => {
      deps = makeDeps({
        signWithConfirmation: vi.fn(() =>
          Promise.reject(new Error('user cancelled'))
        ),
      });
      service = new Cat21RpcService(deps);
      const result = await service.mint(makeIntent(), 'popup');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.reason).toBe('broadcast-failed');
        expect(result.value.detail).toContain('user cancelled');
      }
    });

    it('returns "broadcast-failed" when the broadcaster throws', async () => {
      deps = makeDeps({
        broadcast: vi.fn(() => Promise.reject(new Error('mempool rejected'))),
      });
      service = new Cat21RpcService(deps);
      const result = await service.mint(makeIntent(), 'popup');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.reason).toBe('broadcast-failed');
        expect(result.value.detail).toContain('mempool rejected');
      }
    });

    it('does NOT record spend when broadcast fails', async () => {
      deps = makeDeps({
        broadcast: vi.fn(() => Promise.reject(new Error('mempool rejected'))),
      });
      service = new Cat21RpcService(deps);
      await service.mint(makeIntent(), 'popup');
      expect(deps.recordSpend).not.toHaveBeenCalled();
    });
  });

  describe('pipeline ordering', () => {

    it('runs invariants BEFORE consulting the agent policy', async () => {
      const result = await service.mint(makeIntent({ feeRate: 0 }), 'popup');
      expect(result.ok).toBe(false);
      expect(deps.evaluateAgentPolicy).not.toHaveBeenCalled();
    });

    it('resolves mode BEFORE building the PSBT', async () => {
      // Autonomous rejection on popup transport must skip the UTXO picker.
      await service.mint(makeIntent({ mode: 'autonomous' }), 'popup');
      expect(deps.pickFundingUtxo).not.toHaveBeenCalled();
    });

    it('signs BEFORE broadcasting (broadcast not called on signer failure)', async () => {
      deps = makeDeps({
        signWithConfirmation: vi.fn(() =>
          Promise.reject(new Error('user cancelled'))
        ),
      });
      service = new Cat21RpcService(deps);
      await service.mint(makeIntent(), 'popup');
      expect(deps.broadcast).not.toHaveBeenCalled();
    });
  });

  describe('transport hygiene', () => {

    it('passes transport through to the mode resolver verbatim', async () => {
      // Cover both transports by triggering policy denial on each; the
      // resulting denial reason is deterministic regardless of transport
      // when the policy itself denies, but the rejection from "transport
      // wrong for autonomous" requires popup transport.
      const popupResult = await service.mint(
        makeIntent({ mode: 'autonomous' }),
        'popup'
      );
      expect(
        popupResult.ok === false &&
          popupResult.value.reason === 'transport-not-trusted-for-autonomous'
      ).toBe(true);

      const nmhResult = await service.mint(
        makeIntent({ mode: 'autonomous' }),
        'mcp-nmh'
      );
      expect(nmhResult.ok).toBe(true);
    });
  });

  it('passes a Cat21Intent (Cat21MintIntent in particular) to evaluateAgentPolicy', async () => {
    await service.mint(
      makeIntent({ mode: 'autonomous', feeRate: 7 }),
      'mcp-nmh'
    );
    expect(deps.evaluateAgentPolicy).toHaveBeenCalledTimes(1);
    const passedIntent = deps.evaluateAgentPolicy.mock.calls[0][0] as Cat21Intent;
    // TS compile-time check that the type is the union, runtime that the
    // mint shape is preserved.
    expect(passedIntent).toMatchObject({ feeRate: 7, mode: 'autonomous' });
  });
});

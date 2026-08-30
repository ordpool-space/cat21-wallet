import { hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import { CAT21_POSTAGE_SATS, getDummyKeypair } from 'ordpool-sdk/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Cat21OfferValidation } from './builders/accept-offer-validator';
import {
  BroadcastResult,
  Cat21AccountContext,
  Cat21FundingUtxo,
  Cat21RpcDeps,
  Cat21RpcService,
  SignedTx,
} from './cat21-rpc.service';
import type {
  Cat21AcceptOfferIntent,
  Cat21BuyIntent,
  Cat21CreateOfferIntent,
  Cat21Intent,
  Cat21MintIntent,
  Cat21TransferIntent,
} from './types';

// Use the SDK's well-known dummy keypair so the fee-simulation path's
// `signIdx(dummyPrivateKey, …) + finalize` can produce a valid
// finalized tx for vsize measurement. Production uses a real
// keychain key; the simulation in cat21-fee-simulation.ts always
// dummy-signs with this exact key.
const { dummyPublicKey } = getDummyKeypair(btc.NETWORK);
const p2wpkhMainnet = btc.p2wpkh(dummyPublicKey, btc.NETWORK);

// A different valid mainnet P2WPKH for the account context, so the
// SDK gate's self-send check (recipient !== ownPaymentAddress) doesn't
// trip on the test fixture. Derived from a different fixed key so the
// address is distinct from the dummy-keypair recipient.
const accountKey = hex.decode('030000000000000000000000000000000000000000000000000000000000000003');
const p2wpkhAccount = btc.p2wpkh(accountKey, btc.NETWORK);
const ACCOUNT_PAYMENT_ADDR = p2wpkhAccount.address!;

// Taproot ordinals (receive) address for the buy flow — where a bought
// cat lands. x-only key derived from the dummy keypair's 33-byte pubkey.
const ACCOUNT_ORDINALS_ADDR = btc.p2tr(dummyPublicKey.slice(1), undefined, btc.NETWORK).address!;

function defaultAccountCtx(): Cat21AccountContext {
  return {
    paymentAddress: ACCOUNT_PAYMENT_ADDR,
    // 33-byte compressed pubkey for ACCOUNT_PAYMENT_ADDR (p2wpkh of accountKey).
    paymentPublicKey: hex.encode(accountKey),
    ordinalsAddress: ACCOUNT_ORDINALS_ADDR,
    // dummy pubkey; the SDK x-only-strips it to match ACCOUNT_ORDINALS_ADDR.
    ordinalsPublicKey: hex.encode(dummyPublicKey),
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

const VALID_CAT_ID = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefi0';

function defaultCatUtxo() {
  return {
    txid: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
    vout: 0,
    value: 546,
    scriptPubKey: p2wpkhMainnet.script,
  };
}

function makeTransferIntent(overrides: Partial<Cat21TransferIntent> = {}): Cat21TransferIntent {
  return {
    catId: VALID_CAT_ID,
    recipient: p2wpkhMainnet.address!,
    feeRate: 5,
    ...overrides,
  };
}

function makeIntent(overrides: Partial<Cat21MintIntent> = {}): Cat21MintIntent {
  return {
    recipient: p2wpkhMainnet.address!,
    feeRate: 5,
    ...overrides,
  };
}

function makeBuyIntent(overrides: Partial<Cat21BuyIntent> = {}): Cat21BuyIntent {
  return {
    catId: VALID_CAT_ID,
    catNumber: 42,
    bidSats: 21_000,
    // A valid mainnet address distinct from the buyer's own addresses.
    sellerPaymentAddress: p2wpkhMainnet.address!,
    feeRate: 5,
    ...overrides,
  };
}

interface SpyDeps extends Cat21RpcDeps {
  getAccountContext: ReturnType<typeof vi.fn> & Cat21RpcDeps['getAccountContext'];
  evaluateAgentPolicy: ReturnType<typeof vi.fn> & Cat21RpcDeps['evaluateAgentPolicy'];
  pickFundingUtxo: ReturnType<typeof vi.fn> & Cat21RpcDeps['pickFundingUtxo'];
  spendableUtxos: ReturnType<typeof vi.fn> & Cat21RpcDeps['spendableUtxos'];
  classifyOutpoint: ReturnType<typeof vi.fn> & Cat21RpcDeps['classifyOutpoint'];
  resolveCatUtxo: ReturnType<typeof vi.fn> & Cat21RpcDeps['resolveCatUtxo'];
  confirmListingPublication: ReturnType<typeof vi.fn> & Cat21RpcDeps['confirmListingPublication'];
  validateBuyOfferPsbt: ReturnType<typeof vi.fn> & Cat21RpcDeps['validateBuyOfferPsbt'];
  signWithConfirmation: ReturnType<typeof vi.fn> & Cat21RpcDeps['signWithConfirmation'];
  signSilently: ReturnType<typeof vi.fn> & Cat21RpcDeps['signSilently'];
  signBuyOfferInputs: ReturnType<typeof vi.fn> & Cat21RpcDeps['signBuyOfferInputs'];
  postBid: ReturnType<typeof vi.fn> & Cat21RpcDeps['postBid'];
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
    // One clean funding coin covering postage + fee. The core does its
    // own content-checked selection + two-pass fee over this list.
    spendableUtxos: vi.fn(() =>
      Promise.resolve([{ txid: defaultUtxo().txid, vout: 0, value: 50_000 }])
    ),
    classifyOutpoint: vi.fn(() => Promise.resolve('clean' as const)),
    resolveCatUtxo: vi.fn(() => defaultCatUtxo()),
    confirmListingPublication: vi.fn(() => Promise.resolve()),
    validateBuyOfferPsbt: vi.fn(
      (): Cat21OfferValidation => ({ ok: true, pricePaidSats: 100_000, postageSats: 546 })
    ),
    signWithConfirmation: vi.fn(() => Promise.resolve(signedTx)),
    signSilently: vi.fn(() => Promise.resolve(signedTx)),
    // Buy-offer signer default: echo a small non-empty PSBT byte array
    // (the service only base64-encodes it, never re-parses). Distinct
    // sentinel bytes so a positive-equality assert catches leaks.
    signBuyOfferInputs: vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3, 4]))),
    postBid: vi.fn(() => Promise.resolve()),
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
      if (result.ok && result.value.kind === 'broadcast') {
        expect(result.value.txid).toBe('tx-abc');
        expect(result.value.channel).toBe('mempool');
      } else {
        throw new Error('expected broadcast success');
      }
      expect(deps.signWithConfirmation).toHaveBeenCalled();
      expect(deps.signSilently).not.toHaveBeenCalled();
    });

    it('mints in autonomous mode through silent signer', async () => {
      const result = await service.mint(makeIntent({ mode: 'autonomous' }), 'mcp-nmh');
      expect(result.ok).toBe(true);
      expect(deps.signSilently).toHaveBeenCalled();
      expect(deps.signWithConfirmation).not.toHaveBeenCalled();
    });

    it('records the spend (postage + tip + realised fee) on success', async () => {
      await service.mint(makeIntent({ feeRate: 5 }), 'popup');
      // executeMint returns the realised fee; recordSpend = 546 postage +
      // 0 tip + that fee, so it's strictly above the bare postage.
      expect(deps.recordSpend).toHaveBeenCalledTimes(1);
      expect(deps.recordSpend.mock.calls[0][0]).toBeGreaterThan(CAT21_POSTAGE_SATS);
    });

    it('mints via content-checked core selection (spendableUtxos + clean scan)', async () => {
      const result = await service.mint(makeIntent(), 'popup');
      expect(result.ok).toBe(true);
      // The core selects over the wallet's spendable bucket; the legacy
      // size-heuristic pickFundingUtxo is no longer on the mint path.
      expect(deps.spendableUtxos).toHaveBeenCalled();
      expect(deps.pickFundingUtxo).not.toHaveBeenCalled();
    });
  });

  describe('autonomous rejections surface as typed RPC denials (no downgrade)', () => {
    it('returns "transport-not-trusted-for-autonomous" when caller declared autonomous from popup', async () => {
      const result = await service.mint(makeIntent({ mode: 'autonomous' }), 'popup');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.value.reason).toBe('transport-not-trusted-for-autonomous');
      // The popup-confirm signer must NOT have fired.
      expect(deps.signWithConfirmation).not.toHaveBeenCalled();
      expect(deps.signSilently).not.toHaveBeenCalled();
    });

    it('returns "agent-disabled" when caller declared autonomous but agent mode is off', async () => {
      deps = makeDeps({ agentMode: { enabled: false } });
      service = new Cat21RpcService(deps);
      const result = await service.mint(makeIntent({ mode: 'autonomous' }), 'mcp-nmh');
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
      const result = await service.mint(makeIntent({ mode: 'autonomous' }), 'mcp-nmh');
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
      const result = await service.mint(makeIntent({ recipient: 'not-a-real-address' }), 'popup');
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

    it('returns "intent-invariant-violated: funding-pick-failed" when nothing covers', async () => {
      deps = makeDeps({ spendableUtxos: vi.fn(() => Promise.resolve([])) });
      service = new Cat21RpcService(deps);
      const result = await service.mint(makeIntent(), 'popup');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.reason).toBe('intent-invariant-violated');
        expect(result.value.detail).toContain('funding-pick-failed');
      }
    });

    it('returns "funding-pick-failed" when only asset-carrying coins cover (content scan)', async () => {
      // The one coin covers, but the content scan flags it as carrying an
      // asset — the core refuses to auto-spend it (expert-required).
      deps = makeDeps({ classifyOutpoint: vi.fn(() => Promise.resolve('has-assets' as const)) });
      service = new Cat21RpcService(deps);
      const result = await service.mint(makeIntent(), 'popup');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.reason).toBe('intent-invariant-violated');
        expect(result.value.detail).toContain('funding-pick-failed');
      }
    });

    it('returns "intent-invariant-violated: no-payment-public-key" when the pubkey is absent', async () => {
      deps = makeDeps({
        getAccountContext: vi.fn(() => ({
          paymentAddress: ACCOUNT_PAYMENT_ADDR,
          network: 'mainnet' as const,
        })),
      });
      service = new Cat21RpcService(deps);
      const result = await service.mint(makeIntent(), 'popup');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.reason).toBe('intent-invariant-violated');
        expect(result.value.detail).toContain('no-payment-public-key');
      }
      expect(deps.spendableUtxos).not.toHaveBeenCalled();
    });
  });

  describe('signer / broadcast failures surface as broadcast-failed', () => {
    it('returns "broadcast-failed" when the signer throws', async () => {
      deps = makeDeps({
        signWithConfirmation: vi.fn(() => Promise.reject(new Error('user cancelled'))),
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

    it('resolves mode BEFORE selecting funding', async () => {
      // Autonomous rejection on popup transport must skip core selection.
      await service.mint(makeIntent({ mode: 'autonomous' }), 'popup');
      expect(deps.spendableUtxos).not.toHaveBeenCalled();
    });

    it('signs BEFORE broadcasting (broadcast not called on signer failure)', async () => {
      deps = makeDeps({
        signWithConfirmation: vi.fn(() => Promise.reject(new Error('user cancelled'))),
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
      const popupResult = await service.mint(makeIntent({ mode: 'autonomous' }), 'popup');
      expect(
        popupResult.ok === false &&
          popupResult.value.reason === 'transport-not-trusted-for-autonomous'
      ).toBe(true);

      const nmhResult = await service.mint(makeIntent({ mode: 'autonomous' }), 'mcp-nmh');
      expect(nmhResult.ok).toBe(true);
    });
  });

  it('passes a Cat21Intent (Cat21MintIntent in particular) to evaluateAgentPolicy', async () => {
    await service.mint(makeIntent({ mode: 'autonomous', feeRate: 7 }), 'mcp-nmh');
    expect(deps.evaluateAgentPolicy).toHaveBeenCalledTimes(1);
    const passedIntent = deps.evaluateAgentPolicy.mock.calls[0][0] as Cat21Intent;
    // TS compile-time check that the type is the union, runtime that the
    // mint shape is preserved.
    expect(passedIntent).toMatchObject({ feeRate: 7, mode: 'autonomous' });
  });
});

describe('Cat21RpcService.transfer', () => {
  let deps: SpyDeps;
  let service: Cat21RpcService;

  beforeEach(() => {
    deps = makeDeps();
    service = new Cat21RpcService(deps);
  });

  describe('happy paths', () => {
    it('transfers in manual mode through popup-confirm signer', async () => {
      const result = await service.transfer(makeTransferIntent(), 'popup');
      expect(result.ok).toBe(true);
      if (result.ok && result.value.kind === 'broadcast') {
        expect(result.value.txid).toBe('tx-abc');
      } else {
        throw new Error('expected broadcast success');
      }
      expect(deps.signWithConfirmation).toHaveBeenCalled();
      expect(deps.signSilently).not.toHaveBeenCalled();
    });

    it('transfers in autonomous mode through silent signer', async () => {
      const result = await service.transfer(makeTransferIntent({ mode: 'autonomous' }), 'mcp-nmh');
      expect(result.ok).toBe(true);
      expect(deps.signSilently).toHaveBeenCalled();
      expect(deps.signWithConfirmation).not.toHaveBeenCalled();
    });

    it('funds the fee via content-checked core selection (spendableUtxos, not pickFundingUtxo)', async () => {
      // The cat UTXO rides input 0 preserved; the fee comes from a
      // funding coin the SDK core selects over the spendable bucket —
      // the legacy size-heuristic pickFundingUtxo is off the transfer path.
      await service.transfer(makeTransferIntent(), 'popup');
      expect(deps.spendableUtxos).toHaveBeenCalled();
      expect(deps.pickFundingUtxo).not.toHaveBeenCalled();
    });
  });

  describe('autonomous rejections surface as typed RPC denials (no downgrade)', () => {
    it('returns "transport-not-trusted-for-autonomous" on popup transport', async () => {
      const result = await service.transfer(makeTransferIntent({ mode: 'autonomous' }), 'popup');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.value.reason).toBe('transport-not-trusted-for-autonomous');
      expect(deps.signWithConfirmation).not.toHaveBeenCalled();
      expect(deps.signSilently).not.toHaveBeenCalled();
    });

    it('returns "agent-disabled" when agent mode is off', async () => {
      deps = makeDeps({ agentMode: { enabled: false } });
      service = new Cat21RpcService(deps);
      const result = await service.transfer(makeTransferIntent({ mode: 'autonomous' }), 'mcp-nmh');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.value.reason).toBe('agent-disabled');
    });

    it('returns "policy-denied" with detail when policy gate denies', async () => {
      deps = makeDeps({
        evaluateAgentPolicy: vi.fn(() => ({
          allowed: false as const,
          reason: 'counterparty-not-allowlisted',
          detail: 'bc1qfoo',
        })),
      });
      service = new Cat21RpcService(deps);
      const result = await service.transfer(makeTransferIntent({ mode: 'autonomous' }), 'mcp-nmh');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.reason).toBe('policy-denied');
        expect(result.value.detail).toContain('counterparty-not-allowlisted');
      }
    });
  });

  describe('intent-invariant violations bubble up as typed denials', () => {
    it('returns "intent-invariant-violated" on malformed catId', async () => {
      const result = await service.transfer(makeTransferIntent({ catId: 'not-a-cat-id' }), 'popup');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.reason).toBe('intent-invariant-violated');
        expect(result.value.detail).toContain('cat-id-malformed');
      }
    });

    it('returns "intent-invariant-violated" on bad recipient', async () => {
      const result = await service.transfer(
        makeTransferIntent({ recipient: 'not-a-real-address' }),
        'popup'
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.reason).toBe('intent-invariant-violated');
        expect(result.value.detail).toContain('recipient-not-a-bitcoin-address');
      }
    });

    it('returns "intent-invariant-violated" when cat UTXO resolution fails', async () => {
      deps = makeDeps({
        resolveCatUtxo: vi.fn(() => {
          throw new Error('cat not owned by active account');
        }),
      });
      service = new Cat21RpcService(deps);
      const result = await service.transfer(makeTransferIntent(), 'popup');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.reason).toBe('intent-invariant-violated');
        expect(result.value.detail).toContain('cat-utxo-resolve-failed');
      }
    });

    it('returns "intent-invariant-violated: funding-pick-failed" when nothing covers the fee', async () => {
      deps = makeDeps({ spendableUtxos: vi.fn(() => Promise.resolve([])) });
      service = new Cat21RpcService(deps);
      const result = await service.transfer(makeTransferIntent(), 'popup');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.reason).toBe('intent-invariant-violated');
        expect(result.value.detail).toContain('funding-pick-failed');
      }
    });
  });

  describe('signer / broadcast failures', () => {
    it('returns "broadcast-failed" when the signer throws', async () => {
      deps = makeDeps({
        signWithConfirmation: vi.fn(() => Promise.reject(new Error('user cancelled'))),
      });
      service = new Cat21RpcService(deps);
      const result = await service.transfer(makeTransferIntent(), 'popup');
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
      const result = await service.transfer(makeTransferIntent(), 'popup');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.value.reason).toBe('broadcast-failed');
    });

    it('does NOT record spend when broadcast fails', async () => {
      deps = makeDeps({
        broadcast: vi.fn(() => Promise.reject(new Error('mempool rejected'))),
      });
      service = new Cat21RpcService(deps);
      await service.transfer(makeTransferIntent(), 'popup');
      expect(deps.recordSpend).not.toHaveBeenCalled();
    });
  });

  describe('pipeline ordering', () => {
    it('runs invariants BEFORE consulting the agent policy', async () => {
      await service.transfer(makeTransferIntent({ catId: 'bad' }), 'popup');
      expect(deps.evaluateAgentPolicy).not.toHaveBeenCalled();
    });

    it('resolves mode BEFORE resolving the cat UTXO', async () => {
      // Autonomous rejection on popup transport must skip cat UTXO resolution.
      await service.transfer(makeTransferIntent({ mode: 'autonomous' }), 'popup');
      expect(deps.resolveCatUtxo).not.toHaveBeenCalled();
    });
  });

  it('passes a Cat21TransferIntent to evaluateAgentPolicy', async () => {
    await service.transfer(makeTransferIntent({ mode: 'autonomous', feeRate: 8 }), 'mcp-nmh');
    expect(deps.evaluateAgentPolicy).toHaveBeenCalledTimes(1);
    const passedIntent = deps.evaluateAgentPolicy.mock.calls[0][0] as Cat21Intent;
    expect(passedIntent).toMatchObject({
      feeRate: 8,
      mode: 'autonomous',
      catId: VALID_CAT_ID,
    });
  });
});

describe('Cat21RpcService.createOffer', () => {
  let deps: SpyDeps;
  let service: Cat21RpcService;

  beforeEach(() => {
    deps = makeDeps();
    service = new Cat21RpcService(deps);
  });

  function makeCreateOfferIntent(
    overrides: Partial<Cat21CreateOfferIntent> = {}
  ): Cat21CreateOfferIntent {
    return {
      catId: VALID_CAT_ID,
      priceSats: 100_000,
      paymentAddress: p2wpkhMainnet.address!,
      ...overrides,
    };
  }

  describe('happy paths', () => {
    it('returns a listing success on the happy path (manual mode, popup)', async () => {
      const result = await service.createOffer(makeCreateOfferIntent(), 'popup');
      expect(result.ok).toBe(true);
      if (result.ok && result.value.kind === 'listing') {
        expect(result.value.listing.catId).toBe(VALID_CAT_ID);
        expect(result.value.listing.priceSats).toBe(100_000);
      } else {
        throw new Error('expected listing success');
      }
      expect(deps.confirmListingPublication).toHaveBeenCalledTimes(1);
    });

    it('returns a listing success on the happy path (autonomous mode, mcp-nmh)', async () => {
      const result = await service.createOffer(
        makeCreateOfferIntent({ mode: 'autonomous' }),
        'mcp-nmh'
      );
      expect(result.ok).toBe(true);
      if (result.ok && result.value.kind === 'listing') {
        expect(result.value.listing.catId).toBe(VALID_CAT_ID);
      } else {
        throw new Error('expected listing success');
      }
      // Autonomous mode skips user confirmation.
      expect(deps.confirmListingPublication).not.toHaveBeenCalled();
    });

    it('emits all four listing fields (catId, sellerUtxo, priceSats, paymentAddress)', async () => {
      const result = await service.createOffer(makeCreateOfferIntent(), 'popup');
      if (result.ok && result.value.kind === 'listing') {
        expect(result.value.listing).toMatchObject({
          catId: VALID_CAT_ID,
          sellerUtxo: expect.objectContaining({
            txid: expect.any(String),
            vout: expect.any(Number),
          }),
          priceSats: 100_000,
          paymentAddress: p2wpkhMainnet.address!,
        });
      } else {
        throw new Error('expected listing success');
      }
    });
  });

  describe('autonomous rejections surface as typed RPC denials (no downgrade)', () => {
    it('returns "transport-not-trusted-for-autonomous" on popup transport', async () => {
      const result = await service.createOffer(
        makeCreateOfferIntent({ mode: 'autonomous' }),
        'popup'
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.value.reason).toBe('transport-not-trusted-for-autonomous');
      expect(deps.confirmListingPublication).not.toHaveBeenCalled();
    });

    it('returns "agent-disabled" when autonomous but agent mode off', async () => {
      deps = makeDeps({ agentMode: { enabled: false } });
      service = new Cat21RpcService(deps);
      const result = await service.createOffer(
        makeCreateOfferIntent({ mode: 'autonomous' }),
        'mcp-nmh'
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.value.reason).toBe('agent-disabled');
    });

    it('returns "policy-denied" with detail when policy gate denies', async () => {
      deps = makeDeps({
        evaluateAgentPolicy: vi.fn(() => ({
          allowed: false as const,
          reason: 'floor-price-violation',
          detail: '100000 < 200000',
        })),
      });
      service = new Cat21RpcService(deps);
      const result = await service.createOffer(
        makeCreateOfferIntent({ mode: 'autonomous' }),
        'mcp-nmh'
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.reason).toBe('policy-denied');
        expect(result.value.detail).toContain('floor-price-violation');
      }
    });
  });

  describe('intent-invariant violations bubble up as typed denials', () => {
    it('returns "intent-invariant-violated" on malformed catId', async () => {
      const result = await service.createOffer(
        makeCreateOfferIntent({ catId: 'not-a-cat-id' }),
        'popup'
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.reason).toBe('intent-invariant-violated');
        expect(result.value.detail).toContain('cat-id-malformed');
      }
    });

    it('returns "intent-invariant-violated" on bad payment address', async () => {
      const result = await service.createOffer(
        makeCreateOfferIntent({ paymentAddress: 'not-an-address' }),
        'popup'
      );
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.value.detail).toContain('payment-address-not-a-bitcoin-address');
    });

    it('accepts a below-dust price (seller nets price + their cat UTXO, always >= dust)', async () => {
      // The SDK dropped the price-below-postage-floor gate: a below-dust PRICE is
      // legal because the seller is paid price + sellerInput.value, which always
      // clears dust. Low-price protection is the per-account agent-policy floor,
      // not a hard invariant.
      const result = await service.createOffer(makeCreateOfferIntent({ priceSats: 100 }), 'popup');
      expect(result.ok).toBe(true);
    });

    it('returns "intent-invariant-violated" when wallet does not own the cat', async () => {
      deps = makeDeps({
        resolveCatUtxo: vi.fn(() => {
          throw new Error('cat not owned by active account');
        }),
      });
      service = new Cat21RpcService(deps);
      const result = await service.createOffer(makeCreateOfferIntent(), 'popup');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.value.detail).toContain('cat-utxo-resolve-failed');
    });
  });

  describe('publish flow', () => {
    it('returns "broadcast-failed" with listing-cancelled detail when user cancels in manual mode', async () => {
      deps = makeDeps({
        confirmListingPublication: vi.fn(() => Promise.reject(new Error('user cancelled'))),
      });
      service = new Cat21RpcService(deps);
      const result = await service.createOffer(makeCreateOfferIntent(), 'popup');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.reason).toBe('broadcast-failed');
        expect(result.value.detail).toContain('listing-cancelled');
      }
    });

    it('does NOT call broadcast (listings never broadcast)', async () => {
      await service.createOffer(makeCreateOfferIntent(), 'popup');
      expect(deps.broadcast).not.toHaveBeenCalled();
    });

    it('does NOT call signWithConfirmation or signSilently (no signature needed)', async () => {
      await service.createOffer(makeCreateOfferIntent(), 'popup');
      expect(deps.signWithConfirmation).not.toHaveBeenCalled();
      expect(deps.signSilently).not.toHaveBeenCalled();
    });

    it('does NOT call recordSpend (no satoshis leave the wallet)', async () => {
      await service.createOffer(makeCreateOfferIntent(), 'popup');
      expect(deps.recordSpend).not.toHaveBeenCalled();
    });
  });

  describe('pipeline ordering', () => {
    it('runs invariants BEFORE consulting the agent policy', async () => {
      await service.createOffer(makeCreateOfferIntent({ catId: 'bad' }), 'popup');
      expect(deps.evaluateAgentPolicy).not.toHaveBeenCalled();
    });

    it('resolves mode BEFORE resolving the cat UTXO', async () => {
      // Autonomous over popup → mode reject → cat lookup skipped.
      await service.createOffer(makeCreateOfferIntent({ mode: 'autonomous' }), 'popup');
      expect(deps.resolveCatUtxo).not.toHaveBeenCalled();
    });

    it('resolves cat UTXO BEFORE asking for manual confirmation', async () => {
      deps = makeDeps({
        resolveCatUtxo: vi.fn(() => {
          throw new Error('cat lookup failed');
        }),
      });
      service = new Cat21RpcService(deps);
      await service.createOffer(makeCreateOfferIntent(), 'popup');
      expect(deps.confirmListingPublication).not.toHaveBeenCalled();
    });
  });

  it('passes a Cat21CreateOfferIntent to evaluateAgentPolicy', async () => {
    await service.createOffer(
      makeCreateOfferIntent({ mode: 'autonomous', priceSats: 250_000 }),
      'mcp-nmh'
    );
    expect(deps.evaluateAgentPolicy).toHaveBeenCalledTimes(1);
    const passedIntent = deps.evaluateAgentPolicy.mock.calls[0][0] as Cat21Intent;
    expect(passedIntent).toMatchObject({
      catId: VALID_CAT_ID,
      priceSats: 250_000,
      mode: 'autonomous',
    });
  });
});

describe('Cat21RpcService.acceptOffer', () => {
  let deps: SpyDeps;
  let service: Cat21RpcService;

  // Build a real PSBT with the seller's cat input at index 0 and a
  // payment output at index 1 matching the wallet's payment address.
  function buildRealOfferPsbt(): string {
    const tx = new btc.Transaction({ allowUnknownInputs: true });
    tx.addInput({
      txid: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
      index: 0,
      witnessUtxo: { script: p2wpkhMainnet.script, amount: 546n },
      sighashType: btc.SigHash.ALL,
    });
    tx.addOutputAddress(p2wpkhMainnet.address!, 546n, btc.NETWORK);
    tx.addOutputAddress(p2wpkhMainnet.address!, 100_000n, btc.NETWORK);
    return hex.encode(tx.toPSBT());
  }

  function makeAcceptOfferIntent(
    overrides: Partial<Cat21AcceptOfferIntent> = {}
  ): Cat21AcceptOfferIntent {
    return {
      offerPsbt: buildRealOfferPsbt(),
      expectedCatId: VALID_CAT_ID,
      expectedPriceSats: 100_000,
      expectedSellerUtxo: {
        txid: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
        vout: 0,
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    deps = makeDeps();
    service = new Cat21RpcService(deps);
  });

  describe('happy paths', () => {
    it('accepts an offer in manual mode through popup-confirm signer', async () => {
      const result = await service.acceptOffer(makeAcceptOfferIntent(), 'popup');
      expect(result.ok).toBe(true);
      if (result.ok && result.value.kind === 'broadcast') {
        expect(result.value.txid).toBe('tx-abc');
      } else {
        throw new Error('expected broadcast success');
      }
      expect(deps.signWithConfirmation).toHaveBeenCalled();
      expect(deps.signSilently).not.toHaveBeenCalled();
    });

    it('accepts an offer in autonomous mode through silent signer', async () => {
      const result = await service.acceptOffer(
        makeAcceptOfferIntent({ mode: 'autonomous' }),
        'mcp-nmh'
      );
      expect(result.ok).toBe(true);
      expect(deps.signSilently).toHaveBeenCalled();
      expect(deps.signWithConfirmation).not.toHaveBeenCalled();
    });

    it('records spend=pricePaidSats (deal-size proxy for daily-cap policy)', async () => {
      await service.acceptOffer(makeAcceptOfferIntent(), 'popup');
      // SDK delegate returns pricePaidSats=100_000 in the default makeDeps;
      // matches intent.expectedPriceSats so we land on the ok path.
      expect(deps.recordSpend).toHaveBeenCalledWith(100_000);
    });
  });

  describe('autonomous rejections surface as typed RPC denials (no downgrade)', () => {
    it('returns "transport-not-trusted-for-autonomous" on popup transport', async () => {
      const result = await service.acceptOffer(
        makeAcceptOfferIntent({ mode: 'autonomous' }),
        'popup'
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.value.reason).toBe('transport-not-trusted-for-autonomous');
    });

    it('returns "agent-disabled" when autonomous but agent mode off', async () => {
      deps = makeDeps({ agentMode: { enabled: false } });
      service = new Cat21RpcService(deps);
      const result = await service.acceptOffer(
        makeAcceptOfferIntent({ mode: 'autonomous' }),
        'mcp-nmh'
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.value.reason).toBe('agent-disabled');
    });

    it('returns "policy-denied" when policy gate denies', async () => {
      deps = makeDeps({
        evaluateAgentPolicy: vi.fn(() => ({
          allowed: false as const,
          reason: 'counterparty-not-allowlisted',
        })),
      });
      service = new Cat21RpcService(deps);
      const result = await service.acceptOffer(
        makeAcceptOfferIntent({ mode: 'autonomous' }),
        'mcp-nmh'
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.value.reason).toBe('policy-denied');
    });
  });

  describe('intent-invariant violations bubble up as typed denials', () => {
    it('returns "intent-invariant-violated" on malformed expectedCatId', async () => {
      const result = await service.acceptOffer(
        makeAcceptOfferIntent({ expectedCatId: 'bad' }),
        'popup'
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.reason).toBe('intent-invariant-violated');
        expect(result.value.detail).toContain('expected-cat-id-malformed');
      }
    });

    it('returns "intent-invariant-violated" on a payload that is not a parseable PSBT', async () => {
      const result = await service.acceptOffer(
        makeAcceptOfferIntent({ offerPsbt: 'deadbeef' }),
        'popup'
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.value.detail).toContain('offer-psbt-missing-magic-bytes');
    });

    it('returns "intent-invariant-violated" when wallet cannot resolve the cat UTXO', async () => {
      deps = makeDeps({
        resolveCatUtxo: vi.fn(() => {
          throw new Error('cat not owned');
        }),
      });
      service = new Cat21RpcService(deps);
      const result = await service.acceptOffer(makeAcceptOfferIntent(), 'popup');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.value.detail).toContain('cat-utxo-resolve-failed');
    });
  });

  describe('inbound-offer-mismatch', () => {
    it('returns "inbound-offer-mismatch" when cat21-ord disagrees with intent.expectedSellerUtxo', async () => {
      deps = makeDeps({
        resolveCatUtxo: vi.fn(() => ({
          txid: '00'.repeat(32),
          vout: 9,
          value: 546,
          scriptPubKey: p2wpkhMainnet.script,
        })),
      });
      service = new Cat21RpcService(deps);
      const result = await service.acceptOffer(makeAcceptOfferIntent(), 'popup');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.reason).toBe('inbound-offer-mismatch');
        expect(result.value.detail).toContain('disagrees with on-chain cat location');
      }
    });

    it('returns "inbound-offer-mismatch" when SDK validator rejects the PSBT', async () => {
      deps = makeDeps({
        validateBuyOfferPsbt: vi.fn(
          (): Cat21OfferValidation => ({
            ok: false,
            reason: 'payment-output-wrong-address',
            detail: 'expected bc1qfoo, got bc1qbar',
          })
        ),
      });
      service = new Cat21RpcService(deps);
      const result = await service.acceptOffer(makeAcceptOfferIntent(), 'popup');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.reason).toBe('inbound-offer-mismatch');
        expect(result.value.detail).toContain('payment-output-wrong-address');
      }
    });

    it('returns "inbound-offer-mismatch" with reason=wrong-price when buyer underpays', async () => {
      deps = makeDeps({
        validateBuyOfferPsbt: vi.fn(
          (): Cat21OfferValidation => ({ ok: true, pricePaidSats: 90_000, postageSats: 546 })
        ),
      });
      service = new Cat21RpcService(deps);
      const result = await service.acceptOffer(makeAcceptOfferIntent(), 'popup');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.reason).toBe('inbound-offer-mismatch');
        expect(result.value.detail).toContain('wrong-price');
      }
    });

    it('ACCEPTS overpay: pricePaidSats > expectedPriceSats is a tip the seller pockets', async () => {
      deps = makeDeps({
        validateBuyOfferPsbt: vi.fn(
          (): Cat21OfferValidation => ({ ok: true, pricePaidSats: 110_000, postageSats: 546 })
        ),
      });
      service = new Cat21RpcService(deps);
      const result = await service.acceptOffer(makeAcceptOfferIntent(), 'popup');
      expect(result.ok).toBe(true);
    });
  });

  describe('signer / broadcast failures', () => {
    it('returns "broadcast-failed" on signer throw', async () => {
      deps = makeDeps({
        signWithConfirmation: vi.fn(() => Promise.reject(new Error('user cancelled'))),
      });
      service = new Cat21RpcService(deps);
      const result = await service.acceptOffer(makeAcceptOfferIntent(), 'popup');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.reason).toBe('broadcast-failed');
        expect(result.value.detail).toContain('user cancelled');
      }
    });

    it('returns "broadcast-failed" on broadcaster throw', async () => {
      deps = makeDeps({
        broadcast: vi.fn(() => Promise.reject(new Error('mempool rejected'))),
      });
      service = new Cat21RpcService(deps);
      const result = await service.acceptOffer(makeAcceptOfferIntent(), 'popup');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.value.reason).toBe('broadcast-failed');
    });
  });

  describe('signer scope (HARD RULE — only input 0)', () => {
    it('passes inputIndexes=[0] to signWithConfirmation in manual mode', async () => {
      await service.acceptOffer(makeAcceptOfferIntent(), 'popup');
      const callArgs = deps.signWithConfirmation.mock.calls[0];
      expect(callArgs[2]).toEqual([0]);
    });

    it('passes inputIndexes=[0] to signSilently in autonomous mode', async () => {
      await service.acceptOffer(makeAcceptOfferIntent({ mode: 'autonomous' }), 'mcp-nmh');
      const callArgs = deps.signSilently.mock.calls[0];
      expect(callArgs[1]).toEqual([0]);
    });
  });

  describe('pipeline ordering', () => {
    it('runs invariants BEFORE consulting the agent policy', async () => {
      await service.acceptOffer(makeAcceptOfferIntent({ expectedCatId: 'bad' }), 'popup');
      expect(deps.evaluateAgentPolicy).not.toHaveBeenCalled();
    });

    it('resolves mode BEFORE resolving the cat UTXO', async () => {
      await service.acceptOffer(
        makeAcceptOfferIntent({ mode: 'autonomous' }),
        'popup' // wrong transport
      );
      expect(deps.resolveCatUtxo).not.toHaveBeenCalled();
    });

    it('cat-UTXO resolution + SDK validation run BEFORE signing', async () => {
      deps = makeDeps({
        validateBuyOfferPsbt: vi.fn(
          (): Cat21OfferValidation => ({ ok: false, reason: 'sighash-not-all' })
        ),
      });
      service = new Cat21RpcService(deps);
      await service.acceptOffer(makeAcceptOfferIntent(), 'popup');
      expect(deps.signWithConfirmation).not.toHaveBeenCalled();
      expect(deps.broadcast).not.toHaveBeenCalled();
    });
  });
});

describe('Cat21RpcService.buy', () => {
  let deps: SpyDeps;
  let service: Cat21RpcService;

  beforeEach(() => {
    deps = makeDeps();
    service = new Cat21RpcService(deps);
  });

  describe('happy paths', () => {
    it('builds + buyer-signs + posts a bid, returns { kind: "bid" }', async () => {
      const result = await service.buy(makeBuyIntent(), 'popup');
      expect(result.ok).toBe(true);
      if (!result.ok || result.value.kind !== 'bid') throw new Error('expected bid success');
      expect(result.value.catNumber).toBe(42);
      expect(result.value.bidSats).toBe(21_000);
      // The seller cat UTXO the service pinned (from resolveCatUtxo).
      expect(result.value.catTxid).toBe(defaultCatUtxo().txid);
      expect(result.value.catVout).toBe(0);
      // base64 of the sentinel bytes [1,2,3,4] the signer returned.
      expect(result.value.psbtBase64).toBe('AQIDBA==');
      // Buyer inputs are 1..N — one funding UTXO ⇒ index [1]. Input 0
      // (the seller's cat) is NEVER signed by the buyer.
      const signArgs = deps.signBuyOfferInputs.mock.calls[0];
      expect(signArgs[1]).toEqual([1]);
      // Bid is broadcast to the Bazaar, not the chain.
      expect(deps.postBid).toHaveBeenCalledTimes(1);
      expect(deps.broadcast).not.toHaveBeenCalled();
    });

    it('posts the bid with the buyer/seller addresses + single-cat bundle', async () => {
      await service.buy(makeBuyIntent(), 'popup');
      const postArgs = deps.postBid.mock.calls[0][0];
      expect(postArgs).toMatchObject({
        network: 'mainnet',
        catTxid: defaultCatUtxo().txid,
        catVout: 0,
        cats: [42],
        headlineCatNumber: 42,
        bidSats: 21_000,
        buyerOrdinalsAddress: ACCOUNT_ORDINALS_ADDR,
        buyerPaymentAddress: ACCOUNT_PAYMENT_ADDR,
        sellerPaymentAddress: p2wpkhMainnet.address,
        psbtBase64: 'AQIDBA==',
      });
    });

    it('records the spend (bid + fee) on success', async () => {
      await service.buy(makeBuyIntent({ bidSats: 21_000 }), 'popup');
      expect(deps.recordSpend).toHaveBeenCalledTimes(1);
      // bidSats + a positive simulated fee.
      const recorded = deps.recordSpend.mock.calls[0][0];
      expect(recorded).toBeGreaterThan(21_000);
    });

    it('works in autonomous mode via the same no-finalize signer', async () => {
      const result = await service.buy(makeBuyIntent({ mode: 'autonomous' }), 'mcp-nmh');
      expect(result.ok).toBe(true);
      expect(deps.signBuyOfferInputs).toHaveBeenCalledTimes(1);
      expect(deps.postBid).toHaveBeenCalledTimes(1);
    });
  });

  describe('intent-invariant violations bubble up as typed denials', () => {
    it('denies when the account has no ordinals (taproot) address', async () => {
      deps = makeDeps({
        getAccountContext: vi.fn(() => ({
          paymentAddress: ACCOUNT_PAYMENT_ADDR,
          network: 'mainnet' as const,
        })),
      });
      service = new Cat21RpcService(deps);
      const result = await service.buy(makeBuyIntent(), 'popup');
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected denial');
      expect(result.value.reason).toBe('intent-invariant-violated');
      expect(result.value.detail).toContain('no-ordinals-address');
      expect(deps.signBuyOfferInputs).not.toHaveBeenCalled();
    });

    it('denies when the cat UTXO cannot be resolved on-chain', async () => {
      deps = makeDeps({
        resolveCatUtxo: vi.fn(() => {
          throw new Error('cat21-ord 404');
        }),
      });
      service = new Cat21RpcService(deps);
      const result = await service.buy(makeBuyIntent(), 'popup');
      expect(result).toMatchObject({
        ok: false,
        value: { reason: 'intent-invariant-violated' },
      });
      if (result.ok) throw new Error('expected denial');
      expect(result.value.detail).toContain('cat-utxo-resolve-failed');
      expect(deps.postBid).not.toHaveBeenCalled();
    });

    it('denies a malformed catId at the SDK gate (never signs)', async () => {
      const result = await service.buy(makeBuyIntent({ catId: 'not-a-cat' }), 'popup');
      expect(result).toMatchObject({
        ok: false,
        value: { reason: 'intent-invariant-violated' },
      });
      expect(deps.signBuyOfferInputs).not.toHaveBeenCalled();
    });

    it('denies when allowedOperations excludes buy', async () => {
      deps = makeDeps({
        getAccountContext: vi.fn(() => ({
          paymentAddress: ACCOUNT_PAYMENT_ADDR,
          ordinalsAddress: ACCOUNT_ORDINALS_ADDR,
          network: 'mainnet' as const,
          allowedOperations: ['mint'] as const,
        })),
      });
      service = new Cat21RpcService(deps);
      const result = await service.buy(makeBuyIntent(), 'popup');
      expect(result).toMatchObject({
        ok: false,
        value: { reason: 'intent-invariant-violated' },
      });
      if (result.ok) throw new Error('expected denial');
      expect(result.value.detail).toContain('operation-kind-not-allowed');
      expect(deps.signBuyOfferInputs).not.toHaveBeenCalled();
    });
  });

  describe('signer / bid-post failures surface as broadcast-failed', () => {
    it('maps a signer rejection to broadcast-failed (sign-failed)', async () => {
      deps = makeDeps({
        signBuyOfferInputs: vi.fn(() => Promise.reject(new Error('user cancelled'))),
      });
      service = new Cat21RpcService(deps);
      const result = await service.buy(makeBuyIntent(), 'popup');
      expect(result).toMatchObject({ ok: false, value: { reason: 'broadcast-failed' } });
      if (result.ok) throw new Error('expected denial');
      expect(result.value.detail).toContain('sign-failed');
      expect(deps.postBid).not.toHaveBeenCalled();
      expect(deps.recordSpend).not.toHaveBeenCalled();
    });

    it('maps a bid-post rejection to broadcast-failed (bid-post-failed)', async () => {
      deps = makeDeps({
        postBid: vi.fn(() => Promise.reject(new Error('rate-limited'))),
      });
      service = new Cat21RpcService(deps);
      const result = await service.buy(makeBuyIntent(), 'popup');
      expect(result).toMatchObject({ ok: false, value: { reason: 'broadcast-failed' } });
      if (result.ok) throw new Error('expected denial');
      expect(result.value.detail).toContain('bid-post-failed');
      // The signer ran, but the spend is NOT recorded on a failed post.
      expect(deps.signBuyOfferInputs).toHaveBeenCalledTimes(1);
      expect(deps.recordSpend).not.toHaveBeenCalled();
    });
  });

  describe('autonomous rejections surface as typed RPC denials (no downgrade)', () => {
    it('refuses autonomous buy when agent mode is disabled', async () => {
      deps = makeDeps({ agentMode: { enabled: false } });
      service = new Cat21RpcService(deps);
      const result = await service.buy(makeBuyIntent({ mode: 'autonomous' }), 'mcp-nmh');
      expect(result.ok).toBe(false);
      expect(deps.signBuyOfferInputs).not.toHaveBeenCalled();
      expect(deps.postBid).not.toHaveBeenCalled();
    });
  });
});

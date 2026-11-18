import type { AgentPolicy } from 'ordpool-sdk/core';
import { describe, expect, it, vi } from 'vitest';

import type { RootState } from '@app/store';
import { agentPolicySlice } from '@app/store/agent-policy/agent-policy.slice';

import { makeAgentPolicyDeps } from './agent-policy-deps';
import type {
  Cat21AcceptOfferIntent,
  Cat21BuyIntent,
  Cat21CreateOfferIntent,
  Cat21MintIntent,
  Cat21TransferIntent,
} from './types';

// The signing account's own addresses, and parties outside it. The allowlist
// matches exact strings, so distinct labels are enough.
const OWN_PAYMENT = 'own-payment-address';
const OWN_ORDINALS = 'own-ordinals-address';
const LISTED = 'listed-counterparty-address';
const FOREIGN = 'foreign-unlisted-address';

function policy(overrides: Partial<AgentPolicy> = {}): AgentPolicy {
  return {
    enabled: true,
    maxSpendPerActionSats: 10_000,
    dailyCapSats: 100_000,
    maxFeeRateSatPerVbyte: 50,
    floorPriceSatsPerCat: 21_000,
    allowedCounterparties: [],
    ...overrides,
  };
}

function mintIntent(overrides: Partial<Cat21MintIntent> = {}): Cat21MintIntent {
  return {
    recipient: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
    feeRate: 5,
    mode: 'autonomous',
    ...overrides,
  };
}

function createOfferIntent(
  overrides: Partial<Cat21CreateOfferIntent> = {}
): Cat21CreateOfferIntent {
  return {
    catId: 'abc',
    priceSats: 50_000,
    paymentAddress: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
    mode: 'autonomous',
    ...overrides,
  };
}

function rootWith(state: ReturnType<typeof agentPolicySlice.reducer>): RootState {
  return { agentPolicy: state } as unknown as RootState;
}

describe('makeAgentPolicyDeps', () => {
  describe('agentMode.enabled', () => {
    it('reflects the stored policy.enabled for the active account', () => {
      let state = agentPolicySlice.reducer(undefined, { type: 'noop' });
      const deps = makeAgentPolicyDeps({
        getState: () => rootWith(state),
        dispatch: vi.fn(),
        accountId: 'acct-a',
        dayKeyFn: () => '2026-06-17',
        getOwnAddresses: () => [OWN_PAYMENT, OWN_ORDINALS],
      });

      expect(deps.agentMode.enabled).toBe(false);

      state = agentPolicySlice.reducer(
        state,
        agentPolicySlice.actions.setPolicyForAccount({
          accountId: 'acct-a',
          policy: policy({ enabled: true }),
        })
      );
      expect(deps.agentMode.enabled).toBe(true);

      state = agentPolicySlice.reducer(
        state,
        agentPolicySlice.actions.setPolicyForAccount({
          accountId: 'acct-a',
          policy: policy({ enabled: false }),
        })
      );
      expect(deps.agentMode.enabled).toBe(false);
    });
  });

  describe('evaluateAgentPolicy', () => {
    it('returns allowed when no policy exists (no caps to enforce)', () => {
      // A missing policy means no caps are configured, so there is nothing to
      // deny at the cap gate. This does NOT open an autonomous hole: the mode
      // resolver's agentMode.enabled guard is false without a policy, so an
      // autonomous request is still rejected; a manual request proceeds to the
      // human-confirm dialog.
      const state = agentPolicySlice.reducer(undefined, { type: 'noop' });
      const deps = makeAgentPolicyDeps({
        getState: () => rootWith(state),
        dispatch: vi.fn(),
        accountId: 'acct-a',
        dayKeyFn: () => '2026-06-17',
        getOwnAddresses: () => [OWN_PAYMENT, OWN_ORDINALS],
      });
      expect(deps.evaluateAgentPolicy(mintIntent())).toEqual({ allowed: true });
    });

    it('enforces caps even when the stored policy has enabled: false (caps bind manual)', () => {
      // A user who configured caps then turned agent mode OFF still has those
      // caps enforced on a manual action. enabled gates silent-sign, not the
      // caps: a 5 sat/vB mint trips a 4 sat/vB ceiling regardless.
      const state = agentPolicySlice.reducer(
        undefined,
        agentPolicySlice.actions.setPolicyForAccount({
          accountId: 'acct-a',
          policy: policy({ enabled: false, maxFeeRateSatPerVbyte: 4 }),
        })
      );
      const deps = makeAgentPolicyDeps({
        getState: () => rootWith(state),
        dispatch: vi.fn(),
        accountId: 'acct-a',
        dayKeyFn: () => '2026-06-17',
        getOwnAddresses: () => [OWN_PAYMENT, OWN_ORDINALS],
      });
      expect(deps.evaluateAgentPolicy(mintIntent({ feeRate: 5 }))).toMatchObject({
        allowed: false,
        reason: 'fee-rate-above-ceiling',
      });
    });

    it('allows an in-cap action under an enabled: false policy (enabled does not gate the caps)', () => {
      const state = agentPolicySlice.reducer(
        undefined,
        agentPolicySlice.actions.setPolicyForAccount({
          accountId: 'acct-a',
          policy: policy({ enabled: false, maxFeeRateSatPerVbyte: 50 }),
        })
      );
      const deps = makeAgentPolicyDeps({
        getState: () => rootWith(state),
        dispatch: vi.fn(),
        accountId: 'acct-a',
        dayKeyFn: () => '2026-06-17',
        getOwnAddresses: () => [OWN_PAYMENT, OWN_ORDINALS],
      });
      expect(deps.evaluateAgentPolicy(mintIntent({ feeRate: 5 }))).toEqual({ allowed: true });
    });

    it('allows a mint when the fee-rate is under the policy ceiling', () => {
      const state = agentPolicySlice.reducer(
        undefined,
        agentPolicySlice.actions.setPolicyForAccount({
          accountId: 'acct-a',
          policy: policy({ enabled: true, maxFeeRateSatPerVbyte: 50 }),
        })
      );
      const deps = makeAgentPolicyDeps({
        getState: () => rootWith(state),
        dispatch: vi.fn(),
        accountId: 'acct-a',
        dayKeyFn: () => '2026-06-17',
        getOwnAddresses: () => [OWN_PAYMENT, OWN_ORDINALS],
      });
      expect(deps.evaluateAgentPolicy(mintIntent({ feeRate: 30 }))).toEqual({ allowed: true });
    });

    it('denies a mint when the fee-rate exceeds the policy ceiling', () => {
      const state = agentPolicySlice.reducer(
        undefined,
        agentPolicySlice.actions.setPolicyForAccount({
          accountId: 'acct-a',
          policy: policy({ enabled: true, maxFeeRateSatPerVbyte: 4 }),
        })
      );
      const deps = makeAgentPolicyDeps({
        getState: () => rootWith(state),
        dispatch: vi.fn(),
        accountId: 'acct-a',
        dayKeyFn: () => '2026-06-17',
        getOwnAddresses: () => [OWN_PAYMENT, OWN_ORDINALS],
      });
      expect(deps.evaluateAgentPolicy(mintIntent({ feeRate: 10 }))).toMatchObject({
        allowed: false,
        reason: 'fee-rate-above-ceiling',
      });
    });

    it('denies a create-offer when the listed price is below the floor', () => {
      const state = agentPolicySlice.reducer(
        undefined,
        agentPolicySlice.actions.setPolicyForAccount({
          accountId: 'acct-a',
          policy: policy({ enabled: true, floorPriceSatsPerCat: 50_000 }),
        })
      );
      const deps = makeAgentPolicyDeps({
        getState: () => rootWith(state),
        dispatch: vi.fn(),
        accountId: 'acct-a',
        dayKeyFn: () => '2026-06-17',
        getOwnAddresses: () => [OWN_PAYMENT, OWN_ORDINALS],
      });
      expect(deps.evaluateAgentPolicy(createOfferIntent({ priceSats: 21_000 }))).toMatchObject({
        allowed: false,
        reason: 'price-below-floor',
      });
    });

    it('allows a create-offer at or above the floor', () => {
      const state = agentPolicySlice.reducer(
        undefined,
        agentPolicySlice.actions.setPolicyForAccount({
          accountId: 'acct-a',
          policy: policy({ enabled: true, floorPriceSatsPerCat: 50_000 }),
        })
      );
      const deps = makeAgentPolicyDeps({
        getState: () => rootWith(state),
        dispatch: vi.fn(),
        accountId: 'acct-a',
        dayKeyFn: () => '2026-06-17',
        getOwnAddresses: () => [OWN_PAYMENT, OWN_ORDINALS],
      });
      expect(deps.evaluateAgentPolicy(createOfferIntent({ priceSats: 100_000 }))).toEqual({
        allowed: true,
      });
    });

    it('uses spendSatsOverride as the transfer spend (a large cat trips the per-action cap)', () => {
      const state = agentPolicySlice.reducer(
        undefined,
        agentPolicySlice.actions.setPolicyForAccount({
          accountId: 'acct-a',
          policy: policy({ enabled: true, maxSpendPerActionSats: 100_000 }),
        })
      );
      const deps = makeAgentPolicyDeps({
        getState: () => rootWith(state),
        dispatch: vi.fn(),
        accountId: 'acct-a',
        dayKeyFn: () => '2026-06-17',
        getOwnAddresses: () => [OWN_PAYMENT, OWN_ORDINALS],
      });
      const transfer: Cat21TransferIntent = {
        catId: 'cat-1',
        recipient: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        feeRate: 5,
        mode: 'autonomous',
      };
      // The transfer's real spend is the whole cat UTXO value (1_000_000),
      // supplied as the override, not a 546 placeholder. 1_000_000 > cap
      // 100_000 → denied on the per-action cap.
      expect(deps.evaluateAgentPolicy(transfer, { spendSats: 1_000_000 })).toMatchObject({
        allowed: false,
        reason: 'spend-above-action-cap',
      });
      // A cat under the cap passes.
      expect(deps.evaluateAgentPolicy(transfer, { spendSats: 546 })).toEqual({ allowed: true });
    });

    it('fails closed on a transfer with no spendSatsOverride (never undercounts)', () => {
      const state = agentPolicySlice.reducer(
        undefined,
        agentPolicySlice.actions.setPolicyForAccount({
          accountId: 'acct-a',
          policy: policy({ enabled: true }),
        })
      );
      const deps = makeAgentPolicyDeps({
        getState: () => rootWith(state),
        dispatch: vi.fn(),
        accountId: 'acct-a',
        dayKeyFn: () => '2026-06-17',
        getOwnAddresses: () => [OWN_PAYMENT, OWN_ORDINALS],
      });
      const transfer: Cat21TransferIntent = {
        catId: 'cat-1',
        recipient: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        feeRate: 5,
      };
      expect(() => deps.evaluateAgentPolicy(transfer)).toThrow(/resolved\.spendSats/);
    });

    it('checks accept_offer floor against intent.expectedPriceSats (not a 0 stub)', () => {
      const state = agentPolicySlice.reducer(
        undefined,
        agentPolicySlice.actions.setPolicyForAccount({
          accountId: 'acct-a',
          policy: policy({ enabled: true, floorPriceSatsPerCat: 50_000 }),
        })
      );
      const deps = makeAgentPolicyDeps({
        getState: () => rootWith(state),
        dispatch: vi.fn(),
        accountId: 'acct-a',
        dayKeyFn: () => '2026-06-17',
        getOwnAddresses: () => [OWN_PAYMENT, OWN_ORDINALS],
      });
      const accept: Cat21AcceptOfferIntent = {
        offerPsbt: 'cHNidP8=',
        expectedCatId: 'cat-1',
        expectedPriceSats: 21_000,
        expectedSellerUtxo: { txid: 'ab', vout: 0 },
        mode: 'autonomous',
      };
      // 21_000 < floor 50_000 → denied. Previously receivePriceSats was a
      // hardcoded 0, which denied EVERY accept under any floor.
      expect(deps.evaluateAgentPolicy(accept)).toMatchObject({
        allowed: false,
        reason: 'price-below-floor',
      });
      expect(deps.evaluateAgentPolicy({ ...accept, expectedPriceSats: 100_000 })).toEqual({
        allowed: true,
      });
    });
  });

  describe('evaluateAgentPolicy: counterparty allowlist', () => {
    function depsWithAllowlist() {
      const state = agentPolicySlice.reducer(
        undefined,
        agentPolicySlice.actions.setPolicyForAccount({
          accountId: 'acct-a',
          policy: policy({ enabled: true, allowedCounterparties: [LISTED] }),
        })
      );
      return makeAgentPolicyDeps({
        getState: () => rootWith(state),
        dispatch: vi.fn(),
        accountId: 'acct-a',
        dayKeyFn: () => '2026-06-17',
        getOwnAddresses: () => [OWN_PAYMENT, OWN_ORDINALS],
      });
    }

    it("allows a mint to the account's own ordinals address, which is not on the list", () => {
      expect(
        depsWithAllowlist().evaluateAgentPolicy(mintIntent({ recipient: OWN_ORDINALS }))
      ).toEqual({
        allowed: true,
      });
    });

    it('denies a mint to a foreign recipient not on the list, naming the recipient', () => {
      expect(depsWithAllowlist().evaluateAgentPolicy(mintIntent({ recipient: FOREIGN }))).toEqual({
        allowed: false,
        reason: 'counterparty-not-allowed',
        detail: FOREIGN,
      });
    });

    it('denies a self-mint whose tip pays an address not on the list, naming the tip address', () => {
      const intent = mintIntent({
        recipient: OWN_ORDINALS,
        tip: { address: FOREIGN, value: 1_000 },
      });
      expect(depsWithAllowlist().evaluateAgentPolicy(intent)).toEqual({
        allowed: false,
        reason: 'counterparty-not-allowed',
        detail: FOREIGN,
      });
    });

    it('allows a self-mint whose tip pays a listed address', () => {
      const intent = mintIntent({
        recipient: OWN_ORDINALS,
        tip: { address: LISTED, value: 1_000 },
      });
      expect(depsWithAllowlist().evaluateAgentPolicy(intent)).toEqual({ allowed: true });
    });

    it('allows a self-mint with a zero-value tip, which adds no output and pays nobody', () => {
      const intent = mintIntent({ recipient: OWN_ORDINALS, tip: { address: FOREIGN, value: 0 } });
      expect(depsWithAllowlist().evaluateAgentPolicy(intent)).toEqual({ allowed: true });
    });

    it('allows a transfer to the own payment address and denies one to a foreign address', () => {
      const transfer: Cat21TransferIntent = { catId: 'cat-1', recipient: OWN_PAYMENT, feeRate: 5 };
      const deps = depsWithAllowlist();
      expect(deps.evaluateAgentPolicy(transfer, { spendSats: 546 })).toEqual({ allowed: true });
      expect(
        deps.evaluateAgentPolicy({ ...transfer, recipient: FOREIGN }, { spendSats: 546 })
      ).toEqual({
        allowed: false,
        reason: 'counterparty-not-allowed',
        detail: FOREIGN,
      });
    });

    it('checks a buy against the seller being paid', () => {
      const buy: Cat21BuyIntent = {
        catId: 'cat-1',
        catNumber: 7,
        bidSats: 5_000,
        sellerPaymentAddress: LISTED,
        feeRate: 5,
      };
      const deps = depsWithAllowlist();
      expect(deps.evaluateAgentPolicy(buy)).toEqual({ allowed: true });
      expect(deps.evaluateAgentPolicy({ ...buy, sellerPaymentAddress: FOREIGN })).toEqual({
        allowed: false,
        reason: 'counterparty-not-allowed',
        detail: FOREIGN,
      });
    });

    it('reads the own addresses at decision time', () => {
      const state = agentPolicySlice.reducer(
        undefined,
        agentPolicySlice.actions.setPolicyForAccount({
          accountId: 'acct-a',
          policy: policy({ enabled: true, allowedCounterparties: [LISTED] }),
        })
      );
      let own = [OWN_PAYMENT];
      const deps = makeAgentPolicyDeps({
        getState: () => rootWith(state),
        dispatch: vi.fn(),
        accountId: 'acct-a',
        dayKeyFn: () => '2026-06-17',
        getOwnAddresses: () => own,
      });
      expect(deps.evaluateAgentPolicy(mintIntent({ recipient: OWN_ORDINALS }))).toMatchObject({
        reason: 'counterparty-not-allowed',
      });
      own = [OWN_PAYMENT, OWN_ORDINALS];
      expect(deps.evaluateAgentPolicy(mintIntent({ recipient: OWN_ORDINALS }))).toEqual({
        allowed: true,
      });
    });

    it('an empty own address never makes an empty recipient pass', () => {
      const state = agentPolicySlice.reducer(
        undefined,
        agentPolicySlice.actions.setPolicyForAccount({
          accountId: 'acct-a',
          policy: policy({ enabled: true, allowedCounterparties: [LISTED] }),
        })
      );
      const deps = makeAgentPolicyDeps({
        getState: () => rootWith(state),
        dispatch: vi.fn(),
        accountId: 'acct-a',
        dayKeyFn: () => '2026-06-17',
        // The popup passes `paymentAddress ?? ''` before the account loads.
        getOwnAddresses: () => ['', OWN_ORDINALS],
      });
      expect(deps.evaluateAgentPolicy(mintIntent({ recipient: '' }))).toEqual({
        allowed: false,
        reason: 'counterparty-not-allowed',
        detail: '',
      });
    });

    it('denies an accept-offer under an allowlist: its buyer is not named here, fail closed', () => {
      const accept: Cat21AcceptOfferIntent = {
        offerPsbt: 'cHNidP8=',
        expectedCatId: 'cat-1',
        expectedPriceSats: 100_000,
        expectedSellerUtxo: { txid: 'ab', vout: 0 },
      };
      expect(depsWithAllowlist().evaluateAgentPolicy(accept)).toEqual({
        allowed: false,
        reason: 'counterparty-not-allowed',
        detail: '(missing counterparty address)',
      });
    });

    it('allows a listing whose proceeds land at the own payment address', () => {
      const listing = createOfferIntent({ priceSats: 100_000, paymentAddress: OWN_PAYMENT });
      expect(depsWithAllowlist().evaluateAgentPolicy(listing)).toEqual({ allowed: true });
    });

    it('denies a listing whose proceeds go to a foreign address, naming it', () => {
      const listing = createOfferIntent({ priceSats: 100_000, paymentAddress: FOREIGN });
      expect(depsWithAllowlist().evaluateAgentPolicy(listing)).toEqual({
        allowed: false,
        reason: 'counterparty-not-allowed',
        detail: FOREIGN,
      });
    });

    it('checks an accept-offer against the buyers the validated PSBT names', () => {
      const accept: Cat21AcceptOfferIntent = {
        offerPsbt: 'cHNidP8=',
        expectedCatId: 'cat-1',
        expectedPriceSats: 100_000,
        expectedSellerUtxo: { txid: 'ab', vout: 0 },
      };
      const deps = depsWithAllowlist();
      expect(deps.evaluateAgentPolicy(accept, { counterpartyAddresses: [LISTED] })).toEqual({
        allowed: true,
      });
      // A buyer change output to an unlisted address is a second buyer address.
      expect(
        deps.evaluateAgentPolicy(accept, { counterpartyAddresses: [LISTED, FOREIGN] })
      ).toEqual({
        allowed: false,
        reason: 'counterparty-not-allowed',
        detail: FOREIGN,
      });
    });

    it('checks a buy against the resolved cat address as well as the seller', () => {
      const buy: Cat21BuyIntent = {
        catId: 'cat-1',
        catNumber: 7,
        bidSats: 5_000,
        sellerPaymentAddress: LISTED,
        feeRate: 5,
      };
      expect(
        depsWithAllowlist().evaluateAgentPolicy(buy, { counterpartyAddresses: [LISTED, FOREIGN] })
      ).toEqual({ allowed: false, reason: 'counterparty-not-allowed', detail: FOREIGN });
    });

    it('a resolved list adds to the intent, never replaces it', () => {
      // Resolved [] for a buy must not drop the intent's seller from the check.
      const buy: Cat21BuyIntent = {
        catId: 'cat-1',
        catNumber: 7,
        bidSats: 5_000,
        sellerPaymentAddress: FOREIGN,
        feeRate: 5,
      };
      expect(depsWithAllowlist().evaluateAgentPolicy(buy, { counterpartyAddresses: [] })).toEqual({
        allowed: false,
        reason: 'counterparty-not-allowed',
        detail: FOREIGN,
      });
    });
  });

  describe('recordSpend', () => {
    it('dispatches incrementSpentToday with the right (accountId, sats, dayKey)', () => {
      const state = agentPolicySlice.reducer(undefined, { type: 'noop' });
      const dispatchSpy = vi.fn();
      const deps = makeAgentPolicyDeps({
        getState: () => rootWith(state),
        dispatch: dispatchSpy,
        accountId: 'acct-a',
        dayKeyFn: () => '2026-06-17',
        getOwnAddresses: () => [OWN_PAYMENT, OWN_ORDINALS],
      });
      deps.recordSpend(4_200);
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      expect(dispatchSpy.mock.calls[0][0]).toEqual(
        agentPolicySlice.actions.incrementSpentToday({
          accountId: 'acct-a',
          sats: 4_200,
          dayKey: '2026-06-17',
        })
      );
    });

    it('uses dayKeyFn fresh on each call (handles midnight crossing)', () => {
      const state = agentPolicySlice.reducer(undefined, { type: 'noop' });
      const dispatchSpy = vi.fn();
      let day = '2026-06-17';
      const deps = makeAgentPolicyDeps({
        getState: () => rootWith(state),
        dispatch: dispatchSpy,
        accountId: 'acct-a',
        dayKeyFn: () => day,
        getOwnAddresses: () => [OWN_PAYMENT, OWN_ORDINALS],
      });
      deps.recordSpend(100);
      day = '2026-06-18';
      deps.recordSpend(200);
      expect(dispatchSpy.mock.calls[0][0].payload.dayKey).toBe('2026-06-17');
      expect(dispatchSpy.mock.calls[1][0].payload.dayKey).toBe('2026-06-18');
    });
  });
});

import type { AgentPolicy } from 'ordpool-sdk/core';
import { describe, expect, it, vi } from 'vitest';

import type { RootState } from '@app/store';
import { agentPolicySlice } from '@app/store/agent-policy/agent-policy.slice';

import { makeAgentPolicyDeps } from './agent-policy-deps';
import type { Cat21CreateOfferIntent, Cat21MintIntent } from './types';

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
    it('returns agent-disabled when no policy exists for the account', () => {
      const state = agentPolicySlice.reducer(undefined, { type: 'noop' });
      const deps = makeAgentPolicyDeps({
        getState: () => rootWith(state),
        dispatch: vi.fn(),
        accountId: 'acct-a',
        dayKeyFn: () => '2026-06-17',
      });
      expect(deps.evaluateAgentPolicy(mintIntent())).toEqual({
        allowed: false,
        reason: 'agent-disabled',
      });
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
      });
      expect(deps.evaluateAgentPolicy(createOfferIntent({ priceSats: 100_000 }))).toEqual({
        allowed: true,
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
      });
      deps.recordSpend(100);
      day = '2026-06-18';
      deps.recordSpend(200);
      expect(dispatchSpy.mock.calls[0][0].payload.dayKey).toBe('2026-06-17');
      expect(dispatchSpy.mock.calls[1][0].payload.dayKey).toBe('2026-06-18');
    });
  });
});

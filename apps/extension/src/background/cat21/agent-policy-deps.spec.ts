import type { AgentActionContext, AgentPolicy } from 'ordpool-sdk/core';
import { describe, expect, it, vi } from 'vitest';

import type { RootState } from '@app/store';
import { agentPolicySlice } from '@app/store/agent-policy/agent-policy.slice';

import { makeAgentPolicyDeps } from './agent-policy-deps';

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

function context(overrides: Partial<AgentActionContext> = {}): AgentActionContext {
  return {
    kind: 'cat21_mint',
    spendSats: 5_000,
    feeRateSatPerVbyte: 30,
    spentTodaySats: 0,
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

      // No policy yet → disabled.
      expect(deps.agentMode.enabled).toBe(false);

      // Set policy with enabled:true → reflected on next read.
      state = agentPolicySlice.reducer(
        state,
        agentPolicySlice.actions.setPolicyForAccount({
          accountId: 'acct-a',
          policy: policy({ enabled: true }),
        })
      );
      expect(deps.agentMode.enabled).toBe(true);

      // Disable in policy → reflected.
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
      expect(deps.evaluateAgentPolicy(context())).toEqual({
        allowed: false,
        reason: 'agent-disabled',
      });
    });

    it('forwards to the SDK evaluator with the stored policy when one exists', () => {
      const state = agentPolicySlice.reducer(
        undefined,
        agentPolicySlice.actions.setPolicyForAccount({
          accountId: 'acct-a',
          policy: policy({ enabled: true, maxSpendPerActionSats: 10_000 }),
        })
      );
      const deps = makeAgentPolicyDeps({
        getState: () => rootWith(state),
        dispatch: vi.fn(),
        accountId: 'acct-a',
        dayKeyFn: () => '2026-06-17',
      });
      // Under cap: allowed.
      expect(deps.evaluateAgentPolicy(context({ spendSats: 5_000 }))).toEqual({ allowed: true });
      // Over per-action cap: denied with the SDK's reason code.
      expect(deps.evaluateAgentPolicy(context({ spendSats: 21_000 }))).toMatchObject({
        allowed: false,
        reason: 'spend-above-action-cap',
      });
    });

    it('overrides the caller-supplied spentTodaySats with the running store total', () => {
      let state = agentPolicySlice.reducer(
        undefined,
        agentPolicySlice.actions.setPolicyForAccount({
          accountId: 'acct-a',
          policy: policy({ dailyCapSats: 10_000 }),
        })
      );
      // 8,000 already spent today.
      state = agentPolicySlice.reducer(
        state,
        agentPolicySlice.actions.incrementSpentToday({
          accountId: 'acct-a',
          sats: 8_000,
          dayKey: '2026-06-17',
        })
      );
      const deps = makeAgentPolicyDeps({
        getState: () => rootWith(state),
        dispatch: vi.fn(),
        accountId: 'acct-a',
        dayKeyFn: () => '2026-06-17',
      });
      // 8,000 + 3,000 = 11,000 > 10,000 dailyCap → deny, regardless of
      // what the caller passed for spentTodaySats.
      expect(
        deps.evaluateAgentPolicy(context({ spendSats: 3_000, spentTodaySats: 0 }))
      ).toMatchObject({ allowed: false, reason: 'spend-above-daily-cap' });
    });

    it('resets to 0 when the dayKey has rolled over', () => {
      let state = agentPolicySlice.reducer(
        undefined,
        agentPolicySlice.actions.setPolicyForAccount({
          accountId: 'acct-a',
          policy: policy({ dailyCapSats: 10_000 }),
        })
      );
      // 9,000 spent yesterday.
      state = agentPolicySlice.reducer(
        state,
        agentPolicySlice.actions.incrementSpentToday({
          accountId: 'acct-a',
          sats: 9_000,
          dayKey: '2026-06-16',
        })
      );
      const deps = makeAgentPolicyDeps({
        getState: () => rootWith(state),
        dispatch: vi.fn(),
        accountId: 'acct-a',
        dayKeyFn: () => '2026-06-17',
      });
      // Today is fresh → 0 + 3,000 = 3,000 < 10,000 → allowed.
      expect(deps.evaluateAgentPolicy(context({ spendSats: 3_000 }))).toEqual({ allowed: true });
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

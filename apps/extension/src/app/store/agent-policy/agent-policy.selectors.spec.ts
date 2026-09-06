import type { AgentPolicy } from 'ordpool-sdk/core';
import { describe, expect, it } from 'vitest';

import type { RootState } from '@app/store';

import {
  selectAgentPolicyForAccount,
  selectIsAgentModeEnabledForAccount,
  selectSpentTodayForAccount,
} from './agent-policy.selectors';
import { agentPolicySlice } from './agent-policy.slice';

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

/**
 * Wrap an agent-policy slice state into a `RootState`-shaped object the
 * selectors can read. Only `agentPolicy` is populated — the selectors
 * never look at other slices. We cast through `unknown` because typing
 * the full RootState here would pull in every other slice for no benefit.
 */
function rootStateWith(agentPolicy: ReturnType<typeof agentPolicySlice.reducer>): RootState {
  return { agentPolicy } as unknown as RootState;
}

describe('selectAgentPolicyForAccount', () => {
  it('returns the stored policy when one exists', () => {
    const state = agentPolicySlice.reducer(
      undefined,
      agentPolicySlice.actions.setPolicyForAccount({
        accountId: 'acct-a',
        policy: policy({ dailyCapSats: 42 }),
      })
    );
    expect(selectAgentPolicyForAccount(rootStateWith(state), 'acct-a')?.dailyCapSats).toBe(42);
  });

  it('returns undefined for an account with no policy', () => {
    const state = agentPolicySlice.reducer(undefined, { type: 'noop' });
    expect(selectAgentPolicyForAccount(rootStateWith(state), 'acct-a')).toBeUndefined();
  });
});

describe('selectSpentTodayForAccount', () => {
  it('returns the running total when the dayKey matches', () => {
    const state = agentPolicySlice.reducer(
      undefined,
      agentPolicySlice.actions.incrementSpentToday({
        accountId: 'acct-a',
        sats: 7_000,
        dayKey: '2026-06-17',
      })
    );
    expect(selectSpentTodayForAccount(rootStateWith(state), 'acct-a', '2026-06-17')).toBe(7_000);
  });

  it('returns 0 when the dayKey does not match (yesterday rollover)', () => {
    const state = agentPolicySlice.reducer(
      undefined,
      agentPolicySlice.actions.incrementSpentToday({
        accountId: 'acct-a',
        sats: 7_000,
        dayKey: '2026-06-17',
      })
    );
    expect(selectSpentTodayForAccount(rootStateWith(state), 'acct-a', '2026-06-18')).toBe(0);
  });

  it('returns 0 for an account with no entry', () => {
    const state = agentPolicySlice.reducer(undefined, { type: 'noop' });
    expect(selectSpentTodayForAccount(rootStateWith(state), 'acct-a', '2026-06-17')).toBe(0);
  });
});

describe('selectIsAgentModeEnabledForAccount', () => {
  it('returns true when policy exists and enabled === true', () => {
    const state = agentPolicySlice.reducer(
      undefined,
      agentPolicySlice.actions.setPolicyForAccount({
        accountId: 'acct-a',
        policy: policy({ enabled: true }),
      })
    );
    expect(selectIsAgentModeEnabledForAccount(rootStateWith(state), 'acct-a')).toBe(true);
  });

  it('returns false when policy exists but enabled === false', () => {
    const state = agentPolicySlice.reducer(
      undefined,
      agentPolicySlice.actions.setPolicyForAccount({
        accountId: 'acct-a',
        policy: policy({ enabled: false }),
      })
    );
    expect(selectIsAgentModeEnabledForAccount(rootStateWith(state), 'acct-a')).toBe(false);
  });

  it('returns false for an account with no policy', () => {
    const state = agentPolicySlice.reducer(undefined, { type: 'noop' });
    expect(selectIsAgentModeEnabledForAccount(rootStateWith(state), 'acct-a')).toBe(false);
  });
});

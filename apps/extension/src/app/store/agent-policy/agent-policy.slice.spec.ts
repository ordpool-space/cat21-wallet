import type { AgentPolicy } from 'ordpool-sdk/core';
import { describe, expect, it } from 'vitest';

import {
  agentPolicySlice,
  clearPolicyForAccount,
  incrementSpentToday,
  resetSpentTodayForAccount,
  setPolicyForAccount,
} from './agent-policy.slice';

const reducer = agentPolicySlice.reducer;

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

describe('agentPolicySlice', () => {
  describe('setPolicyForAccount', () => {
    it('stores the policy keyed by accountId', () => {
      const next = reducer(
        undefined,
        setPolicyForAccount({ accountId: 'acct-a', policy: policy() })
      );
      expect(next.policies['acct-a']?.enabled).toBe(true);
      expect(next.policies['acct-a']?.dailyCapSats).toBe(100_000);
    });

    it('keeps policies of other accounts intact', () => {
      const after1 = reducer(
        undefined,
        setPolicyForAccount({ accountId: 'acct-a', policy: policy({ dailyCapSats: 100_000 }) })
      );
      const after2 = reducer(
        after1,
        setPolicyForAccount({ accountId: 'acct-b', policy: policy({ dailyCapSats: 50_000 }) })
      );
      expect(after2.policies['acct-a']?.dailyCapSats).toBe(100_000);
      expect(after2.policies['acct-b']?.dailyCapSats).toBe(50_000);
    });

    it('replaces an existing policy for the same account', () => {
      const after1 = reducer(
        undefined,
        setPolicyForAccount({ accountId: 'acct-a', policy: policy({ dailyCapSats: 100_000 }) })
      );
      const after2 = reducer(
        after1,
        setPolicyForAccount({ accountId: 'acct-a', policy: policy({ dailyCapSats: 21_000 }) })
      );
      expect(after2.policies['acct-a']?.dailyCapSats).toBe(21_000);
    });
  });

  describe('clearPolicyForAccount', () => {
    it('removes the policy AND the spentToday entry for that account', () => {
      let state = reducer(
        undefined,
        setPolicyForAccount({ accountId: 'acct-a', policy: policy() })
      );
      state = reducer(
        state,
        incrementSpentToday({ accountId: 'acct-a', sats: 5_000, dayKey: '2026-06-17' })
      );
      state = reducer(state, clearPolicyForAccount({ accountId: 'acct-a' }));
      expect(state.policies['acct-a']).toBeUndefined();
      expect(state.spentToday['acct-a']).toBeUndefined();
    });

    it('does not touch other accounts when clearing one', () => {
      let state = reducer(
        undefined,
        setPolicyForAccount({ accountId: 'acct-a', policy: policy() })
      );
      state = reducer(
        state,
        setPolicyForAccount({ accountId: 'acct-b', policy: policy({ dailyCapSats: 7 }) })
      );
      state = reducer(state, clearPolicyForAccount({ accountId: 'acct-a' }));
      expect(state.policies['acct-a']).toBeUndefined();
      expect(state.policies['acct-b']?.dailyCapSats).toBe(7);
    });
  });

  describe('incrementSpentToday', () => {
    it('initialises the entry on first call', () => {
      const next = reducer(
        undefined,
        incrementSpentToday({ accountId: 'acct-a', sats: 5_000, dayKey: '2026-06-17' })
      );
      expect(next.spentToday['acct-a']).toEqual({ sats: 5_000, dayKey: '2026-06-17' });
    });

    it('adds to the running total when the dayKey matches', () => {
      let state = reducer(
        undefined,
        incrementSpentToday({ accountId: 'acct-a', sats: 5_000, dayKey: '2026-06-17' })
      );
      state = reducer(
        state,
        incrementSpentToday({ accountId: 'acct-a', sats: 3_000, dayKey: '2026-06-17' })
      );
      expect(state.spentToday['acct-a']).toEqual({ sats: 8_000, dayKey: '2026-06-17' });
    });

    it('resets the total when the dayKey changes (yesterday rollover)', () => {
      let state = reducer(
        undefined,
        incrementSpentToday({ accountId: 'acct-a', sats: 90_000, dayKey: '2026-06-17' })
      );
      state = reducer(
        state,
        incrementSpentToday({ accountId: 'acct-a', sats: 1_000, dayKey: '2026-06-18' })
      );
      expect(state.spentToday['acct-a']).toEqual({ sats: 1_000, dayKey: '2026-06-18' });
    });

    it('tracks accounts independently', () => {
      let state = reducer(
        undefined,
        incrementSpentToday({ accountId: 'acct-a', sats: 5_000, dayKey: '2026-06-17' })
      );
      state = reducer(
        state,
        incrementSpentToday({ accountId: 'acct-b', sats: 9_000, dayKey: '2026-06-17' })
      );
      expect(state.spentToday['acct-a']?.sats).toBe(5_000);
      expect(state.spentToday['acct-b']?.sats).toBe(9_000);
    });
  });

  describe('resetSpentTodayForAccount', () => {
    it('removes the spentToday entry without touching the policy', () => {
      let state = reducer(
        undefined,
        setPolicyForAccount({ accountId: 'acct-a', policy: policy({ dailyCapSats: 100_000 }) })
      );
      state = reducer(
        state,
        incrementSpentToday({ accountId: 'acct-a', sats: 5_000, dayKey: '2026-06-17' })
      );
      state = reducer(state, resetSpentTodayForAccount({ accountId: 'acct-a' }));
      expect(state.spentToday['acct-a']).toBeUndefined();
      expect(state.policies['acct-a']?.dailyCapSats).toBe(100_000);
    });
  });
});

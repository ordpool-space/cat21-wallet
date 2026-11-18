import type { AgentPolicy } from 'ordpool-sdk/core';

import type { RootState } from '@app/store';

/**
 * Selectors for the per-account agent-policy state. Each selector takes
 * the accountId / dayKey it cares about — we don't bake "active account"
 * resolution into the selector itself because the dispatcher (background-
 * side) doesn't go through the React `useActiveAccount` hook chain.
 *
 * @knipignore -- HACK Cat21: consumed by agent-policy-deps.ts and
 *   future wizard UI; both are themselves @knipignore-tagged so knip
 *   can't trace the chain on its own.
 */

/**
 * Return the AgentPolicy for an account, or `undefined` if the account
 * has never had a policy set (or it was cleared). A missing policy is
 * the explicit signal that agent mode is OFF for that account; the
 * dispatcher reads `undefined` and refuses any autonomous action.
 */
export function selectAgentPolicyForAccount(
  state: RootState,
  accountId: string
): AgentPolicy | undefined {
  return state.agentPolicy.policies[accountId];
}

/**
 * Return the sats spent today for (account, dayKey). The consumer hands
 * us the day-key it considers "today" (typically `YYYY-MM-DD` in the
 * wallet's local timezone, computed fresh by `Date`). If the stored
 * entry's day-key doesn't match (yesterday's rollover), return 0 — the
 * stale entry is harmless and will be overwritten on the next spend.
 */
export function selectSpentTodayForAccount(
  state: RootState,
  accountId: string,
  dayKey: string
): number {
  const entry = state.agentPolicy.spentToday[accountId];
  if (!entry || entry.dayKey !== dayKey) return 0;
  return entry.sats;
}

/**
 * Convenience for first-run wizard / settings UI: `true` iff the account
 * has a stored policy AND the policy says `enabled: true`. UI code reads
 * this to decide whether to show "Agent mode is ON" vs "Set up agent
 * mode" affordances.
 */
export function selectIsAgentModeEnabledForAccount(state: RootState, accountId: string): boolean {
  const policy = state.agentPolicy.policies[accountId];
  return Boolean(policy?.enabled);
}

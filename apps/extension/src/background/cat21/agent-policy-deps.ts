import {
  type AgentActionContext,
  type AgentPolicy,
  type AgentPolicyDecision,
  evaluateAgentPolicy as sdkEvaluateAgentPolicy,
} from 'ordpool-sdk/core';

import type { RootState } from '@app/store';
import {
  selectAgentPolicyForAccount,
  selectIsAgentModeEnabledForAccount,
  selectSpentTodayForAccount,
} from '@app/store/agent-policy/agent-policy.selectors';
import { incrementSpentToday } from '@app/store/agent-policy/agent-policy.slice';

/**
 * The slice of `Cat21RpcDeps` that's owned by iter 10's agent-policy
 * Redux slice. This file is intentionally narrow — it produces the
 * three deps that hang off the per-account policy:
 *
 *   - `agentMode.enabled`     — read from `selectIsAgentModeEnabledForAccount`
 *   - `evaluateAgentPolicy()` — reads policy + spentToday from the store
 *                               and calls the SDK's pure-function gate
 *   - `recordSpend(sats)`     — dispatches `incrementSpentToday`
 *
 * Wiring this together with the keychain / sign / broadcast deps is the
 * dispatcher-construction caller's job (the background entry point in
 * the next slice of work). This module just makes the agent-policy half
 * trivial to plug in and impossible to get out of sync with the slice.
 *
 * `dayKeyFn` is injected so tests can pin a deterministic day; production
 * passes a closure over `new Date().toISOString().slice(0, 10)` (UTC) or
 * a local-tz variant — the wallet picks whatever timezone semantics it
 * wants. The slice itself doesn't care.
 */

// HACK -- Cat21: removed `export` (consumed by the next dispatcher-wiring slice). HARD RULE #5 — restore on wire-up.
interface AgentPolicyDepsArgs {
  /**
   * Pure-function snapshot reader. The dispatcher is called outside the
   * React tree, so it can't `useSelector`. Instead it takes a function
   * that returns the current store state — typically `() => store.getState()`.
   */
  getState: () => RootState;
  /** `() => store.dispatch(action)` so we don't import the store directly. */
  dispatch: (action: ReturnType<typeof incrementSpentToday>) => void;
  /** The accountId the dispatcher is acting on behalf of. */
  accountId: string;
  /**
   * Returns the day-key the running total is attributed to. Production
   * uses local-tz date; tests inject a fixed string.
   */
  dayKeyFn: () => string;
}

/**
 * Result shape returned by `makeAgentPolicyDeps`. Matches the three keys
 * in `Cat21RpcDeps` this module owns.
 */
// HACK -- Cat21: removed `export` (consumed by the next dispatcher-wiring slice). HARD RULE #5 — restore on wire-up.
interface AgentPolicyDeps {
  agentMode: { enabled: boolean };
  evaluateAgentPolicy: (context: AgentActionContext) => AgentPolicyDecision;
  recordSpend: (sats: number) => void;
}

/**
 * Build the three agent-policy deps that read/write the slice. The
 * factory is "live" — each call to `evaluateAgentPolicy` reads the
 * latest store state, so a policy change in the settings UI is picked
 * up by the next autonomous action without dispatcher reconstruction.
 *
 * Special case: if the account has no policy stored (the first-run
 * wizard hasn't been completed), `evaluateAgentPolicy` returns
 * `{ allowed: false, reason: 'agent-disabled' }` — agent mode is OFF
 * by default for any new account.
 */
/** @knipignore -- HACK Cat21: dispatcher constructor wires this in next slice. */
export function makeAgentPolicyDeps(args: AgentPolicyDepsArgs): AgentPolicyDeps {
  const { getState, dispatch, accountId, dayKeyFn } = args;

  return {
    agentMode: {
      get enabled(): boolean {
        // Re-evaluated on every property read so the settings UI's
        // "enable / disable agent mode" toggle takes effect without
        // dispatcher reconstruction.
        return selectIsAgentModeEnabledForAccount(getState(), accountId);
      },
    },
    evaluateAgentPolicy(context: AgentActionContext): AgentPolicyDecision {
      const state = getState();
      const policy: AgentPolicy | undefined = selectAgentPolicyForAccount(state, accountId);
      if (!policy) {
        return { allowed: false, reason: 'agent-disabled' };
      }
      // Wire the running spentToday total into the SDK's pure evaluator.
      // Caller passes `spentTodaySats: 0`; we override here so the
      // dispatcher's call sites don't need to thread it through.
      const dayKey = dayKeyFn();
      const spentToday = selectSpentTodayForAccount(state, accountId, dayKey);
      return sdkEvaluateAgentPolicy(policy, { ...context, spentTodaySats: spentToday });
    },
    recordSpend(sats: number): void {
      dispatch(incrementSpentToday({ accountId, sats, dayKey: dayKeyFn() }));
    },
  };
}

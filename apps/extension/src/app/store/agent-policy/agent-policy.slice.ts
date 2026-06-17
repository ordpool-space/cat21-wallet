import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import type { AgentPolicy } from 'ordpool-sdk/core';

/**
 * Per-account CAT-21 agent-policy state.
 *
 * Path 3 (YOLO / agent mode — see `/Work/ordpool/cat21-wallet/CLAUDE.md`)
 * delegates high-frequency cat trading to an MCP-host bridge. The bridge
 * calls into the wallet's typed Cat21 RPC methods; the wallet evaluates
 * the user-configured `AgentPolicy` and either signs silently (allowed)
 * or refuses with a typed denial (blocked). Each account holds its own
 * policy so a single wallet can have one strict account, one permissive
 * account, etc.
 *
 * `spentToday` is the rolling sat total per (accountId, dayKey). The day
 * key is an `YYYY-MM-DD` string in the wallet's local timezone, computed
 * fresh by the consumer when reading — we don't persist a date, we just
 * key on whatever day-string the consumer hands us. Once a new day-key
 * arrives, prior entries are stale but harmless; `selectSpentTodayForAccount`
 * returns 0 for any (account, day) it hasn't seen.
 *
 * Policy is OPT-IN: an account with no entry in `policies` is considered
 * to have agent mode disabled. The dispatcher's `evaluateAgentPolicy`
 * returns `{ allowed: false, reason: 'agent-disabled' }` in that case.
 * The first-run wizard sets the initial entry; afterwards the settings
 * page lets the user adjust it.
 */
// HACK -- Cat21: removed `export` keyword (consumed by iter 11 wizard UI + future settings page). HARD RULE #5 — restore on wire-up.
interface AgentPolicyState {
  /**
   * `accountId` → `AgentPolicy`. The accountId is the wallet-side string
   * the keychain hands us; we don't try to interpret it.
   */
  policies: Record<string, AgentPolicy>;
  /**
   * `accountId` → { sats spent today, day-key the sats are attributed to }.
   * The consumer passes a `today` day-key when reading; if it doesn't
   * match the stored day-key, the running total is treated as 0 (stale
   * yesterday rollover) and overwritten on the next `recordSpend`.
   */
  spentToday: Record<string, { sats: number; dayKey: string }>;
}

const initialState: AgentPolicyState = {
  policies: {},
  spentToday: {},
};

export const agentPolicySlice = createSlice({
  name: 'agentPolicy',
  initialState,
  reducers: {
    /**
     * Set (or replace) the policy for one account. Called by the
     * first-run wizard on commit and by the settings page on edit.
     */
    setPolicyForAccount(state, action: PayloadAction<{ accountId: string; policy: AgentPolicy }>) {
      const { accountId, policy } = action.payload;
      state.policies[accountId] = policy;
    },

    /**
     * Remove an account's policy. Used when a user "turns off agent mode
     * for this account" — distinct from setting `enabled: false` because
     * it tears down the whole policy struct rather than leaving stale
     * caps lying around for a future re-enable.
     */
    clearPolicyForAccount(state, action: PayloadAction<{ accountId: string }>) {
      delete state.policies[action.payload.accountId];
      delete state.spentToday[action.payload.accountId];
    },

    /**
     * Add to the rolling sat total for (account, dayKey). The wallet's
     * `recordSpend` dep on `Cat21RpcDeps` dispatches this after a
     * successful autonomous broadcast.
     *
     * If the stored entry's `dayKey` doesn't match the new payload, we
     * treat the prior total as expired and start fresh at `sats`.
     */
    incrementSpentToday(
      state,
      action: PayloadAction<{ accountId: string; sats: number; dayKey: string }>
    ) {
      const { accountId, sats, dayKey } = action.payload;
      const existing = state.spentToday[accountId];
      if (!existing || existing.dayKey !== dayKey) {
        state.spentToday[accountId] = { sats, dayKey };
      } else {
        state.spentToday[accountId] = { sats: existing.sats + sats, dayKey };
      }
    },

    /**
     * Manual reset for tests / "I changed my mind, give me a clean day"
     * UI. Production flow relies on `dayKey` rollover; this action is
     * here for completeness, not for the hot path.
     */
    resetSpentTodayForAccount(state, action: PayloadAction<{ accountId: string }>) {
      delete state.spentToday[action.payload.accountId];
    },
  },
});

/** @knipignore -- HACK Cat21: `incrementSpentToday` is dispatched by the
 * dispatcher's `recordSpend` dep (post-broadcast), wired through
 * `makeAgentPolicyDeps` which knip can't trace into the background
 * entrypoint chain. `resetSpentTodayForAccount` is consumed by a
 * future settings affordance. Both stay exported.
 */
export const {
  setPolicyForAccount,
  clearPolicyForAccount,
  incrementSpentToday,
  resetSpentTodayForAccount,
} = agentPolicySlice.actions;

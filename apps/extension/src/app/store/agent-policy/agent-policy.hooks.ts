import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import type { AgentPolicy } from 'ordpool-sdk/core';

import type { RootState } from '@app/store';
import { useCurrentAccountId } from '@app/store/accounts/account';

import {
  selectAgentPolicyForAccount,
  selectIsAgentModeEnabledForAccount,
} from './agent-policy.selectors';
import { clearPolicyForAccount, setPolicyForAccount } from './agent-policy.slice';

/**
 * React hook layer over the agent-policy slice. Consumers:
 *   - apps/extension/src/app/pages/cat21-agent-policy-wizard/
 *     cat21-agent-policy-wizard.tsx (iter 10c — first-run wizard form)
 *   - (future) the settings page entry for editing an existing policy
 *
 * Wallet boundary: each hook resolves the current account from the
 * active slice and stringifies it through `accountIdToSliceKey`, so
 * UI callers never thread accountIds through props.
 */

/**
 * Stringify a `{ fingerprint, accountIndex }` tuple into a stable
 * slice-key. The agent-policy slice keys by string; the wallet's
 * `useCurrentAccountId` returns the rich object. This one-liner is the
 * bridge.
 *
 * Format: `<fingerprint>:<accountIndex>`. The fingerprint is already
 * a stable hex string; the index is a small integer. Joining with `:`
 * is unambiguous (fingerprint has no `:` characters).
 *
 * Spec at `agent-policy.hooks.spec.ts` pins the format so a future
 * change to the keying contract is visible. None of the React hooks
 * below are spec-tested at this level (they need react-testing-library
 * mount); their internals call this helper, so the format guarantees
 * flow through.
 */
export function accountIdToSliceKey(accountId: {
  fingerprint: string;
  accountIndex: number;
}): string {
  return `${accountId.fingerprint}:${accountId.accountIndex}`;
}

/**
 * Read the AgentPolicy for the currently active account. Returns
 * `undefined` if no policy is set (the "agent mode off by default"
 * signal). Re-renders when the active account changes OR when the
 * stored policy for the active account changes.
 */
export function useAgentPolicyForCurrentAccount(): AgentPolicy | undefined {
  const currentAccount = useCurrentAccountId();
  const key = accountIdToSliceKey(currentAccount);
  return useSelector((state: RootState) => selectAgentPolicyForAccount(state, key));
}

/**
 * Returns `true` iff the current account has a stored policy with
 * `enabled: true`. Convenient for UI toggles (`Agent mode is ON`).
 */
// HACK -- Cat21: removed `export` (settings-page consumer lands later; wizard uses `useAgentPolicyForCurrentAccount` to detect existing). HARD RULE #5 — restore on wire-up.
// @ts-expect-error TS6133 -- HACK keeps declaration alive; remove with the `export` restore.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- HACK companion to the @ts-expect-error above.
function useIsAgentModeEnabledForCurrentAccount(): boolean {
  const currentAccount = useCurrentAccountId();
  const key = accountIdToSliceKey(currentAccount);
  return useSelector((state: RootState) => selectIsAgentModeEnabledForAccount(state, key));
}

/**
 * Returns a stable setter for the current account's policy. The
 * setter wraps the slice's `setPolicyForAccount` and resolves the
 * accountId from the active slice on each call, so a UI form's
 * submit handler doesn't need to thread accountId through props.
 */
export function useSetAgentPolicyForCurrentAccount(): (policy: AgentPolicy) => void {
  const dispatch = useDispatch();
  const currentAccount = useCurrentAccountId();
  return useCallback(
    (policy: AgentPolicy) => {
      const key = accountIdToSliceKey(currentAccount);
      dispatch(setPolicyForAccount({ accountId: key, policy }));
    },
    [dispatch, currentAccount]
  );
}

/**
 * Returns a stable clearer that removes the current account's policy
 * (and its rolling spentToday total). Used by the "Turn off agent mode
 * for this account" affordance in the settings page.
 */
// HACK -- Cat21: removed `export` (settings-page "Turn off" consumer lands later). HARD RULE #5 — restore on wire-up.
// @ts-expect-error TS6133 -- HACK keeps declaration alive; remove with the `export` restore.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- HACK companion to the @ts-expect-error above.
function useClearAgentPolicyForCurrentAccount(): () => void {
  const dispatch = useDispatch();
  const currentAccount = useCurrentAccountId();
  return useCallback(() => {
    const key = accountIdToSliceKey(currentAccount);
    dispatch(clearPolicyForAccount({ accountId: key }));
  }, [dispatch, currentAccount]);
}

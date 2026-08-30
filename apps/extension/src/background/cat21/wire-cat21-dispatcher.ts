import type { RootState } from '@app/store';
import { incrementSpentToday } from '@app/store/agent-policy/agent-policy.slice';

import { makeAgentPolicyDeps } from './agent-policy-deps';
import { Cat21Dispatcher, createCat21Dispatcher, makeWiringPendingDeps } from './cat21-dispatcher';
import type { Cat21RpcDeps } from './cat21-rpc.service';

/**
 * Per-account dispatcher factory. Composes the agent-policy slice (iter
 * 10a) with the other deps the dispatcher needs to run cat-flow actions.
 *
 * Today the only "real" deps are the agent-policy ones; the rest still
 * fall through to the wiring-pending stub from iter 9. That means:
 *
 *   - `cat21_*` calls in **manual** (popup) mode return a typed
 *     "wiring pending" denial because pickFundingUtxo / sign / broadcast
 *     haven't landed yet
 *   - `cat21_*` calls in **autonomous** (MCP-host bridge) mode hit the
 *     real policy gate FIRST; if the gate denies (e.g. agent mode off),
 *     the dispatcher never reaches the wiring-pending stubs and the
 *     caller gets a `{ allowed: false, reason: <typed> }` denial
 *
 * This is the intended sequencing: prove the policy gate works
 * end-to-end through the dispatcher before backfilling the
 * sign/broadcast machinery in later iterations.
 *
 * When iter 11+ lands the sign/broadcast deps, they replace the
 * `wiringPending` lines below — the agent-policy half stays untouched.
 */

// HACK -- Cat21: removed `export` (consumed by background entrypoint in a later slice). HARD RULE #5 — restore on wire-up.
interface WireCat21DispatcherArgs {
  getState(): RootState;
  dispatch(action: ReturnType<typeof incrementSpentToday>): void;
  accountId: string;
  /**
   * Returns the day-key (`YYYY-MM-DD`) the running spentToday total is
   * attributed to. The default `() => new Date().toISOString().slice(0, 10)`
   * (UTC) is fine; callers wanting a local-tz semantic can override.
   */
  dayKeyFn?(): string;
}

export function wireCat21Dispatcher(args: WireCat21DispatcherArgs): Cat21Dispatcher {
  const dayKeyFn = args.dayKeyFn ?? (() => new Date().toISOString().slice(0, 10));

  const agentPolicyDeps = makeAgentPolicyDeps({
    getState: args.getState,
    dispatch: args.dispatch,
    accountId: args.accountId,
    dayKeyFn,
  });

  const wiringPending = makeWiringPendingDeps();

  const deps: Cat21RpcDeps = {
    // Agent-policy slice (real, iter 10a):
    agentMode: agentPolicyDeps.agentMode,
    evaluateAgentPolicy: agentPolicyDeps.evaluateAgentPolicy,
    recordSpend: agentPolicyDeps.recordSpend,
    // Sign / broadcast / UTXO selection (wiring-pending, iter 11+):
    getAccountContext: wiringPending.getAccountContext,
    pickFundingUtxo: wiringPending.pickFundingUtxo,
    spendableUtxos: wiringPending.spendableUtxos,
    classifyOutpoint: wiringPending.classifyOutpoint,
    resolveCatUtxo: wiringPending.resolveCatUtxo,
    confirmListingPublication: wiringPending.confirmListingPublication,
    validateBuyOfferPsbt: wiringPending.validateBuyOfferPsbt,
    signWithConfirmation: wiringPending.signWithConfirmation,
    signSilently: wiringPending.signSilently,
    signBuyOfferInputs: wiringPending.signBuyOfferInputs,
    postBid: wiringPending.postBid,
    broadcast: wiringPending.broadcast,
  };

  return createCat21Dispatcher(deps);
}

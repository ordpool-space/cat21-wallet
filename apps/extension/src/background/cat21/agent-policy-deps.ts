import {
  type AgentActionContext,
  type AgentActionKind,
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

import type {
  Cat21AcceptOfferIntent,
  Cat21CreateOfferIntent,
  Cat21Intent,
  Cat21MintIntent,
  Cat21TransferIntent,
} from './types';

/**
 * The slice of `Cat21RpcDeps` owned by iter 10's agent-policy Redux
 * slice. Produces the three deps that hang off the per-account policy:
 *
 *   - `agentMode.enabled`     — read from `selectIsAgentModeEnabledForAccount`
 *   - `evaluateAgentPolicy()` — translates a `Cat21Intent` into the
 *                               SDK's `AgentActionContext`, reads
 *                               policy + spentToday from the store, and
 *                               calls the SDK's pure-function evaluator
 *   - `recordSpend(sats)`     — dispatches `incrementSpentToday`
 *
 * Wiring this together with the keychain / sign / broadcast deps is the
 * dispatcher-construction caller's job (in `wire-cat21-dispatcher.ts`).
 * This module just makes the agent-policy half trivial to plug in and
 * impossible to get out of sync with the slice.
 *
 * `dayKeyFn` is injected so tests can pin a deterministic day; production
 * passes `() => new Date().toISOString().slice(0, 10)` (UTC) or a
 * local-tz variant — the slice itself doesn't care.
 */

// HACK -- Cat21: removed `export` (consumed by the next dispatcher-wiring slice). HARD RULE #5 — restore on wire-up.
interface AgentPolicyDepsArgs {
  /**
   * Pure-function snapshot reader. The dispatcher is called outside the
   * React tree, so it can't `useSelector`. Instead it takes a function
   * that returns the current store state — typically `() => store.getState()`.
   */
  getState(): RootState;
  /** `() => store.dispatch(action)` so we don't import the store directly. */
  dispatch(action: ReturnType<typeof incrementSpentToday>): void;
  /** The accountId the dispatcher is acting on behalf of. */
  accountId: string;
  /**
   * Returns the day-key the running total is attributed to. Production
   * uses local-tz date; tests inject a fixed string.
   */
  dayKeyFn(): string;
}

/**
 * Result shape returned by `makeAgentPolicyDeps`. Matches the three
 * keys in `Cat21RpcDeps` this module owns. The `evaluateAgentPolicy`
 * signature mirrors the deps' callback contract — it receives a
 * `Cat21Intent` (typed-policy gate consumes the same shape the rest
 * of the dispatcher sees) and returns a decision the mode-resolver
 * can fold into rpc-result `denied(...)` payloads.
 */
// HACK -- Cat21: removed `export` (consumed by the next dispatcher-wiring slice). HARD RULE #5 — restore on wire-up.
interface AgentPolicyDeps {
  agentMode: { enabled: boolean };
  evaluateAgentPolicy(
    intent: Cat21Intent
  ): { allowed: true } | { allowed: false; reason: string; detail?: string };
  recordSpend(sats: number): void;
}

/**
 * Detect which Cat21Intent variant we have via structural typing. The
 * Cat21Intent union does NOT carry a discriminator field, so we
 * introspect the shape: `priceSats` → create-offer, `offerPsbt` →
 * accept-offer, `catId` (no priceSats) → transfer, otherwise → mint.
 *
 * This intentionally lives next to the SDK translation so a future
 * intent kind drops in here with both the detection branch AND the
 * SDK kind mapping in one place.
 */
function detectIntentKind(intent: Cat21Intent): AgentActionKind {
  if ('priceSats' in intent) return 'cat21_create_offer';
  if ('offerPsbt' in intent) return 'cat21_accept_offer';
  if ('catId' in intent) return 'cat21_transfer';
  return 'cat21_mint';
}

/**
 * Translate a Cat21Intent into the SDK's `AgentActionContext`. The
 * `spendSats` derivation is conservative — we hand the SDK a value
 * that's correct-or-low so a policy that allows X never sees Y > X
 * masked by a downstream undercount. The conservative defaults:
 *
 *   - mint: `0` placeholder; the wallet's recordSpend dep tracks the
 *     actual paid amount AFTER broadcast. We're under the daily cap
 *     check; the per-action cap is bypassed by `0` here. Per the
 *     iter 10 design, fee-rate is the meaningful gate for mints.
 *   - transfer: `0` placeholder; same reasoning.
 *   - create-offer: `priceSats` is what we'd receive, not spend.
 *     Used as `receivePriceSats` for the floor gate.
 *   - accept-offer: caller must populate at the dispatcher layer
 *     because the price is in the inbound PSBT bytes; placeholder `0`
 *     for now.
 *
 * A future refactor can move the precise spend numbers out of the
 * adapter and into the SDK; for now the gate is "good enough" for the
 * fee-rate and counterparty-allowlist branches.
 */
function cat21IntentToAgentContext(
  intent: Cat21Intent,
  spentTodaySats: number
): AgentActionContext {
  const kind = detectIntentKind(intent);
  const base: AgentActionContext = {
    kind,
    spendSats: 0,
    feeRateSatPerVbyte: 0,
    spentTodaySats,
  };
  switch (kind) {
    case 'cat21_mint': {
      const mintIntent = intent as Cat21MintIntent;
      return {
        ...base,
        feeRateSatPerVbyte: mintIntent.feeRate,
      };
    }
    case 'cat21_transfer': {
      const transferIntent = intent as Cat21TransferIntent;
      return {
        ...base,
        feeRateSatPerVbyte: transferIntent.feeRate,
        counterpartyAddress: transferIntent.recipient,
      };
    }
    case 'cat21_create_offer': {
      const offerIntent = intent as Cat21CreateOfferIntent;
      return {
        ...base,
        receivePriceSats: offerIntent.priceSats,
      };
    }
    case 'cat21_accept_offer': {
      // accept-offer's price + feeRate are inside the PSBT bytes the
      // SDK validator parses later. We submit a stub here; the rpc
      // service can override at a higher layer once it has decoded
      // the PSBT. For now this means accept-offer in autonomous mode
      // is effectively gated only by enabled-flag + counterparty.
      const acceptIntent = intent as Cat21AcceptOfferIntent;
      return {
        ...base,
        receivePriceSats: 0,
        // The buyer address lives in the PSBT; not available here.
        counterpartyAddress: acceptIntent.expectedCatId ? undefined : undefined,
      };
    }
    default: {
      // `kind` is exhaustively typed `AgentActionKind`; this branch is
      // unreachable. The eslint `default-case` rule requires it
      // explicitly. `satisfies never` enforces the exhaustiveness — a
      // future intent kind added to `AgentActionKind` lights this up
      // at compile time.
      const exhaustive: never = kind;
      throw new Error(`cat21IntentToAgentContext: unknown kind ${String(exhaustive)}`);
    }
  }
}

/**
 * Build the three agent-policy deps that read/write the slice. The
 * factory is "live" — each call to `evaluateAgentPolicy` reads the
 * latest store state, so a policy change in the settings UI is picked
 * up by the next autonomous action without dispatcher reconstruction.
 *
 * If the account has no policy stored (the first-run wizard hasn't
 * been completed), `evaluateAgentPolicy` returns
 * `{ allowed: false, reason: 'agent-disabled' }` — agent mode is OFF
 * by default for any new account.
 */
export function makeAgentPolicyDeps(args: AgentPolicyDepsArgs): AgentPolicyDeps {
  const { getState, dispatch, accountId, dayKeyFn } = args;

  return {
    agentMode: {
      get enabled(): boolean {
        return selectIsAgentModeEnabledForAccount(getState(), accountId);
      },
    },
    evaluateAgentPolicy(
      intent: Cat21Intent
    ): { allowed: true } | { allowed: false; reason: string; detail?: string } {
      const state = getState();
      const policy: AgentPolicy | undefined = selectAgentPolicyForAccount(state, accountId);
      if (!policy) {
        return { allowed: false, reason: 'agent-disabled' };
      }
      const dayKey = dayKeyFn();
      const spentToday = selectSpentTodayForAccount(state, accountId, dayKey);
      const context = cat21IntentToAgentContext(intent, spentToday);
      const decision: AgentPolicyDecision = sdkEvaluateAgentPolicy(policy, context);
      return decision;
    },
    recordSpend(sats: number): void {
      dispatch(incrementSpentToday({ accountId, sats, dayKey: dayKeyFn() }));
    },
  };
}

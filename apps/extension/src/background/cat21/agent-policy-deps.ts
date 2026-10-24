import {
  type AgentActionContext,
  type AgentActionKind,
  type AgentPolicy,
  type AgentPolicyDecision,
  CAT21_POSTAGE_SATS,
  evaluateAgentPolicyCaps as sdkEvaluateAgentPolicyCaps,
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
  Cat21BuyIntent,
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
 *                               SDK's `AgentActionContext` and enforces the
 *                               per-account CAPS (via the SDK's
 *                               `evaluateAgentPolicyCaps`). Caps only, no
 *                               `enabled` gate: a configured cap binds BOTH
 *                               manual and autonomous flows. The resolver's
 *                               `agentMode.enabled` guard is what gates
 *                               silent-sign, not this.
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
    intent: Cat21Intent,
    spendSatsOverride?: number
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
  // `bidSats` is unique to buy — checked before `catId` (buy carries it too).
  if ('bidSats' in intent) return 'cat21_buy';
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
 *   - mint: `CAT21_POSTAGE_SATS + tip.value` — the fresh cat's postage
 *     plus the optional tip output. The tip is an arbitrary
 *     `{address, value}` output, so counting it here is what bounds it
 *     under the per-action and daily caps (a mint with a large tip to an
 *     arbitrary address would otherwise be uncapped).
 *   - transfer: the real outflow is the WHOLE cat UTXO value (it all moves
 *     to the recipient), which the intent does not carry. The caller
 *     resolves it and passes `spendSatsOverride`; this branch REQUIRES it
 *     and fails closed if it's absent, so the spend cap can never be
 *     undercounted by a placeholder (a low count is permissive, not
 *     conservative). The recipient is also gated by the counterparty
 *     allowlist.
 *   - create-offer: `priceSats` is what we'd receive, not spend.
 *     Used as `receivePriceSats` for the floor gate.
 *   - accept-offer: `receivePriceSats` = the seller's declared
 *     `expectedPriceSats`, checked against the floor. The inbound PSBT is
 *     separately validated to pay at least that, so the floor binds the
 *     real proceeds. No spend (the seller receives, not pays).
 *
 * `spendSatsOverride`, when provided, REPLACES the derived `spendSats`. It
 * exists for the one kind whose spend is resolution-derived rather than
 * intent-derived (transfer): the caller supplies the resolved cat UTXO
 * value so the amount caps see the real outflow.
 */
function cat21IntentToAgentContext(
  intent: Cat21Intent,
  spentTodaySats: number,
  spendSatsOverride?: number
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
        spendSats: CAT21_POSTAGE_SATS + (mintIntent.tip?.value ?? 0),
        feeRateSatPerVbyte: mintIntent.feeRate,
      };
    }
    case 'cat21_transfer': {
      const transferIntent = intent as Cat21TransferIntent;
      if (spendSatsOverride === undefined) {
        // A transfer's real spend is the whole cat UTXO value, resolved from
        // cat21-ord, not present in the intent. The caller MUST supply it; a
        // missing override would let the spend cap see a placeholder and
        // undercount, so fail closed rather than guess.
        throw new Error(
          'cat21_transfer requires spendSatsOverride (the resolved cat UTXO value) for the cap gate'
        );
      }
      return {
        ...base,
        spendSats: spendSatsOverride,
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
      // The seller RECEIVES BTC (no spend). The floor gate checks the
      // seller's declared expectedPriceSats; the inbound PSBT is separately
      // validated (validateBuyOfferPsbt) to pay at least that, so the floor
      // binds the real proceeds. The buyer's address lives in the PSBT and
      // isn't known here, so no counterparty is set (an allowlist therefore
      // fails closed for accept, by design).
      const acceptIntent = intent as Cat21AcceptOfferIntent;
      return {
        ...base,
        receivePriceSats: acceptIntent.expectedPriceSats,
      };
    }
    case 'cat21_buy': {
      // buy commits bidSats (+ fee) to the seller. bidSats is the
      // dominant, known term — use it as spendSats so the per-action +
      // daily caps gate on the real outflow (the exact fee is added
      // post-simulation and tracked via recordSpend). The counterparty
      // is the seller we pay.
      const buyIntent = intent as Cat21BuyIntent;
      return {
        ...base,
        spendSats: buyIntent.bidSats,
        feeRateSatPerVbyte: buyIntent.feeRate,
        counterpartyAddress: buyIntent.sellerPaymentAddress,
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
 * up by the next action without dispatcher reconstruction.
 *
 * If the account has no policy stored (the first-run wizard hasn't
 * been completed), there are no caps to enforce, so `evaluateAgentPolicy`
 * returns `{ allowed: true }`. That does NOT open an autonomous hole: the
 * mode resolver's `agentMode.enabled` guard is false without a policy, so
 * an autonomous request is still rejected `agent-disabled`; a manual
 * request proceeds to the human-confirm dialog.
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
      intent: Cat21Intent,
      spendSatsOverride?: number
    ): { allowed: true } | { allowed: false; reason: string; detail?: string } {
      const state = getState();
      const policy: AgentPolicy | undefined = selectAgentPolicyForAccount(state, accountId);
      // No policy configured → no caps to enforce, so nothing to deny here.
      // A manual action proceeds to the human-confirm dialog; an AUTONOMOUS
      // action is still blocked by the mode resolver's `agentMode.enabled`
      // guard (false when no policy exists).
      if (!policy) {
        return { allowed: true };
      }
      const dayKey = dayKeyFn();
      const spentToday = selectSpentTodayForAccount(state, accountId, dayKey);
      const context = cat21IntentToAgentContext(intent, spentToday, spendSatsOverride);
      // Caps ONLY (no `enabled` gate): a configured cap binds BOTH manual and
      // autonomous flows, with no override. `enabled` decides silent-sign in
      // the mode resolver, never whether the caps apply — so an account that
      // kept its caps but turned agent mode off still has them enforced on a
      // manual action.
      const decision: AgentPolicyDecision = sdkEvaluateAgentPolicyCaps(policy, context);
      return decision;
    },
    recordSpend(sats: number): void {
      dispatch(incrementSpentToday({ accountId, sats, dayKey: dayKeyFn() }));
    },
  };
}
